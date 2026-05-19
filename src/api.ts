/** API for plugins, subject to change */

import { _3type_webpack_module_function, WebpackExportId, WebpackMatcher } from "jspatching/webpack";
import { RopePatchedObject, RopeReactPatch } from "./patch";

export type RopeAPI<C = undefined> = {
  webpack: typeof import("jspatching/webpack");
  react: typeof import("jspatching/react");
  plugins: typeof import("./plugins");
  /* for convenience */
  log: (...args: any[]) => void;
  id: string;

  getPluginConfig: () => C;
  // Fires a localStorage event so that e.g. React hooks also get updated
  setPluginConfig: (c: C | ((c: C) => C)) => void;

  // React hook that allows interfacing with plugin config.
  // Caution! The setter must actually reflect changes, otherwise the getter will not see them.
  // Calling this without a getter/setter allows modifying the entire plugin config at once.
  usePluginConfig: <T = C>(react: typeof import("react"), getter?: (c: C) => T, setter?: (c: C, t: T) => C) => [T, (t: T) => void];
};

export type RopePatches = {
  modules: RopePatchedObject[];
  components: RopeReactPatch[];
};

export type TransformedImports<I extends Record<string, WebpackMatcher>> = {
  [K in keyof I]: I[K] extends WebpackMatcher<infer T> ? WebpackExportId<T> : never;
} & {
  extraModules: Record<string, WebpackExportId>;
};
export type RopePluginInit<C = undefined, I extends Record<string, WebpackMatcher> = {}> =
  (api: RopeAPI<C>, imports: TransformedImports<I>, config: C) => RopePatches;
export type RopePlugin<C = undefined, I extends Record<string, WebpackMatcher> = {}> = {
  /* should be unique! */
  id: string;
  /* markdown supported in all fields */
  meta: {
    name: string;
    description: string;
    authors: string;
  };
  init: RopePluginInit<C, I>;
  imports: I;
  /* can be an arbitrary string, will be hashed to a deterministic number */
  newModules?: Record<string, _3type_webpack_module_function>;
} & (C extends NonNullable<infer C2> ? {
  defaultConfig: C2;
} : {});
