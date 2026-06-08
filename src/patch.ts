/** Handles patch transformations */

import { sha256 } from "js-sha256";
import { getComponentName } from "jspatching/react";

import { _3type_webpack_require_type, _3type_WebpackPatch, requireWebpackExport, tryFindWebpackExportId, WebpackExportId, WebpackMatcher } from "jspatching/webpack";

/**
 * Converts a map of map of Webpack matchers into export IDs.
 */
export function lookupWebpackModulesBulk(chunkName: string, matchers: Record<string, Record<string, WebpackMatcher>>):
  Record<string, Record<string, WebpackExportId | WebpackExportId[] | null>> {
  // Avoids searching twice for the same matcher function
  const foundModules = new Map();
  const out: Record<string, Record<string, WebpackExportId | WebpackExportId[] | null>> = {};

  for (const [k1, m] of Object.entries(matchers)) {
    out[k1] = {};
    for (const [k2, matcher] of Object.entries(m)) {
      let id = foundModules.get(matcher);
      if (typeof id === "undefined") {
        id = tryFindWebpackExportId(chunkName, matcher, matcher.all ?? false);
        if (id === null) {
          throw new Error(`[Rope] Failed to find webpack export id for ${k1}.${k2}!`);
        }
        foundModules.set(matcher, id);
      }
      out[k1][k2] = id;
    }
  }

  return out;
}

/**
 * Creates a hash of bulk Webpack matchers.
 * The hash is based on the keys and stringified Functions.
 * Therefore it is possible that this hash may change even if the actual matchers remain the same.
 * The internal structure of this hash is subject to change.
 */
export function hashWebpackMatchers(matchers: Record<string, Record<string, WebpackMatcher>>): string {
  const hasher = sha256.create();

  for (const mk of Object.keys(matchers).toSorted()) {
    const m = matchers[mk];
    hasher.update(mk);
    hasher.update("\0\0\0");
    for (const ik of Object.keys(m).toSorted()) {
      const i = m[ik];
      hasher.update(ik);
      hasher.update("\0");
      hasher.update(i.toString());
      hasher.update("\0");
      hasher.update(i.all?.toString() ?? "null");
      hasher.update("\0\0");
    }
  }

  return hasher.hex();
}

export type RopePatchedObject = {
  exportId: WebpackExportId;
  debugName: string;
  patch: (require: _3type_webpack_require_type, orig: any, module: any, exports: any) => any;
  dependencies?: WebpackExportId[];
  method?: "module" | "exports";
};
/**
 * Creates and consolidates patches from a list of patched objects.
 */
export function createAndConsolidatePatches(patches: RopePatchedObject[]): _3type_WebpackPatch[] {
  // Consolidate patches by module id
  const patchesByModuleId: Record<string, {
    root: RopePatchedObject[];
    props: Record<string, RopePatchedObject[]>;
  }> = {};

  for (const p of patches) {
    const m = patchesByModuleId[p.exportId.moduleId.moduleId] ??= { root: [], props: {} };
    if (p.exportId.export === null) {
      m.root.push(p);
    } else {
      (m.props[p.exportId.export] ??= []).push(p);
    }
  }

  // For each module ID, create a patch
  return Object.entries(patchesByModuleId).map(([moduleId, patches]) => ({
    moduleId,
    debugName: `rope-consolidated-${moduleId}`,
    patch: (origModule) => async function(module, exports, require) {
      console.log(`[Rope] Running consolidated patch for module id ${moduleId}`);

      const module2 = {};
      const exports2 = {};
      // Run the original module
      origModule(module2, exports2, require);

      // Copy properties
      for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(module2))) {
        Object.defineProperty(module, k, { ...d, configurable: true });
      }
      for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(exports2))) {
        Object.defineProperty(exports, k, { ...d, configurable: true });
      }

      // Run root patches
      if (module.exports) {
        for (const rp of patches.root) {
          console.log(`[Rope] Running root patch ${rp.debugName} for module id ${moduleId}`);
          const dependentChunkIds = (rp.dependencies ?? []).map(x=>x.moduleId.chunkIds).flat();
          await Promise.all(dependentChunkIds.map(x=>(require as any).e(x)));
          module.exports = rp.patch(require, module.exports, module, exports);
        }
      }

      // Run property patches
      for (const [prop, patches2] of Object.entries(patches.props)) {
        /* Determine how to get and set this prop
         * Try getters on exports, then module.exports */
        const getPropE = () => exports[prop];
        const getPropM = () => module.exports[prop];
        const setPropE = (v: any) => Object.defineProperty(exports, prop, { get: () => v, configurable: true });
        const setPropM = (v: any) => module.exports[prop] = v;

        for (const pp of patches2) {
          let getProp: () => any;
          let setProp: (_: any) => void;
          if (pp.method === "exports") {
            getProp = getPropE;
            setProp = setPropE;
          } else if (pp.method === "module") {
            getProp = getPropM;
            setProp = setPropM;
          } else if (Object.hasOwn(exports, prop)) {
            getProp = getPropE;
            setProp = setPropE;
          } else if (Object.hasOwn(module.exports, prop)) {
            getProp = getPropM;
            setProp = setPropM;
          } else {
            // unreachable
            continue;
          }

          console.log(`[Rope] Running property patch ${pp.debugName} for property ${prop} of module ${moduleId}`);
          const dependentChunkIds = (pp.dependencies ?? []).map(x=>x.moduleId.chunkIds).flat();
          await Promise.all(dependentChunkIds.map(x=>(require as any).e(x)));
          setProp(pp.patch(require, getProp(), module, exports));
        }
      }
    },
  }));
}

