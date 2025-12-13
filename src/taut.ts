/** Exposes a Taut-compatible API on globalThis */
import * as webpack from "jspatching/webpack";
import * as react from "jspatching/react";

type TautAPI__filter = (exp: any) => boolean;
type TautAPI__componentReplacer<P> = (o: React.ComponentType<P>) => React.ComponentType<P>;
export type TautAPI = {
  /* css */
  setStyle: (key: string, css: string) => void;
  removeStyle: (key: string) => void;
  /* webpack */
  findExport:
    | ((filter: TautAPI__filter, all?: true) => any[])
    | ((filter: TautAPI__filter, all?: false) => any | null);
  findByProps:
    | ((props: string[], all: true) => any[])
    | ((props: string[], all?: false) => any | null);
  commonModules: {
    React: typeof import("react");
    ReactDOM: typeof import("react-dom");
    ReactDOMClient: typeof import("react-dom/client");
  };
  /* react */
  findComponent:
    | (<P extends {}>(name: string, all?: false, filter?: TautAPI__filter) => React.ComponentType<P>)
    | (<P extends {}>(name: string, all?: true, filter?: TautAPI__filter) => React.ComponentType<P>);
  patchComponent: <P = {}>(
    matcher:
      | string
      // TODO; support this
      | { displayName?: string; filter?: TautAPI__filter; component?: React.ComponentType<P>; },
    replacement: TautAPI__componentReplacer<P>,
  ) => () => void;
};

const styleElementIdPrefix = "rope-compat-taut-css-";

declare global {
  var TautAPI: TautAPI;
}

// ok to initialize outside an init function since it only uses functions
globalThis.TautAPI = {
  setStyle(key, css) {
    const i = styleElementIdPrefix + key;
    let e: HTMLElement | null = null;
    if ((e = document.getElementById(i)) !== null) {
      e.textContent = css;
    } else {
      e = document.createElement("style");
      e.textContent = css;
      document.body.appendChild(e);
    }
  },
  removeStyle(key) {
    const i = styleElementIdPrefix + key;
    const e = document.getElementById(i);
    if (e && e.parentNode)
      e.parentNode.removeChild(e);
  },
  findExport(filter: TautAPI__filter, all = false) {
    return webpack.tryFindWebpackModule(filter, all);
  },
  findByProps(props: string[], all = false) {
    return webpack.tryFindWebpackModule(m => {
      const ks = Object.keys(m);
      for (const k of ks)
        if (props.includes(k))
          return true;
      return false;
    }, all);
  },
  commonModules: {
    React: globalThis.React,
    ReactDOM: globalThis._ReactDOM,
    ReactDOMClient: globalThis._ReactDOMClient,
  },
  findComponent(name: string, _all = false, _filter?: TautAPI__filter) {
    // TODO: support _all and _filter
    return react.tryFindReactComponent(name);
  },
  patchComponent(matcher, replacement) {
    // TODO: support non-string matchers
    if (typeof matcher !== "string")
      return () => {};
    return react.patchComponent(matcher, replacement as any);
  },
} satisfies TautAPI;

// Translated from Jeremy's taut

export type TautPluginConfig = { enabled: boolean; } & Record<string, unknown>;
export type TautConfig = {
  plugins: Record<string, TautPluginConfig | undefined>;
};

// Straight from Jeremy's taut

/**
 * Abstract base class that all Taut plugins must extend.
 * Plugins are instantiated in the browser context with access to the TautAPI.
 */
export abstract class TautPlugin {
  /** The display name of the plugin. */
  abstract name: string
  /** A short description of the plugin in mrkdwn format. */
  abstract description: string
  /** The authors of the plugin in mrkdwn format, using <@user_id> syntax. */
  abstract authors: string

  /**
   * @param api - The TautAPI instance for plugin communication
   * @param config - The plugin's configuration from config.jsonc
   */
  constructor(
    protected api: TautAPI,
    protected config: TautPluginConfig
  ) {}

  /**
   * Called when the plugin should start.
   * Subclasses must implement this method.
   */
  abstract start(): void

  /**
   * Called when the plugin should stop and clean up.
   * Subclasses should override this to perform cleanup.
   */
  stop(): void {
    // Default implementation does nothing
  }

