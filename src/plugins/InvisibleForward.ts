/** Like Taut's InvisibleForward, but patches at the message level, so it works all the time. */
import { wirePlugin } from "../plugins";

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

export default wirePlugin({
  chatPostMessageI: (m: any) => m?.meta?.name === "chatPostMessage",
}, {
  id: "InvisibleForward",
  meta: {
    name: "Invisible Forward",
    description: "Makes Slack links at the start of your messages invisible, like a forwarded message, based on <@U07FXPUDYDC><https://greasyfork.org/en/scripts/526439-forward-slack-messages-files-and-later-items-to-channels-and-threads-using-an-invisible-link|'s userscript>. Also based on <@U06UYA5GMB5>'s original Taut plugin. Works whether or not the rich text editor is enabled!",
    authors: "<@U01D9DWGEB0>",
  },
  init(_api, { chatPostMessageI }) {
    return {
      modules: [{
        exportId: chatPostMessageI,
        debugName: "invisibleforward-chatpostmessage-patch",
        patch: (_require, orig) => {
          return function(arg: any) {
            if (arg?.message && arg.message.blocks) {
              for (const b of arg.message.blocks)
                if (b?.type === "rich_text")
                  for (const e of b?.elements)
                    if (e?.type === "rich_text_section")
                      for (const e2 of e?.elements)
                        if (e2?.type === "link" && isSlackUrl(e2?.url))
                          e2.text = "\u2060";
            }
            return orig(arg);
          };
        },
      }],
      components: [],
    };
  },
});
