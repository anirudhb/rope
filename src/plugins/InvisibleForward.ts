/** Like Taut's InvisibleForward, but patches at the message level, so it works all the time. */
import type { RopeAPI, RopePlugin, RopePluginInit } from "../api";

/* From Taut's InvisibleForward */
function isSlackUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.hostname === 'app.slack.com') return true
    if (parsedUrl.hostname === 'files.slack.com') return true
    if (
      parsedUrl.hostname === 'slack.com' ||
      parsedUrl.hostname.endsWith('.slack.com')
    ) {
      if (parsedUrl.pathname.startsWith('/archives/')) return true
      if (parsedUrl.pathname.startsWith('/files/')) return true
      if (parsedUrl.pathname.startsWith('/docs/')) return true
      if (parsedUrl.pathname.startsWith('/team/')) return true
      if (parsedUrl.pathname.startsWith('/shortcuts/')) return true
      if (parsedUrl.pathname.startsWith('/huddle/')) return true
    }
  } catch {}
  return false
}

const init: RopePluginInit = (api: RopeAPI) => {
  const deinitCallbacks = [];

  const { pre, post } = api.webpack.earlyPopulatePrettyWebpackExport("actionCreators::chatPostMessage", m => m?.meta?.name === "chatPostMessage");
  post(i => {
    const unpatchChatPostMessage = api.webpack.insertWebpackPatch(i, "InvisibleForward2", (orig) => (arg: any) => {
      //api.log("chatPostMessage called with original arg", arg);
      if (arg?.message && arg.message.blocks) {
        // patch
        for (const b of arg.message.blocks)
          if (b?.type === "rich_text")
            for (const e of b?.elements)
              if (e?.type === "rich_text_section")
                for (const e2 of e?.elements)
                  if (e2?.type === "link" && isSlackUrl(e2?.url))
                    e2.text = "\u2060";
        //api.log("patched message", arg);
      }
      return orig(arg);
    });

    deinitCallbacks.push(unpatchChatPostMessage);
  });
  return () => {
    for (const cb of deinitCallbacks)
      cb();
  };
};

export default {
  id: "InvisibleForward",
  meta: {
    name: "Invisible Forward",
    description: "Makes Slack links at the start of your messages invisible, like a forwarded message, based on <@U07FXPUDYDC><https://greasyfork.org/en/scripts/526439-forward-slack-messages-files-and-later-items-to-channels-and-threads-using-an-invisible-link|'s userscript>. Also based on <@U06UYA5GMB5>'s original Taut plugin. Works whether or not the rich text editor is enabled!",
    authors: "<@U01D9DWGEB0>",
  },
  init,
} satisfies RopePlugin;
