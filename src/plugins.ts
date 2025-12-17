/** Plugin loader and manager */
import * as webpack from "jspatching/webpack";
import * as react from "jspatching/react";
import * as redux from "jspatching/redux";
import * as slack from "./slack"
import type { RopePlugin } from "./api";

/* convenient */
export type { RopePlugin } from "./api";

export type RopePluginRegistration = {
  plugin: RopePlugin;
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
 * Hooks sets to the given object and persists them to localStorage under the given key
 */
function localStorageProxy(key: string, obj: any): any {
  return new Proxy(obj, {
    set(target, p, newValue, _receiver) {
      const r = Reflect.set(target, p, newValue);
      localStorage.setItem(key, JSON.stringify(target));
      return r;
    },
  });
}

/* creates the info if it does not exist */
function getPersistedRopePluginInfo(id: string): PersistedRopePluginInfo {
  const k = `rope-plugin-info-${id}`;
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

function createRopePluginAPI(id: string) {
  const log = (...args: any[]) => {
    return console.log(`[Rope-plugins] [${id}]`, ...args);
  };
  return {
    webpack,
    react,
    redux,
    slack,
    log,
  };
}

export function startRopePlugin(id: string) {
  const p = __ropePluginRegistry.get(id);
  if (!p)
    return;
  /* destroy old plugin */
  p.destroy?.();

  const info = getPersistedRopePluginInfo(id);
  /* create api */
  const api = createRopePluginAPI(id);
  p.destroy = p.plugin.init(api, info.config);
}

export function stopRopePlugin(id: string) {
  const p = __ropePluginRegistry.get(id);
  if (!p)
    return;
  p.destroy();
  p.destroy = null;
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
    if (info.enabled)
      startRopePlugin(id);
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
  __ropePluginRegistry,
  registerRopePlugin,
  startRopePlugin,
  stopRopePlugin,
  getRopePluginEnabled,
  setRopePluginEnabled,
  startConfiguredRopePlugins,
  setRopePluginConfig,
};

for (const [k, v] of Object.entries(o)) {
  globalThis[k] = v;
}
