/** API for plugins, subject to change */

export type RopeAPI = {
  webpack: typeof import("jspatching/webpack");
  react: typeof import("jspatching/react");
  redux: typeof import("jspatching/redux");
  slack: typeof import("./slack");
  /* for convenience */
  log: (...args: any[]) => void;
};

export type RopePluginInit<C = any> = (api: RopeAPI, config: C) => () => void;
export type RopePlugin<C = any> = {
  /* should be unique! */
  id: string;
  /* markdown supported in all fields */
  meta: {
    name: string;
    description: string;
    authors: string;
  };
  init: RopePluginInit<C>;
};
