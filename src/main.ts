import "./slack";
import * as plugins from "./plugins";
import * as taut from "./taut";

import menuPlugin from "./plugins/menu";

import PrivateChannel from "./plugins/taut/PrivateChannel";
import InvisibleForward from "./plugins/taut/InvisibleForward";
import IdvStatus from "./plugins/taut/IdvStatus";
import Oneko from "./plugins/taut/Oneko";
import ShinigamiEyes from "./plugins/taut/ShinigamiEyes";

/* initialize rope plugins */
const ropePlugins: plugins.RopePlugin[] = [
  menuPlugin,
];

for (const p of ropePlugins)
  plugins.registerRopePlugin(p);

// ensure menu is enabled
plugins.setRopePluginEnabled(menuPlugin.id, true, false);

/* initialize taut plugins */
const tautPlugins: taut.TautPluginConstructor[] = [
  // order probably matters, but shrug
  PrivateChannel,
  InvisibleForward,
  IdvStatus,
  Oneko,
  ShinigamiEyes,
];

for (const pc of tautPlugins) {
  const ropePlugin = taut.adaptTautPlugin(pc);
  plugins.registerRopePlugin(ropePlugin);
}

/* start plugins */
plugins.startConfiguredRopePlugins();
