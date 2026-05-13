/** API for plugins, subject to change */

import { WebpackExportId, WebpackMatcher } from "jspatching/webpack";
import { RopePatchedObject } from "./patch";

export type RopeAPI = {
  webpack: typeof import("jspatching/webpack");
  react: typeof import("jspatching/react");
  plugins: typeof import("./plugins");
  /* for convenience */
  log: (...args: any[]) => void;
};

export type TransformedImports<I extends Record<string, WebpackMatcher>> = {
  [K in keyof I]: I[K] extends WebpackMatcher<infer T> ? WebpackExportId<T> : never;
};
export type RopePluginInit<C = undefined, I extends Record<string, WebpackMatcher> = {}> =
  (api: RopeAPI, imports: TransformedImports<I>, config: C) => RopePatchedObject[];
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
} & (C extends NonNullable<infer C2> ? {
  defaultConfig: C2;
} : {});
