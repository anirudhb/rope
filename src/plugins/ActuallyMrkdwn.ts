/** Actual (subset of) mrkdwn support */
import { wirePlugin } from "../plugins";
import * as chrono from "chrono-node";

type RichTextElementStyle = {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  highlight?: boolean;
  client_highlight?: boolean;
  underline?: boolean;
};

type RichTextElement = ({
  style?: RichTextElementStyle;
} & ({
  type: "broadcast";
  range: "here" | "channel" | "everyone";
} | {
  type: "color";
  value: string;
} | {
  type: "channel";
  channel_id: string;
} | {
  type: "date";
  timestamp: number;
  format: string;
  url?: string;
  fallback?: string;
} | {
  type: "link";
  url: string;
  text?: string;
  unsafe?: boolean;
} | {
  type: "text";
  text: string;
} | {
  type: "user";
  user_id: string;
} | {
  type: "usergroup";
  usergroup_id: string;
})) | {
  type: "emoji";
  name: string;
  unicode?: string;
};

function processMrkdwnInRichTextElements(elements: RichTextElement[]): RichTextElement[] {
  let out: RichTextElement[] = [];
  let queue: RichTextElement[] = [...elements];

  while (queue.length) {
    const el = queue.shift()!;
    if (el.type !== "text") {
      out.push(el);
      continue;
    }

    /* Segment and push items back on the queue */
    let didSegment = false;
    const t = el.text;
    let m: RegExpMatchArray;

    // Channel syntax
    if ((m = /<#(?<cid>[A-Z0-9]+)>/g.exec(t)!) !== null) {
      const channel_id = m.groups!.cid;
      const before = t.slice(0, m.index);
      const after = t.slice(m.index!+m[0].length);
      didSegment = true;
      queue.unshift({
        ...el,
        text: before,
      }, {
        type: "channel",
        channel_id,
        style: el.style,
      }, {
        ...el,
        text: after,
      });
    }
    // Allow one rule to match at a time
    if (didSegment) continue;

    // User syntax
    if ((m = /<@(?<uid>[A-Z0-9]+)>/g.exec(t)!) !== null) {
      const user_id = m.groups!.uid;
      const before = t.slice(0, m.index);
      const after = t.slice(m.index!+m[0].length);
      didSegment = true;
      queue.unshift({
        ...el,
        text: before,
      }, {
        type: "user",
        user_id,
        style: el.style,
      }, {
        ...el,
        text: after,
      });
    }
    // Allow one rule to match at a time
    if (didSegment) continue;

    // User group syntax
    if ((m = /<!subteam\^(?<gid>[A-Z0-9]+)>/g.exec(t)!) !== null) {
      const usergroup_id = m.groups!.gid;
      const before = t.slice(0, m.index);
      const after = t.slice(m.index!+m[0].length);
      didSegment = true;
      queue.unshift({
        ...el,
        text: before,
      }, {
        type: "usergroup",
        usergroup_id,
        style: el.style,
      }, {
        ...el,
        text: after,
      });
    }
    // Allow one rule to match at a time
    if (didSegment) continue;

    // Special mentions
    for (const [re, typ] of [
      [/<!here>/g, "here"],
      [/<!channel>/g, "channel"],
      [/<!everyone>/g, "everyone"],
    ] as const) {
      if ((m = re.exec(t)!) !== null) {
        const before = t.slice(0, m.index);
        const after = t.slice(m.index!+m[0].length);
        didSegment = true;
        queue.unshift({
          ...el,
          text: before,
        }, {
          type: "broadcast",
          range: typ,
          style: el.style,
        }, {
          ...el,
          text: after,
        });
      }
      // Allow one rule to match at a time
      if (didSegment) continue;
    }

    // Dates
    // FIXME: support easier formatting for date timestamps
    if ((m = /<!date\^(?<timestamp>[0-9]+|\{[^}]+\})\^(?<tstr>[^\^|>]+)(?:\^(?<url>[^|>]+))?(?:|(?<fb>[^>]+))?>/g.exec(t)!) !== null) {
      let ts: number = NaN;
      try {
        ts = parseInt(m.groups!.timestamp, 10);
      } catch {}
      if (Number.isNaN(ts)) {
        try {
          const d = chrono.parseDate(m.groups!.timestamp.slice(1, -1));
          if (d !== null) {
            ts = Math.floor(d.getTime() / 1000);
          } else {
            continue;
          }
        } catch {
          continue;
        }
      }
      const before = t.slice(0, m.index);
      const after = t.slice(m.index!+m[0].length);
      didSegment = true;
      queue.unshift({
        ...el,
        text: before,
      }, {
        type: "date",
        timestamp: ts,
        format: m.groups!.tstr,
        url: m.groups!.url,
        fallback: m.groups!.fallback,
        style: el.style,
      }, {
        ...el,
        text: after,
      });
    }
    // Allow one rule to match at a time
    if (didSegment) continue;

    if (!didSegment) {
      // Resolve escapes when not segmented
      const t2 = t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      out.push({
        ...el,
        text: t2,
      });
    }
  }

  // Remove empty text blocks
  return out.filter(el => el.type !== "text" || el.text.length);
}

export default wirePlugin({
  chatPostMessageI: (m: any) => m?.meta?.name === "chatPostMessage",
}, undefined, {
  id: "ActuallyMrkdwn",
  meta: {
    name: "Actually Mrkdwn",
    description: "Implements a subset of Slack's <https://docs.slack.dev/messaging/formatting-message-text|mrkdwn> syntax",
    authors: "<@U01D9DWGEB0>",
  },
  init(_api, { chatPostMessageI }) {
    return {
      modules: [{
        exportId: chatPostMessageI,
        debugName: "actuallymrkdwn-chatpostmessage-patch",
        patch: (_require, orig) => {
          const f = function(arg: any) {
            if (arg?.message && arg.message.blocks) {
              _api.log(arg.message);
              for (const b of arg.message.blocks)
                if (b?.type === "rich_text")
                  for (const e of b?.elements)
                    if (e?.type === "rich_text_section" && e?.elements && Array.isArray(e?.elements))
                      e.elements = processMrkdwnInRichTextElements(e.elements);
              _api.log("Processed");
              _api.log(arg.message);
            }
            return orig(arg);
          };
          f.meta = { name: "chatPostMessage" };
          return f;
        },
      }],
      components: [],
    };
  },
});
