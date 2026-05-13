import * as webpack from "jspatching/webpack";
import * as react from "jspatching/react";

import * as patch from "./patch";

/* Patch a simple module */
const chunkName = "webpackChunkwebapp";

function createCachedMetadata() {
  // Find the React import
  const reactId = webpack.tryFindWebpackExportId(chunkName, m => m?.createElement);
  if (!reactId) return null;

  // Find the Legend react element
  const legendId = webpack.tryFindWebpackExportId(chunkName, m => react.getComponentName(m) === "Legend");
  if (!legendId) return null;

  return { reactId, legendId };
}

// Fetch cached metadata
function getCachedMetadata() {
  let d = localStorage.getItem("rope_cached_metadata");
  if (d !== null)
    return JSON.parse(d);
  else
    return null;
}

function createLegendPatch({ legendId, reactId }: {
  legendId: webpack.WebpackExportId;
  reactId: webpack.WebpackExportId;
}): webpack._3type_WebpackPatch[] {
  return patch.createAndConsolidatePatches([
    {
      debugName: "rope-legend",
      exportId: legendId,
      patch: (require, orig) => {
        // Fetch original React
        const React = webpack.requireWebpackExport(require, reactId);

        return react.patchedComponent(orig, (props: any) => {
          if (props.children === "Input options")
            props = { ...props, children: "Input options (patched with Rope!)" };
          return React.createElement(orig, props);
        });
      },
    },
  ]);
  /*
    {
      debugName: "rope-log-react",
      moduleId: reactId.moduleId.moduleId,
      patch: (orig) => {
        return function(module, exports, require) {
          orig(module, exports, require);
          console.log(module);
          console.log(exports);
        };
      },
    },
  ];
  */
}

function init() {
  const d = getCachedMetadata();
  if (d === null) {
    globalThis.ropeCallback = function() {
      // cache
      let d2 = createCachedMetadata();
      if (d2 === null) {
        console.log(`[Rope] Failed to create cached metadata`);
        return;
      }

      localStorage.setItem("rope_cached_metadata", JSON.stringify(d2));
      console.log(`[Rope] Cached metadata created, will be used on next reload`);
    };
    console.log(`[Rope] No cached metadata, added callback on window`);

    return;
  }

  console.log(`[Rope] Found cached metadata`);
  console.log(d);
  // Create patch
  const legendPatches = createLegendPatch(d);
  webpack._3type_hookWebpackChunkEarly(chunkName, [...legendPatches]);
  console.log(`[Rope] Applied patches early`);
}

init();

//import menuPlugin from "./plugins/menu";
//
///* Gather plugin metadata */
//const ropePlugins: plugins.RopePlugin[] = [
//  menuPlugin,
//];
//
//for (const p of ropePlugins)
//  plugins.registerRopePlugin(p);
//
//// ensure menu is enabled
//plugins.setRopePluginEnabled(menuPlugin.id, true, false);
//
///* start plugins */
//plugins.startConfiguredRopePlugins();
