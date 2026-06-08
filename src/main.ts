import * as webpack from "jspatching/webpack";

import * as plugins from "./plugins";
import * as patch from "./patch";

const chunkName = "webpackChunkwebapp";

import menuPlugin from "./plugins/menu";
import IdvStatus from "./plugins/IdvStatus";
import InvisibleForward from "./plugins/InvisibleForward";
import PrivateChannelMapper from "./plugins/PrivateChannelMapper";
import SilentTyping from "./plugins/SilentTyping";
import { sha256 } from "js-sha256";

////////

function main() {
  /* Parse options from query string */
  const p = new URLSearchParams(location.search);
  if (p.has("rope_disabled")) {
    return;
  }

  ///////
  /* Gather plugin metadata */
  const ropePlugins: plugins.RopePlugin[] = [
    menuPlugin,
    IdvStatus,
    InvisibleForward,
    PrivateChannelMapper,
    SilentTyping,
  ];

  for (const p of ropePlugins)
    plugins.registerRopePlugin(p);

  // ensure menu is enabled
  plugins.setRopePluginEnabled(menuPlugin.id, true);

  const cachedExports = plugins.getCachedExportIds();
  if (cachedExports) {
    console.log(`[Rope] Found cached metadata`);
    // Build patched object list
    const patchedObjects = [];
    const reactPatches = [];
    const newModulesChunkId = "rope_new_modules";
    const newModuleIds: Record<string, webpack.WebpackExportId> = {};
    const newModules = {};

    // First pass - collect new modules
    for (const m of Object.keys(cachedExports)) {
      if (m === "rope") continue;

      const p = plugins.__ropePluginRegistry.get(m);
      console.log(`[Rope] Early scanning new modules for plugin ${p.id} (${p.meta.name})`);
      for (const [k, mm] of Object.entries(p.newModules ?? {})) {
        const h = parseInt(sha256(k).slice(0, 8), 16);
        //const n = h + 0xfffffffe;
        const n = h + 0xffffffffffffe;
        console.log(`[Rope] New module ${k} will get ID ${n}`);
        newModuleIds[k] = {
          moduleId: {
            chunkIds: [newModulesChunkId],
            chunkName,
            moduleId: n.toString(),
          },
          export: null,
        };
        newModules[n] = mm;
      }
    }

    for (const [m, ids] of Object.entries(cachedExports)) {
      // FIXME
      if (m === "rope") continue;

      const p = plugins.__ropePluginRegistry.get(m);
      console.log(`[Rope] Initializing plugin ${p.id} (${p.meta.name})`);
      const i = plugins.getPersistedRopePluginInfo(p.id);
      if (i.config === null && p.defaultConfig)
        i.config = p.defaultConfig;
      const api = plugins.createRopePluginAPI(p.id);
      const patches = p.init(api, { ...ids, extraModules: newModuleIds }, i.config);
      // XXX: We don't need to add the new chunk as a dependency since it is always loaded first
      patchedObjects.push(...patches.modules);
      reactPatches.push(...patches.components);
    }
    console.log(patchedObjects);
    console.log(reactPatches);

    // Build React patch
    patchedObjects.unshift(...patch.consolidateReactPatches(
      cachedExports.rope.React as webpack.WebpackExportId[],
      cachedExports.rope.ReactJsx as webpack.WebpackExportId[],
      reactPatches,
    ));

    // Consolidate and patch
    const webpackPatches = patch.createAndConsolidatePatches(patchedObjects);
    console.log(`[Rope] Performing early patch, ${patchedObjects.length} patched objects, ${webpackPatches.length} patched Webpack modules, ${Object.keys(newModules).length} new modules`);
    webpack._3type_hookWebpackChunkEarly(chunkName, webpackPatches, [
      [[newModulesChunkId], newModules, (_r) => {}],
    ]);
  } else {
    console.log(`[Rope] No cached metadata found`);
  }

  globalThis.ropeCache = () => {
    plugins.refreshCachedExportIds();
    console.log(`[Rope] Cached metadata ready! Reload the page`);
  };
}

main();
