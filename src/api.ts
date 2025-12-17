/** API for plugins, subject to change */

export type RopeAPI<C = any> = {
  webpack: typeof import("jspatching/webpack");
  react: typeof import("jspatching/react");
  redux: typeof import("jspatching/redux");
  slack: typeof import("./slack");
  plugins: typeof import("./plugins");
  /* for convenience */
  log: (...args: any[]) => void;

  // React hook that allows interfacing with plugin config.
  // Caution! The setter must actually reflect changes, otherwise the getter will not see them.
  // Calling this without a getter/setter allows modifying the entire plugin config at once.
  usePluginConfig: <T = C>(getter?: (c: C) => T, setter?: (c: C, t: T) => C) => [T, (t: T) => void];
};

export type RopePluginInit<C = undefined> = (api: RopeAPI<C>, config: C) => () => void;
export type RopePlugin<C = undefined> = {
  /* should be unique! */
  id: string;
  /* markdown supported in all fields */
  meta: {
    name: string;
    description: string;
    authors: string;
  };
  init: RopePluginInit<C>;
} & (C extends NonNullable<infer C2> ? {
  defaultConfig: C2;
} : {});