export type RopeReactPatch<P = any> = {
  componentName: string;
  debugName: string;
  patch: (require: _3type_webpack_require_type, react: typeof import("react"), orig: React.FC<P>) => React.FC<P>;
  dependencies?: WebpackExportId[];
};
/**
 * Consolidates React patches into a single RopePatchedObject for React.createElement.
 */
export function consolidateReactPatches(reactIds: WebpackExportId[], jsxIds: WebpackExportId[], patches: RopeReactPatch[]): RopePatchedObject[] {
  //const sym_RopePatched = Symbol.for("Rope.ReactPatched");
  //const sym_RopeOriginal = Symbol.for("Rope.ReactOriginal");
  const patchesByComponent = new Map();
  for (const p of patches) {
    if (!patchesByComponent.has(p.componentName))
      patchesByComponent.set(p.componentName, []);
    patchesByComponent.get(p.componentName).push(p);
  }

  const patchedComponents = new WeakMap();
  const patchedComponents2 = new Map();
  const notPatched = new WeakSet();
  const originals = new Map();

  function patchType(type: any, require: _3type_webpack_require_type, react: typeof import("react")): any {
    const orig = type;
    if (!(typeof type === "object" || typeof type === "function" || typeof type === "symbol") || notPatched.has(type)) {
      /* do nothing */
    } else if (notPatched.has(type)) {
      /* do nothing */
    } else if (originals.has(type)) {
      type = originals.get(type);
    } else if (typeof type === "symbol") {
      /* do nothing */
    } else if (patchedComponents.has(type)) {
      type = patchedComponents.get(type);
    } else {
      const name = getComponentName(type);
      if (patchedComponents2.has(name)) {
        type = patchedComponents2.get(name);
        patchedComponents.set(orig, type);
      } else if (patchesByComponent.has(name)) {
        //const orig2 = (props: any) => orig(props);
        //orig2.displayName = `OriginalThunk(${name})`;
        //notPatched.add(orig2);
        const origSymbol = Symbol(`Rope.Original.${name}`);
        originals.set(origSymbol, orig);
        type = origSymbol;
        for (const p of patchesByComponent.get(name)) {
          console.log(`[Rope] Running React component patch ${p.debugName} for component ${p.componentName}`);
          type = p.patch(require, react, type);
        }
        patchedComponents2.set(name, type);
        patchedComponents.set(orig, type);
      } else {
        notPatched.add(type);
      }
    }
    return type;
  }

  if (reactIds.length <= 0) {
    return [];
  }

  ///* FIXME: this may be bad */
  //let orig_createElement = null;
  //let orig_jsx = null;
  //let orig_jsxs = null;

  const sym_patchedCreator = Symbol.for("Rope.React.PatchedCreator");

  const reactPatches = reactIds.map(reactId => ({
    exportId: { ...reactId, export: "createElement" },
    debugName: "rope-consolidated-react-createElement-patches",
    dependencies: patches.map(p=>p.dependencies ?? []).flat(),
    method: "module",
    patch: (require, real__createElement: typeof import("react").createElement, module, _exports): typeof import("react").createElement => {
      // Helps avoid issues for two modules pointing to the same functions
      if ((real__createElement as any)[sym_patchedCreator] === true) {
        return real__createElement;
      }
      const f = function(type: any, props: any, ...children: any[]) {
        type = patchType(type, require, module.exports);
        return real__createElement(type, props, ...children) as any;
      };
      f[sym_patchedCreator] = true;
      return f;
    },
  }) satisfies RopePatchedObject);
  /* The jsx patches will still need a reference to the React module to keep the API consistent */
  const canonicalReactId = reactIds[0];
  const jsxPatches = jsxIds.map(jsxId => ["jsx", "jsxs"].map(k => ({
    exportId: { ...jsxId, export: k },
    debugName: "rope-consolidated-react-jsx-patches",
    dependencies: [canonicalReactId, ...patches.map(p=>p.dependencies ?? []).flat()],
    method: "module",
    /* Type of real__jsx is "close enough" */
    patch: (require, real__jsx: typeof import("react").createElement, _module, _exports) => {
      // Helps avoid issues for two modules pointing to the same functions
      if ((real__jsx as any)[sym_patchedCreator] === true) {
        return real__jsx;
      }

      const canonicalReact = requireWebpackExport(require, canonicalReactId);
      const f = function(type: any, ...args: any[]) {
        type = patchType(type, require, canonicalReact);
        return real__jsx(type, ...args);
      };
      f[sym_patchedCreator] = true;
      return f;
    },
  }) satisfies RopePatchedObject)).flat();

  return [...reactPatches, ...jsxPatches];
}
