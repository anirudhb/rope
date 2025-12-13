import "./slack";
import * as taut from "./taut";
import initMenu from "./plugins/menu";

import PrivateChannel from "./plugins/taut/PrivateChannel";
import InvisibleForward from "./plugins/taut/InvisibleForward";
import IdvStatus from "./plugins/taut/IdvStatus";
import Oneko from "./plugins/taut/Oneko";
import ShinigamiEyes from "./plugins/taut/ShinigamiEyes";

// init menu
initMenu();

/* initialize plugins */
const plugins: [taut.TautPluginConstructor, taut.TautPluginConfig | null][] = [
  // order probably matters, but shrug
  [PrivateChannel, null],
  [InvisibleForward, null],
  [IdvStatus, null],
  [Oneko, null],
  [ShinigamiEyes, null],
];

for (const [pc, c] of plugins) {
  const c2 = c === null ? { enabled: false } : c;
  taut.registerPersistedTautPlugin(pc, c2);
}
