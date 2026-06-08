/** Plugin loader and manager */
import * as webpack from "jspatching/webpack";
import * as react from "jspatching/react";
import type { RopeAPI, RopePlugin } from "./api";
import { hashWebpackMatchers, lookupWebpackModulesBulk } from "./patch";

/* convenient */
export type { RopePlugin } from "./api";

const chunkName = "webpackChunkwebapp";

export function wirePlugin<
  const I extends Record<string, webpack.WebpackMatcher>,
  const P extends Omit<RopePlugin<C, I>, "imports" | "defaultConfig">,
  const C,
>(i: I, d: C, p: P): RopePlugin<C, I> {
  return ({ ...p, imports: i, defaultConfig: d }) as any;
}

type PersistedRopePluginInfo = {
  id: string;
  enabled: boolean;
  config?: any;
};

export let __ropePluginRegistry = new Map<string, RopePlugin & { defaultConfig?: any; }>();

if ((globalThis as any).__ropePluginRegistry)
  __ropePluginRegistry = (globalThis as any).__ropePluginRegistry;

export function registerRopePlugin<C = any>(plugin: RopePlugin<C>) {
  if (__ropePluginRegistry.has(plugin.id))
    console.log(`[Rope] warning: overriding existing plugin registration for ${plugin.id}`);
  __ropePluginRegistry.set(plugin.id, plugin);
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
export function getPersistedRopePluginInfo(id: string): PersistedRopePluginInfo {
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
    const o = JSON.parse(localStorage.getItem(k)!);
    return localStorageProxy(k, o);
  }
}

/* React hook for localStorage JSON */
function useLocalStorage<T>(React: typeof import("react"), key: string): [T, (x: T) => void] {
  const [value, setValue] = React.useState(() => JSON.parse(localStorage.getItem(key)!));

  function listener(e: StorageEvent) {
    if (e.key === key)
      setValue(JSON.parse(localStorage.getItem(key)!));
  }

  React.useEffect(() => {
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
  wirePlugin,
  getPersistedRopePluginInfo,
  registerRopePlugin,
  createRopePluginAPI,
  getRopePluginEnabled,
  setRopePluginEnabled,
  setRopePluginConfig,
  getCachedExportIds,
  refreshCachedExportIds,
};

export function createRopePluginAPI<C = undefined>(id: string): RopeAPI<C> {
  const log = (...args: any[]) => console.log(`[Rope-plugins] [${id}]`, ...args);
  return {
    webpack,
    react,
    plugins: selfExports,
    log,
    id,
    getPluginConfig: () => {
      const k = getPersistedRopePluginInfo(id);
      return k.config;
    },
    setPluginConfig: c => {
      const k = getPersistedRopePluginInfo(id);
      if (typeof c === "function") {
        c = (c as any)(k.config) as C;
      }
      k.config = c;
    },
    usePluginConfig: (React, getter = (c) => c as any, setter = (_c, x) => x as any) => {
      const k = getPersistedRopePluginInfoKey(id);
      const [info, setInfo] = useLocalStorage<PersistedRopePluginInfo>(React, k);
      const value = React.useMemo(() => getter(info.config), [info]);

      return [value, (x) => setInfo({
        ...info,
        config: setter(info.config, x),
      })];
    },
  };
}

export function getRopePluginEnabled(id: string): boolean {
  return getPersistedRopePluginInfo(id).enabled;
}

export function setRopePluginEnabled(id: string, enabled: boolean) {
  const p = __ropePluginRegistry.get(id);
  if (!p)
    return;
  const info = getPersistedRopePluginInfo(id);
  info.enabled = enabled;
  console.log(`[Rope] set plugin ${id} to enabled: ${enabled}`);
}

export function setRopePluginConfig(id: string, config: any) {
  const info = getPersistedRopePluginInfo(id);
  info.config = config;
}

function getCachedExportMatchers(): Record<string, Record<string, webpack.WebpackMatcher>> {
  const x1 = Object.fromEntries([...__ropePluginRegistry.entries()]
    .filter(([id, _]) => getRopePluginEnabled(id))
    .map(([id, m]) => [id, m.imports]));
  return {
    ...x1,
    rope: { React: (() => {
      let x = react.ReactMatcher;
      (x as any).all = true;
      return x;
    })(), ReactJsx: (() => {
      let x = react.ReactJsxMatcher;
      (x as any).all = true;
      return x;
    })(), },
  };
}

export function getCachedExportIds(): Record<string, Record<string, webpack.WebpackExportId | webpack.WebpackExportId[]>> | null {
  const matchers = getCachedExportMatchers();
  const key = `rope-cached-export-ids-${hashWebpackMatchers(matchers)}`;
  const i = localStorage.getItem(key);
  if (i)
    return JSON.parse(i);
  else
    return null;
}

export function refreshCachedExportIds() {
  webpack._3type_clearWebpackRequire(chunkName);
  const matchers = getCachedExportMatchers();
  const key = `rope-cached-export-ids-${hashWebpackMatchers(matchers)}`;
  const ids = lookupWebpackModulesBulk(chunkName, matchers);
  /* Delete existing keys */
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith("rope-cached-export-ids-")) {
      localStorage.removeItem(k);
    }
  }
  localStorage.setItem(key, JSON.stringify(ids));
}

/* expose on window */
let o = {
  ...selfExports,
  localStorageProxy,
  getPersistedRopePluginInfoKey,
};

for (const [k, v] of Object.entries(o)) {
  (globalThis as any)[k] = v;
}
