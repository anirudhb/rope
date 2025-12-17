/** Plugin loader and manager */
import * as webpack from "jspatching/webpack";
import * as react from "jspatching/react";
import * as redux from "jspatching/redux";
import * as slack from "./slack"
import type { RopeAPI, RopePlugin } from "./api";

/* convenient */
export type { RopePlugin } from "./api";

export type RopePluginRegistration = {
  plugin: RopePlugin & {
    defaultConfig?: any;
  };
  /* when not null, plugin is loaded */
  destroy?: () => void;
};

type PersistedRopePluginInfo = {
  id: string;
  enabled: boolean;
  config?: any;
};

export let __ropePluginRegistry = new Map<string, RopePluginRegistration>();

if (globalThis.__ropePluginRegistry)
  __ropePluginRegistry = globalThis.__ropePluginRegistry;

export function registerRopePlugin<C = any>(plugin: RopePlugin<C>) {
  if (__ropePluginRegistry.has(plugin.id))
    console.log(`[Rope] warning: overriding existing plugin registration for ${plugin.id}`);
  __ropePluginRegistry.set(plugin.id, {
    plugin,
    destroy: null,
  });
}

/**
 * Hooks sets to the given object and persists them to localStorage under the given key.
 * Note!! This only stores sets as a convenience. The object should not be assumed to have live data.
 */
function localStorageProxy<T = any>(key: string, obj: T): T {
  return new Proxy(obj as any, {
    set(target, p, newValue_, _receiver) {
      const oldValue = JSON.stringify(target);
      const r = Reflect.set(target, p, newValue_);
      const newValue = JSON.stringify(target);
      localStorage.setItem(key, newValue);
      /* FIXME: bad? */
      window.dispatchEvent(new StorageEvent("storage", {
        key,
        oldValue,
        newValue,
      }));
      return r;
    },
  });
}

function getPersistedRopePluginInfoKey(id: string): string {
  return `rope-plugin-info-${id}`;
}

/* creates the info if it does not exist */
function getPersistedRopePluginInfo(id: string): PersistedRopePluginInfo {
  const k = getPersistedRopePluginInfoKey(id);
  if (!(k in localStorage)) {
    const o = {
      id,
      enabled: false,
      config: null,
    };
    localStorage.setItem(k, JSON.stringify(o));
    return localStorageProxy(k, o);
  } else {
    const o = JSON.parse(localStorage.getItem(k));
    return localStorageProxy(k, o);
  }
}

/* React hook for localStorage JSON */
function useLocalStorage<T>(key: string): [T, (x: T) => void] {
  const [value, setValue] = globalThis.React.useState(() => JSON.parse(localStorage.getItem(key)));

  function listener(e: StorageEvent) {
    if (e.key === key)
      setValue(JSON.parse(localStorage.getItem(key)));
  }

  globalThis.React.useEffect(() => {
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  return [value, (x) => {
    const oldValue = JSON.stringify(value);
    //if (typeof x === "function")
    //  x = x(value);
    const newValue = JSON.stringify(x);
    /* set the value on localStorage then emit a storage event */
    localStorage.setItem(key, newValue);
    window.dispatchEvent(new StorageEvent("storage", {
      key,
      oldValue,
      newValue,
    }));
  }];
}

const selfExports: typeof import("./plugins") = {
  __ropePluginRegistry,
  registerRopePlugin,
  startRopePlugin,
  stopRopePlugin,
  getRopePluginEnabled,
  setRopePluginEnabled,
  startConfiguredRopePlugins,
  setRopePluginConfig,
};

function createRopePluginAPI(id: string): RopeAPI {
  const log = (...args: any[]) => console.log(`[Rope-plugins] [${id}]`, ...args);
  return {
    webpack,
    react,
    redux,
    slack,
    plugins: selfExports,
    log,
    usePluginConfig: (getter = (c) => c, setter = (_c, x) => x) => {
      const k = getPersistedRopePluginInfoKey(id);
      const [info, setInfo] = useLocalStorage<PersistedRopePluginInfo>(k);
      const value = globalThis.React.useMemo(() => getter(info.config), [info]);

      return [value, (x) => setInfo({
        ...info,
        config: setter(info.config, x),
      })];
    },
  };
}

export function startRopePlugin(id: string) {
  const p = __ropePluginRegistry.get(id);
  if (!p)
    return;
  /* destroy old plugin */
  if (p.destroy) {
    console.log(`[Rope] stopping old plugin for ${id}`);
    p.destroy();
  }

  const info = getPersistedRopePluginInfo(id);
  if (info.config === null && p.plugin.defaultConfig)
    info.config = p.plugin.defaultConfig;
  /* create api */
  const api = createRopePluginAPI(id);
  p.destroy = p.plugin.init(api, info.config);
  console.log(`[Rope] started plugin ${id}`);
}

export function stopRopePlugin(id: string) {
  const p = __ropePluginRegistry.get(id);
  if (!p)
    return;
  p.destroy();
  p.destroy = null;
  console.log(`[Rope] stopped plugin ${id}`);
}

export function getRopePluginEnabled(id: string): boolean {
  return getPersistedRopePluginInfo(id).enabled;
}

export function setRopePluginEnabled(id: string, enabled: boolean, syncRunning: boolean = true) {
  const p = __ropePluginRegistry.get(id);
  if (!p)
    return;
  const info = getPersistedRopePluginInfo(id);
  info.enabled = enabled;
  console.log(`[Rope] set plugin ${id} to enabled: ${enabled}`);

  if (syncRunning) {
    if (enabled && !p.destroy)
      startRopePlugin(id);
    else if (!enabled && p.destroy)
      stopRopePlugin(id);
  }
}

/**
 * Starts plugins whose persisted info indicates they are enabled
 */
export function startConfiguredRopePlugins() {
  for (const id of __ropePluginRegistry.keys()) {
    const info = getPersistedRopePluginInfo(id);
    if (info.enabled) {
      console.log(`[Rope] starting configured plugin ${id}`);
      startRopePlugin(id);
    }
  }
}

export function setRopePluginConfig(id: string, config: any, restart: boolean = true) {
  const info = getPersistedRopePluginInfo(id);
  info.config = config;
  if (restart) {
    const p = __ropePluginRegistry.get(id);
    if (!p)
      return;
    /* restart if running */
    if (p.destroy)
      startRopePlugin(id);
  }
}

/* expose on window */
let o = {
  ...selfExports,
  localStorageProxy,
  getPersistedRopePluginInfoKey,
  getPersistedRopePluginInfo,
};

for (const [k, v] of Object.entries(o)) {
  globalThis[k] = v;
}
