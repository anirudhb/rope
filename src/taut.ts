/** Exposes a Taut-compatible API on globalThis */
import * as webpack from "jspatching/webpack";
import * as react from "jspatching/react";
import type { RopeAPI, RopePlugin } from "./api";

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

export function adaptRopeAPIToTaut(ropeApi: RopeAPI): TautAPI {
  return {
    setStyle(key, css) {
      const i = styleElementIdPrefix + key;
      let e: HTMLElement | null = null;
      if ((e = document.getElementById(i)) !== null) {
        e.textContent = css;
      } else {
        e = document.createElement("style");
        e.textContent = css;
        /* body may not exist when running super-early */
        if (!document.body)
          document.querySelector("html").appendChild(document.createElement("body"));
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
      const r = ropeApi.webpack.tryFindWebpackExport(filter, all);
      if (!r)
        return null;
      if (!Array.isArray(r))
        return r.export;
      return r.map(x=>x.export);
    },
    findByProps(props: string[], all = false) {
      const r = ropeApi.webpack.tryFindWebpackExport(m => {
        const ks = Object.keys(m);
        for (const k of ks)
          if (props.includes(k))
            return true;
        return false;
      }, all);
      if (!r)
        return null;
      if (!Array.isArray(r))
        return r.export;
      return r.map(x=>x.export);
    },
    commonModules: {
      React: globalThis.React as any,
      ReactDOM: globalThis._ReactDOM,
      ReactDOMClient: globalThis._ReactDOMClient,
    },
    findComponent(name: string, _all = false, _filter?: TautAPI__filter) {
      // FIXME: slow?
      return ropeApi.react.virtualComponent(name);
    },
    patchComponent(matcher, replacement) {
      // TODO: support non-string matchers
      if (typeof matcher !== "string")
        return () => {};
      return ropeApi.react.patchComponent(matcher, replacement as any);
    },
  };
}

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

// plugin adapter

export function adaptTautPlugin(pc: TautPluginConstructor): RopePlugin {
  /* instantiate once to get meta */
  let p = new pc({} as any, null);
  const meta = {
    name: `[Rope-compat-taut] ${p.name}`,
    description: p.description,
    authors: p.authors,
  };

  const init = (api: RopeAPI, config: any) => {
    const tautAPI = adaptRopeAPIToTaut(api);
    const plugin = new pc(tautAPI, {
      ...(config ?? {}),
      enabled: true,
    });
    plugin.start();
    return () => plugin.stop();
  };

  return {
    id: `tautCompat-${pc.name}`,
    meta,
    init,
  };
}

/* expose on window */
let o = {
  adaptRopeAPIToTaut,
  adaptTautPlugin,
};

for (const [k, v] of Object.entries(o)) {
  globalThis[k] = v;
}
