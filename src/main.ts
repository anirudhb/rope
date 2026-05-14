import * as webpack from "jspatching/webpack";

import * as plugins from "./plugins";
import * as patch from "./patch";

const chunkName = "webpackChunkwebapp";

import menuPlugin from "./plugins/menu";
import PrivateChannelMapper from "./plugins/PrivateChannelMapper";

///////
/* Gather plugin metadata */
const ropePlugins: plugins.RopePlugin[] = [
  menuPlugin,
  PrivateChannelMapper,
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

  for (const [m, ids] of Object.entries(cachedExports)) {
    const p = plugins.__ropePluginRegistry.get(m);
    console.log(`[Rope] Initializing plugin ${p.id} (${p.meta.name})`);
    const i = plugins.getPersistedRopePluginInfo(p.id);
    const api = plugins.createRopePluginAPI(p.id);
    const patches = p.init(api, ids, i.config);
    patchedObjects.push(...patches);
  }

  // Consolidate and patch
  const webpackPatches = patch.createAndConsolidatePatches(patchedObjects);
  console.log(`[Rope] Performing early patch, ${patchedObjects.length} patched objects, ${webpackPatches.length} patched Webpack modules`);
  webpack._3type_hookWebpackChunkEarly(chunkName, webpackPatches);
} else {
  console.log(`[Rope] No cached metadata found`);
  globalThis.ropeCache = () => {
    plugins.refreshCachedExportIds();
    console.log(`[Rope] Cached metadata ready! Reload the page`);
  };
}