  /**
   * Log a message with the plugin's name prefix.
   * @param args - Something to log
   */
  protected log = this._log.bind(this)
  protected _log(...args: any[]) {
    console.log(`[Rope-compat-Taut] [${this.constructor.name}]`, ...args)
  }
}

export default TautPlugin
export type TautPluginConstructor = new (
  api: TautAPI,
  config: TautPluginConfig
) => TautPlugin

// my stuff - manage and load Taut plugins

export let __tautPlugins = new Map<string, TautPlugin>();

if (globalThis.__tautPlugins)
  __tautPlugins = globalThis.__tautPlugins;

export function startTautPlugin(pc: TautPluginConstructor, config: TautPluginConfig) {
  if (__tautPlugins.has(pc.name))
    return;
  const p = new pc(globalThis.TautAPI, config);
  console.log(`[Rope-compat-taut] Loaded plugin ${pc.name} with config:`);
  console.log(config);
  __tautPlugins.set(pc.name, p);
  p.start();
  /* hoist its info if there is a registration */
  if (__tautPluginRegistry.has(pc.name)) {
    const r = __tautPluginRegistry.get(pc.name);
    r.meta = {
      name: p.name,
      description: p.description,
      authors: p.authors,
    };
  }
}

export function stopTautPlugin(name: string) {
  const p = __tautPlugins.get(name);
  if (!p)
    return;
  console.log(`[Rope-compat-taut] Unloading plugin ${p.constructor.name}`);
  p.stop();
  __tautPlugins.delete(name);
}

export type TautPluginRegistration = {
  name: string;
  config: TautPluginConfig;
  constructor: TautPluginConstructor;
  meta?: {
    name: string;
    description: string;
    authors: string;
  };
};

// plugin manager
export let __tautPluginRegistry = new Map<string, TautPluginRegistration>();

if (globalThis.__tautPluginRegistry)
  __tautPluginRegistry = globalThis.__tautPluginRegistry;

export function registerTautPlugin(pc: TautPluginConstructor, config: TautPluginConfig) {
  const r = {
    name: pc.name,
    config,
    constructor: pc,
  };
  __tautPluginRegistry.set(r.name, r);
  if (r.config.enabled)
    startTautPlugin(r.constructor, r.config);
}

export function registerGetTautPluginConfig(name: string): TautPluginConfig | null {
  const k = `taut-plugin-config-${name}`;
  const s = localStorage.getItem(k);
  if (!s)
    return null;
  return JSON.parse(s);
}

export function registerSetTautPluginConfig(name: string, config: TautPluginConfig) {
  const k = `taut-plugin-config-${name}`;
  localStorage.setItem(k, JSON.stringify(config));

  /* reload if needed */
  const r = __tautPluginRegistry.get(name);
  if (!r)
    return;
  const oldConfig = r.config;
  if (oldConfig !== config) {
    r.config = config;
  }
  if (config.enabled) {
    startTautPlugin(r.constructor, r.config);
  } else if (!config.enabled) {
    stopTautPlugin(r.name);
  }
}

export function registerModifyTautPluginConfig(name: string, mod: (c: TautPluginConfig) => TautPluginConfig) {
  const c = registerGetTautPluginConfig(name);
  if (!c)
    return;
  registerSetTautPluginConfig(name, mod(c));
}

export function registerPersistedTautPlugin(pc: TautPluginConstructor, defaultConfig: TautPluginConfig) {
  let c = registerGetTautPluginConfig(pc.name);
  if (!c) {
    c = defaultConfig;
    registerSetTautPluginConfig(pc.name, c);
  }
  registerTautPlugin(pc, c);
}

export function registerStopTautPlugin(name: string) {
  registerModifyTautPluginConfig(name, (c) => ({...c, enabled: false}));
}

export function registerStartTautPlugin(name: string) {
  registerModifyTautPluginConfig(name, (c) => ({...c, enabled: true}));
}

/* expose on window */
let o = {
  __tautPlugins,
  startTautPlugin,
  stopTautPlugin,
  __tautPluginRegistry,
  registerTautPlugin,
  registerStartTautPlugin,
  registerStopTautPlugin,
};

for (const [k, v] of Object.entries(o)) {
  globalThis[k] = v;
}
