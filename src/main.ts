import * as webpack from "jspatching/webpack";

import * as plugins from "./plugins";
import * as patch from "./patch";

const chunkName = "webpackChunkwebapp";

import menuPlugin from "./plugins/menu";
import ActuallyMrkdwn from "./plugins/ActuallyMrkdwn";
import IdvStatus from "./plugins/IdvStatus";
import InvisibleForward from "./plugins/InvisibleForward";
import PrivateChannelMapper from "./plugins/PrivateChannelMapper";
import SilentTyping from "./plugins/SilentTyping";
import { sha256 } from "js-sha256";

////////

function main({ safeMode }: {
  safeMode: boolean;
}) {
  ///////
  /* Gather plugin metadata */
  const ropePlugins: plugins.RopePlugin[] = safeMode ? [
    menuPlugin,
  ] : [
    menuPlugin,
    ActuallyMrkdwn,
    IdvStatus,
    InvisibleForward,
    PrivateChannelMapper,
    SilentTyping,
  ];

  for (const p of ropePlugins)
    plugins.registerRopePlugin(p);

  // ensure menu is enabled
  plugins.setRopePluginEnabled(menuPlugin.id, true);

  const cachedExports = plugins.getCachedExportIds(safeMode);
  if (cachedExports) {
    console.log(`[Rope] Found cached metadata`);
    // Build patched object list
    const patchedObjects = [];
    const reactPatches = [];
    const newModulesChunkId = "rope_new_modules";
    const newModuleIds: Record<string, webpack.WebpackExportId> = {};
    const newModules: Record<number, webpack._3type_webpack_module_function> = {};

    // First pass - collect new modules
    for (const m of Object.keys(cachedExports)) {
      if (m === "rope") continue;

      const p = plugins.__ropePluginRegistry.get(m)!;
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

      const p = plugins.__ropePluginRegistry.get(m)!;
      console.log(`[Rope] Initializing plugin ${p.id} (${p.meta.name})`);
      const i = plugins.getPersistedRopePluginInfo(p.id);
      if (i.config === null && p.defaultConfig)
        i.config = p.defaultConfig;
      const api = plugins.createRopePluginAPI(p.id);
      const patches = p.init(api, { ...ids, extraModules: newModuleIds } as any, i.config);
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

    /** Hacky? */
    const overlayEl = document.createElement("div");
    overlayEl.style.setProperty("position", "absolute");
    overlayEl.style.setProperty("bottom", "16px");
    overlayEl.style.setProperty("left", "16px");
    overlayEl.style.setProperty("padding", "32px");
    overlayEl.style.setProperty("font-size", "2em");
    overlayEl.style.setProperty("font-family", "sans-serif");
    overlayEl.style.setProperty("border-radius", "5px");
    overlayEl.style.setProperty("background-color", "white");
    overlayEl.style.setProperty("border", "1px solid black");
    overlayEl.style.setProperty("z-index", "999999999");
    overlayEl.textContent = "Click here when Slack is loaded to enable Rope";
    overlayEl.onclick = () => {
      (globalThis as any).ropeCache();
      location.reload();
    };
    document.body.appendChild(overlayEl);
  }

  (globalThis as any).ropeCache = () => {
    plugins.refreshCachedExportIds();
    console.log(`[Rope] Cached metadata ready! Reload the page`);
  };
}

function init() {
  /* Parse options from query string */
  const p = new URLSearchParams(location.search);
  const freshP = new URLSearchParams(location.search);
  if (p.has("rope_disabled")) {
    return;
  }

  freshP.forEach((_val, key, self) => {
    if (/^rope/.test(key)) {
      self.delete(key);
    }
  });

  const safeMode = p.has("rope_safe_mode");
  let errorCtr = parseInt(p.get("rope_errors") ?? "0", 10);

  try {
    main({
      safeMode: p.has("rope_safe_mode"),
    });
  } catch {
    if (safeMode) {
      freshP.append("rope_disabled", "1");
    } else {
      if (errorCtr++ >= 3) {
        freshP.append("rope_safe_mode", "1");
      } else {
        freshP.append("rope_errors", errorCtr.toString());
      }
    }
    location.search = freshP.toString();
  }
}

init();
