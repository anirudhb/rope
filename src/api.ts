/** API for plugins, subject to change */

import { WebpackMatcher } from "jspatching/webpack";
import { RopePatchedObject } from "./patch";

export type RopeAPI = {
  webpack: typeof import("jspatching/webpack");
  react: typeof import("jspatching/react");
  plugins: typeof import("./plugins");
  /* for convenience */
  log: (...args: any[]) => void;
};

export type TransformedImports<I> = Record<string, WebpackMatcher> extends I ? {
  [K in keyof I]: any;
} : never;
export type RopePluginInit<C = undefined, I = {}> =
  (api: RopeAPI, imports: TransformedImports<I>, config: C) => RopePatchedObject[];
export type RopePlugin<C = undefined, I = {}> = Record<string, WebpackMatcher> extends I ? {
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
} : {}) : never;
