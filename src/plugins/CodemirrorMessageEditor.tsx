import type { RopeAPI, RopePlugin, RopePluginInit } from "../api";

import { EditorView, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { EditorState, Compartment, SelectionRange } from "@codemirror/state";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { createHighlighterCore, type HighlighterCore } from "shiki";
// TODO: investigate precompiled languages, https://shiki.style/guide/regex-engines#pre-compiled-languages
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import shiki from "codemirror-shiki";

import { evaluateSync } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";

import type Quill from "quill";
import { type Delta, type Range } from "quill";

/* MDX stuff */

let _shim_Fragment = Symbol.for("_shim_Fragment");

function myJsx(type, props, key = undefined) {
  return {
    type,
    props,
    key,
  };
}

let _shim_Fundamental = Symbol.for("_shim_Fundamental");
let _shim_FundamentalLate = Symbol.for("_shim_FundamentalLate");

let _shim_Blocks = Symbol.for("_shim_Blocks");

let _shim_ContextKey = Symbol.for("_shim_ContextKey");
let _shim_IsBlockKey = Symbol.for("_shim_IsBlockKey");
let _shim_IsRichTextSubsectionKey = Symbol.for("_shim_IsRichTextSubsectionKey");

let _shim_IsSectionLikeComponent = Symbol.for("_shim_IsSectionLikeComponent");
let _shim_IsBlockLikeComponent = Symbol.for("_shim_IsBlockLikeComponent");

type Context = {
  unfurlUrls: Set<string>;
};

function makeContext(): Context {
  return {
    unfurlUrls: new Set(),
  };
}

/* Renders blocks */
function renderShimJsxBlocks(ctx: Context, tree: any) {
  if (tree.type === _shim_Blocks) {
    /* render blocks inside and VALIDATE */
    const children = Array.isArray(tree.props.children) ? tree.props.children : [tree.props.children];
    const renderedChildren = children.map(c => renderShimJsxBlocks(ctx, c)).flat(Infinity);
    for (const cx of renderedChildren)
      if (cx[_shim_IsBlockKey] !== true)
        throw new Error(`Blocks child was not a block! Got ${cx}`);
    return renderedChildren;
  }
  const props2 = {
    ...(tree.props ?? {}),
    [_shim_ContextKey]: ctx,
  };
  if (typeof tree.type === "function")
    return renderShimJsxBlocks(ctx, tree.type(props2));
  return tree;
}

/* Renders rich text subsections */
function renderShimJsxRichTextSubsection(ctx: Context, tree: any) {
  const props2 = {
    ...(tree.props ?? {}),
    [_shim_ContextKey]: ctx,
  };
  if (typeof tree.type === "function")
    return tree.type(props2);
  throw new Error(`rich_text subsection: don't know how to render jsx element of type ${tree.type} ${tree}`);
}

/* Renders a "rich text" section (!!) */
function renderShimJsxRichTextSection(ctx: Context, tree: any) {
  if (typeof tree === "string")
    /* unstyled text element */
    return {
      type: "text",
      text: tree,
    };
  if (tree.type === _shim_Fundamental)
    /* fundamental, passthrough */
    return tree.props;
  if (tree.type === _shim_FundamentalLate) {
    /* late fundamental, render children first */
    const children = renderShimJsxRichTextSection(ctx, myJsx(_shim_Fragment, {
      children: tree.props.children,
    }));
    return tree.props.value(children);
  }
  if (tree.type === _shim_Fragment) {
    if (!tree.props?.children)
      // ???
      return [];
    if (Array.isArray(tree.props.children))
      return tree.props.children.map((c: any) => renderShimJsxRichTextSection(ctx, c));
    return [renderShimJsxRichTextSection(ctx, tree.props.children)];
  }
  const props2 = {
    ...(tree.props ?? {}),
    [_shim_ContextKey]: ctx,
  };
  const builtins = {
    a: Builtin__a,
    p: Builtin__p,
    strong: Builtin__strong,
    em: Builtin__em,
    del: Builtin__del,
    code: Builtin__code,
  };
  if (tree.type in builtins)
    tree.type = builtins[tree.type];
  if (typeof tree.type === "function") {
    /* "component" */
    return renderShimJsxRichTextSection(ctx, tree.type(props2));
  }
  if (tree[_shim_IsRichTextSubsectionKey])
    /* passthrough */
    return tree;
  throw new Error(`renderShimJsxRichTextSection: don't know how to render this jsx component: ${tree.type} with props ${tree.props}`);
}

/* Block/section components */

function Blocks(props) {
  return myJsx(_shim_Blocks, props);
}

function RichText(props) {
  // Render children and check that they are sections
  if (!props.children)
    throw new Error(`RichText requires at least one child`);
  const children = Array.isArray(props.children) ? props.children : [props.children];
  const ctx = props[_shim_ContextKey];
  const renderedChildren = children.map(c => renderShimJsxRichTextSubsection(ctx, c)).flat(Infinity);
  for (const cx of renderedChildren)
    if (!cx[_shim_IsRichTextSubsectionKey])
      throw new Error(`Rich text child was not a valid subsection!`);
  return {
    type: "rich_text",
    elements: renderedChildren,
    [_shim_IsBlockKey]: true,
  };
}
RichText[_shim_IsBlockLikeComponent] = true;

function RichTextSection(props) {
  /* Render children */
  const ctx = props[_shim_ContextKey];
  const renderedChildren = renderShimJsxRichTextSection(ctx, myJsx(_shim_Fragment, {
    children: props.children,
  })).flat(Infinity);
  let out = [];
  let normalChildRun = [];

  function clearRun() {
    out.push({
      type: "rich_text_section",
      elements: normalChildRun,
      [_shim_IsRichTextSubsectionKey]: true,
    });
    normalChildRun = [];
  }

  for (const cx of renderedChildren) {
    if (cx[_shim_IsRichTextSubsectionKey])
      if (props.hoist) {
        clearRun();
        out.push(cx);
      } else
        throw new Error(`rich_text_section: got subsection child ${cx} but not hoisting!`);
    else
      normalChildRun.push(cx);
  }
  clearRun();

  return out;
}
RichTextSection[_shim_IsSectionLikeComponent] = true;

/* built-in components get children rendered as fragment (array) */

function Builtin__a(props) {
  return myJsx(_shim_FundamentalLate, {
    value: children => {
      if (children.length > 1)
        throw new Error("a only accepts up to a single child");
      const child = children[0];
      if (child && child.type !== "text")
        throw new Error("a only accepts a text child");
      if (props?.unfurl !== false)
        (props[_shim_ContextKey] as Context).unfurlUrls.add(props.href);
      return {
        type: "link",
        url: props.href,
        /* for exact linkifys don't duplicate the link twice */
        text: child?.text === props.href ? undefined : child?.text,
        unsafe: props.unsafe,
        style: child?.style,
      };
    },
  });
}

function Builtin__p(props) {
  /* do nothing */
  return myJsx(_shim_FundamentalLate, {
    children: props.children,
    value: children => children,
  });
}

function Builtin__addStyle(name, style, props) {
  return myJsx(_shim_FundamentalLate, {
    children: props.children,
    value: children => children.map(child => ({
      ...child,
      style: {
        ...(child.style ?? {}),
        [style]: true,
      },
    })),
  });
}

function Builtin__strong(props) {
  return Builtin__addStyle("strong", "bold", props);
}

function Builtin__em(props) {
  return Builtin__addStyle("em", "italic", props);
}

function Builtin__del(props) {
  return Builtin__addStyle("del", "strike", props);
}

function Builtin__code(props) {
  return Builtin__addStyle("code", "code", props);
}

/* fundamental custom components */

function Broadcast(props) {
  return myJsx(_shim_Fundamental, {
    type: "broadcast",
    range: props.who,
  });
}

function Color(props) {
  return myJsx(_shim_Fundamental, {
    type: "color",
    value: props.value,
  });
}

function Channel(props) {
  return myJsx(_shim_Fundamental, {
    type: "channel",
    channel_id: props.id,
  });
}

// TODO
//function Date(props) {
//  return myJsx(_shim_Fundamental, {
//    type: "date",
//  });
//}

function Emoji(props) {
  return myJsx(_shim_Fundamental, {
    type: "emoji",
    name: props.name,
  });
}

function User(props) {
  return myJsx(_shim_Fundamental, {
    type: "user",
    user_id: props.id,
  });
}

function Usergroup(props) {
  return myJsx(_shim_Fundamental, {
    type: "usergroup",
    usergroup_id: props.id,
  });
}

function Fundamental(props) {
  return myJsx(_shim_Fundamental, props.raw);
}

function FundamentalLate(props) {
  return myJsx(_shim_FundamentalLate, props);
}

/* "custom" components */

function Unfurl(props) {
  return myJsx("a", {
    ...props,
    children: "\u2060",
  });
}

// TODO: "Mention" component that unifies some of the above

// debug
function _shim_jsx_walk_tree(tree, indent=0, api = null) {
  if (!api)
    api = console;
  if (typeof tree !== "object") {
    api.log(" ".repeat(indent), tree);
    return;
  }
  api.log(" ".repeat(indent), "type:", tree.type, "name:", tree.type?.name);
  api.log(" ".repeat(indent), "key:", tree.key);
  api.log(" ".repeat(indent), "props:", JSON.stringify(tree.props));
  const children = tree.props?.children
    ? Array.isArray(tree.props.children)
      ? tree.props.children
      : [tree.props.children]
    : [];
  for (const c of children) {
    api.log(" ".repeat(indent+1), "child:");
    _shim_jsx_walk_tree(c, indent+2, api);
  }
}

type MDXEvalResult = {
  ctx: Context;
  blocks: any[];
};

// returns context and array of blocks
function evalMdxForSlack(src: string, props = {}): MDXEvalResult {
  /* all in memory so sync should be ok */
  const { default: defaultOut } = evaluateSync(src, {
    format: "mdx",
    Fragment: _shim_Fragment,
    jsx: myJsx,
    jsxs: myJsx,
    useMDXComponents: () => ({
      /* blocks/sections */
      Blocks,
      RichText,
      RichTextSection,
      /* custom/fundamental */
      Broadcast,
      Color,
      Channel,
      Emoji,
      User,
      Usergroup,
      Fundamental,
      FundamentalLate,
      /* custom */
      Unfurl,
    }),
    remarkPlugins: [remarkGfm],
  });
  let jsxTree = defaultOut(props);
  if (jsxTree.type[_shim_IsSectionLikeComponent])
    throw new Error(`Toplevel is a section! Try wrapping it in <RichText /> (or other block) and <Blocks />`);
  if (jsxTree.type[_shim_IsBlockLikeComponent]) {
    jsxTree = myJsx(Blocks, {
      children: jsxTree,
    });
  }
  if (jsxTree.type === _shim_Fragment && jsxTree.props?.children?.[0]?.type?.[_shim_IsBlockLikeComponent]) {
    jsxTree = myJsx(Blocks, {
      children: jsxTree,
    });
  }
  if (jsxTree.type !== Blocks) {
    /* wrap in rich text */
    jsxTree = myJsx(Blocks, {
      children: myJsx(RichText, {
        children: myJsx(RichTextSection, {
          children: jsxTree,
          hoist: true,
        }),
      }),
    });
  }
  //_shim_jsx_walk_tree(jsxTree);
  const ctx = makeContext();
  const res = renderShimJsxBlocks(ctx, jsxTree);
  return {
    ctx,
    blocks: res,
  };
}

function evalMdxForSlackOrGetErrorBlocks(src: string, props = {}): {
  result: MDXEvalResult;
} | {
  error: any[];
} {
  try {
    return {
      result: evalMdxForSlack(src, props),
    };
  } catch (e) {
    return {
      error: [{
        type: "rich_text",
        elements: [{
          type: "rich_text_preformatted",
          elements: [{
            type: "text",
            text: "Failed to render MDX:\n" + e.toString(),
          }],
        }],
      }],
    };
  }
}

/* Shiki stuff */

let highlighter: HighlighterCore | null = null;
/* prevents double initialization */
let inflightHighlighterPromise: Promise<HighlighterCore> | null = null;

async function _highlighterPromise(): Promise<HighlighterCore> {
  if (highlighter)
    return highlighter;
  const h = await createHighlighterCore({
    langs: [
      import("@shikijs/langs/markdown"),
      import("@shikijs/langs/javascript"),
      import("@shikijs/langs/css"),
      import("@shikijs/langs/html"),
      import("@shikijs/langs/tsx"),
      import("@shikijs/langs/mdx"),
    ],
    themes: [
      import("@shikijs/themes/dracula-soft"),
    ],
    engine: createJavaScriptRegexEngine(),
  });
  highlighter = h;
  inflightHighlighterPromise = null;
  return h;
}

function highlighterPromise(): Promise<HighlighterCore> {
  if (inflightHighlighterPromise)
    return inflightHighlighterPromise;
  inflightHighlighterPromise = _highlighterPromise();
  return inflightHighlighterPromise;
}

/* Quill stuff */

/* TODO: roundtrip Quill Deltas <-> MDX */
function adaptDraft(draft: any): string {
  if (!draft)
    return "";
  if (draft.ops.length === 1 && typeof draft.ops[0].insert === "string")
    return draft.ops[0].insert.trim();
  return "{/* Raw Quill draft:\n" + JSON.stringify(draft.ops, null, 2) + "\n*/}";
}

function deltaOpsFromString(s: string, cmExtra: any = true): Delta["ops"] {
  return [
    {
      insert: s,
      attributes: {
        cmExtra,
      },
    },
  ];
}

function cmSelectionToQuillRange(selection: SelectionRange): Range {
  return {
    index: selection.from,
    length: selection.to - selection.from,
  };
}

function shimQuillFromEditorView(editorView: EditorView, historyCompartment: Compartment, shimCompartment: Compartment): {
  /* Real Quill methods */
  blur: Quill["blur"];
  focus: Quill["focus"];
  hasFocus: Quill["hasFocus"];
  container: Quill["container"];
  getSelection: Quill["getSelection"];
  getLength: Quill["getLength"];
  getContents: () => { contents: Delta["ops"] };
  getFormat: Quill["getFormat"];
  on: Quill["on"];
  off: Quill["off"];
  once: Quill["once"];

  /* Slack-specific */
  setCursorAtEnd: () => void;
  maybeTriggerMentionAutocomplete?: () => void;
  clearHistory: () => void;
  clear: () => void;

  /* For us */
  cmExtra?: MDXEvalResult;
} {
  let listeners = {
    "text-change": new Set<Function>(),
    "selection-change": new Set<Function>(),
    "editor-change": new Set<Function>(),
  };

  function addListener(ev: keyof typeof listeners, listener: Function) {
    listeners[ev].add(listener);
  }

  function removeListener(ev: keyof typeof listeners, listener: Function) {
    listeners[ev].delete(listener);
  }

  function notifyListeners(ev: keyof typeof listeners, args: any[]) {
    for (const l of listeners[ev])
      l(...args);
  }

  const shim = {
    /* Quill */
    blur: () => editorView.contentDOM.blur(),
    focus: () => editorView.focus(),
    hasFocus: () => editorView.hasFocus,
    container: editorView.contentDOM.parentElement,
    getSelection: (focus: boolean = false) => {
      if (focus)
        editorView.focus();
      return cmSelectionToQuillRange(editorView.state.selection.main);
    },
    getLength: () => editorView.state.doc.length,
    getContents: (_index?: number, _length?: number) => {
      return { contents: deltaOpsFromString(editorView.state.doc.toString(), shim.cmExtra ?? true) };
    },
    getFormat: (..._args: any[]) => {
      return {};
    },
    // seems like we don't actually need to return Emitters
    on: addListener as any,
    off: removeListener as any,
    once: ((ev, listener) => {
      const listener2 = (...args: any[]) => {
        listener(...args);
        removeListener(ev, listener2);
      };
      return addListener(ev, listener);
    }) satisfies typeof addListener as any,
    /* Slack */
    setCursorAtEnd: () => editorView.dispatch({
      selection: {
        anchor: editorView.state.doc.length,
        head: editorView.state.doc.length,
      },
      effects: EditorView.scrollIntoView(editorView.state.doc.length),
    }),
    maybeTriggerMentionAutocomplete: () => {}, // TODO
    clearHistory: () => {
      // remove history
      editorView.dispatch({
        effects: historyCompartment.reconfigure([]),
      });
      // add history
      editorView.dispatch({
        effects: historyCompartment.reconfigure([history()]),
      });
    },
    clear: () => {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: "",
        },
      });
      shim.cmExtra = null;
    },
    /* custom */
    cmExtra: null,
  };

  // Add listeners
  editorView.dispatch({
    effects: shimCompartment.reconfigure(EditorView.updateListener.of(update => {
      if (update.docChanged) {
        const args = [
          /*delta*/ { ops: deltaOpsFromString(update.state.doc.toString()) },
          /*oldDelta*/ { ops: deltaOpsFromString(update.startState.doc.toString()) },
          /*source*/ "user",
        ];
        notifyListeners("text-change", args);
        notifyListeners("editor-change", args);
      }
      if (update.selectionSet) {
        const args = [
          /*range*/ cmSelectionToQuillRange(update.state.selection.main),
          /*oldRange*/ cmSelectionToQuillRange(update.startState.selection.main),
          /*source*/ "user",
        ];
        notifyListeners("selection-change", args);
        notifyListeners("editor-change", args);
      }
    })),
  });

  return shim;
}

function patchLog(api: RopeAPI, x: (...args: any[]) => any, prefix: string): (...args: any[]) => any {
  return (...args) => {
    api.log(prefix, args);
    return x(...args);
  };
}

/* plugin */

const init: RopePluginInit = (api) => {
  let unpatchers = [];

  const { pre: prePrepareMessage } = api.webpack.earlyPopulatePrettyWebpackExport("prepareMessage", m => m?.meta?.name === "prepareMessage");
  prePrepareMessage(i => {
    const u = api.webpack.insertWebpackPatch(i, "CodemirrorMessageEditor", prepareMessage => (...args: any[]) => {
      api.log(`prepareMessage called with args`, args);
      const delta = args?.[1]?.delta;
      if (delta?.ops?.[0]?.attributes?.cmExtra) {
        api.log(`prepareMessage: passing through cm delta`);
        return {
          processedDelta: delta,
        };
      }
      return prepareMessage(...args);
    });
    unpatchers.push(u);
  });

  const { pre: preConvertDeltaToBlocks } = api.webpack.earlyPopulatePrettyWebpackExport("convertDeltaToBlocks", m => m?.name === "convertDeltaToBlocks");
  preConvertDeltaToBlocks(i => {
    const u = api.webpack.insertWebpackPatch(i, "CodemirrorMessageEditor", convertDeltaToBlocks => (arg: any) => {
      api.log(`convertDeltaToBlocks called with arg`, arg);
      if (arg?.delta?.ops?.[0]?.attributes?.cmExtra) {
        const t = arg.delta.ops[0].insert;
        api.log(`passing through cm text`, t);
        return {
          blocks: [{
            type: "rich_text",
            elements: [{
              type: "rich_text_section",
              elements: [{
                type: "text",
                text: t,
                cmExtra: arg.delta.ops[0].attributes.cmExtra,
              }],
            }],
          }],
        };
      }
      return convertDeltaToBlocks(arg);
    });
    unpatchers.push(u);
  });

  const { pre: preChatPostMessage } = api.webpack.earlyPopulatePrettyWebpackExport("actionCreators::chatPostMessage", m => m?.meta?.name === "chatPostMessage");
  preChatPostMessage(i => {
    const u = api.webpack.insertWebpackPatch(i, "CodemirrorMessageEditor", chatPostMessage => (arg: any) => {
      api.log(`chatPostMessage called with arg`, arg, `original blocks`, arg?.message?.blocks);
      /* transform message */
      if (
        arg?.message?.blocks?.[0]?.type === "rich_text" &&
        arg.message.blocks[0].elements?.[0]?.type === "rich_text_section" &&
        arg.message.blocks[0].elements[0].elements?.[0]?.cmExtra
      ) {
        const extra: MDXEvalResult = arg.message.blocks[0].elements[0].elements[0].cmExtra;
        arg.message.blocks = extra.blocks;
        arg.message.unfurl = [
          ...[...extra.ctx.unfurlUrls].map(u => ({url: u}))
        ];
        return chatPostMessage(arg);
      }
      return chatPostMessage(arg);
    });
    unpatchers.push(u);
  });

  const { ComposerAttachments, BlockKitRenderer } = api.slack;

  const unpatchMessageInput = api.react.patchComponentWithTester2(api.slack.MessageInput, props => props.viewContext === "Channel", MessageInput => props => {
    //// temp
    //return <MessageInput
    //  {...props}
    //  setDraft={patchLog(api, props.setDraft, "original messageinput called setDraft with args:")}
    //  clearDrafts={patchLog(api, props.clearDrafts, "original messageinput called clearDrafts with args:")}
    ///>

    /* refs */
    const cmParentEl = globalThis.React.useRef<HTMLDivElement>(null);
    const shikiCompartmentRef = globalThis.React.useRef<Compartment>(null);
    const historyCompartmentRef = globalThis.React.useRef<Compartment>(null);
    const shimCompartmentRef = globalThis.React.useRef<Compartment>(null);
    const placeholderCompartmentRef = globalThis.React.useRef<Compartment>(null);
    const quillShimRef = globalThis.React.useRef<ReturnType<typeof shimQuillFromEditorView>>(null);
    const editorViewRef = globalThis.React.useRef<EditorView>(null);
    const placeholderRef = globalThis.React.useRef<HTMLDivElement>(null);
    const draftTimerRef = globalThis.React.useRef<number>(null);

    // XXX: on* callbacks only seem to be used when refToForward doesn't get populated?
    /* state */
    const [shouldStoreDraft, setShouldStoreDraft] = globalThis.React.useState(false);
    const [shouldSendMessage, setShouldSendMessage] = globalThis.React.useState(false);
    const [shouldRenderPreview, setShouldRenderPreview] = globalThis.React.useState(false);
    const [lastStoredDraft, setLastStoredDraft] = globalThis.React.useState(null);
    const [preview, setPreview] = globalThis.React.useState(null);

    function updateDraft(draft: any, draftId: string, stateSnapshot: EditorState) {
      const d = {
        cursor_index: stateSnapshot.selection.main.from,
        ...(draft ?? {
          client_draft_id: draftId,
          destinations: [
            { channel_id: props.channelId! },
          ],
          is_from_composer: false,
          shouldWithold: true,
        }),
        ops: deltaOpsFromString(stateSnapshot.doc.toString()),
      };
      props.setDraft({
        draft: d,
        reason: "MessageInput:updateDraft",
        skipEqualityCheck: false,
      });
      setLastStoredDraft(d);
    }

    globalThis.React.useEffect(() => {
      if (cmParentEl.current) {
        shikiCompartmentRef.current = new Compartment();
        historyCompartmentRef.current = new Compartment();
        shimCompartmentRef.current = new Compartment();
        placeholderCompartmentRef.current = new Compartment();
        editorViewRef.current = new EditorView({
          parent: cmParentEl.current,
          state: EditorState.create({
            doc: "",
            extensions: [
              placeholderCompartmentRef.current.of([]),
              lineNumbers(),
              EditorView.lineWrapping,
              historyCompartmentRef.current.of(history()),
              keymap.of([
                {
                  key: "Ctrl-Enter",
                  mac: "Cmd-Enter",
                  run: (_target) => {
                    setShouldSendMessage(true);
                    return true;
                  },
                },
                {
                  key: "Alt-Enter",
                  run: (_target) => {
                    setShouldRenderPreview(true);
                    return true;
                  },
                },
                indentWithTab,
                ...historyKeymap,
                ...defaultKeymap,
              ]),
              shimCompartmentRef.current.of([]),
              EditorView.theme({
                "&": {
                  borderRadius: "5px",
                  width: "0",
                  flexGrow: "1",
                },
                "&.cm-focused": {
                  outline: "none",
                },
              }),
              shikiCompartmentRef.current.of([]),
            ],
          }),
        });
        api.log(`modified MessageInput mounted codemirror editor`, editorViewRef.current);

        quillShimRef.current = shimQuillFromEditorView(editorViewRef.current, historyCompartmentRef.current, shimCompartmentRef.current);
        function startDraftTimer() {
          if (draftTimerRef.current)
            clearTimeout(draftTimerRef.current);
          draftTimerRef.current = setTimeout(() => setShouldStoreDraft(true), 2000);
        }
        quillShimRef.current.on("editor-change", startDraftTimer);
        startDraftTimer();
        quillShimRef.current.on("text-change", () => {
          setPreview(null);
        });

        // load shiki async
        (async () => {
          const highlighterPromise_ = highlighterPromise();
          const highlighter = await highlighterPromise_;
          const theme = "dracula-soft";
          const themeData = highlighter.getTheme(theme);

          editorViewRef.current.dispatch({
            effects: [
              shikiCompartmentRef.current.reconfigure([
                shiki({
                  // XXX: using the resolved value causes some weird error
                  highlighter: highlighterPromise_,
                  language: "mdx",
                  theme,
                }),
                EditorView.darkTheme.of(themeData.type === "dark"),
                EditorView.theme({
                  "&": {
                    backgroundColor: themeData.bg,
                    color: themeData.fg,
                  },
                  ".cm-gutters": {
                    backgroundColor: themeData.bg,
                    color: themeData.fg,
                  },
                }),
              ]),
            ],
          });
        })();
      }

      return () => {
        editorViewRef.current?.destroy();
      };
    }, []);

    /* rerender placeholder when it changes */
    globalThis.React.useEffect(() => {
      placeholderRef.current ??= document.createElement("div");
      if (!editorViewRef.current || !placeholderCompartmentRef.current)
        return;
      if (props.placeholder)
        editorViewRef.current.dispatch({
          effects: placeholderCompartmentRef.current.reconfigure(placeholder(placeholderRef.current)),
        });
      else
        editorViewRef.current.dispatch({
          effects: placeholderCompartmentRef.current.reconfigure([]),
        });
    }, [props.placeholder]);

    /* update state when draftId changes */
    globalThis.React.useEffect(() => {
      const editorView = editorViewRef.current;
      if (editorView && props.draft)
        editorView.dispatch({
          changes: {
            from: 0,
            to: editorView.state.doc.length,
            insert: adaptDraft(props.draft),
          },
        });
    }, [props.draftId]);

    // store draft on timer
    globalThis.React.useEffect(() => {
      if (shouldStoreDraft) {
        updateDraft(props.draft, props.draftId, editorViewRef.current.state);
        setShouldStoreDraft(false);
      }
    }, [shouldStoreDraft]);

    /* clear draft when unmounted or draft id changes
      useLayoutEffect so that we still have props in cleanup */
    globalThis.React.useLayoutEffect(() => {
      const f = () => {
        if (lastStoredDraft?.ops[0].insert === "") {
          props.clearDrafts({
            ids: [lastStoredDraft.client_draft_id],
            reason: "MessageInput:updateDraft",
          });
        }
      };
      f();
      return f;
    }, [props.draftId]);

    /* forward quill shim as ref */
    globalThis.React.useEffect(() => {
      const quillShim = quillShimRef.current as any;
      if (props.refToForward && quillShim) {
        if (typeof props.refToForward === "function")
          props.refToForward(quillShim);
        else
          props.refToForward.current = quillShim;
      }
    }, [props.refToForward]);

    /* send message */
    globalThis.React.useEffect(() => {
      if (shouldSendMessage) {
        const res = evalMdxForSlackOrGetErrorBlocks(editorViewRef.current.state.doc.toString());
        if ("error" in res) {
          setPreview(res.error);
        } else {
          quillShimRef.current.cmExtra = res.result;
          props.sendMessage?.();
        }
        setShouldSendMessage(false);
      }
    }, [shouldSendMessage]);

    /* render preview */
    globalThis.React.useEffect(() => {
      if (shouldRenderPreview) {
        const res = evalMdxForSlackOrGetErrorBlocks(editorViewRef.current.state.doc.toString());
        if ("error" in res) {
          setPreview(res.error);
        } else {
          setPreview(res.result.blocks);
        }
        setShouldRenderPreview(false);
      }
    }, [shouldRenderPreview]);

    /* flex stuff is a hack? but it works */
    return (
      <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
        <ComposerAttachments
          channelId={props.channelId}
          draftFiles={props.draftComposerFiles}
          draftId={props.draftId}
          focusInput={() => quillShimRef.current?.focus()}
          onFilePermissionSelect={() => {}}
          onUnfurlRemoved={() => {}}
        />
        <div ref={cmParentEl} style={{display: "flex", flexDirection: "row"}}>
          {placeholderRef.current && props.placeholder && globalThis.ReactDOM.createPortal(props.placeholder, placeholderRef.current)}
        </div>
        {preview && <BlockKitRenderer
          blocks={preview}
          blocksContainerContext="message"
          clogLinkClick={() => {}}
          container="message"
          remountOnUpdate={true}
        />}
      </div>
    );
  });

  return () => {
    unpatchMessageInput();
    for (const u of unpatchers)
      u();
    highlighter?.dispose();
    highlighter = null;
  };
};

export default {
  id: "CodemirrorMessageEditor",
  meta: {
    name: "Codemirror Message Editor",
    description: "Replaces the built-in message editor with a Codemirror message editor that supports MDX. VERY experimental.",
    authors: "<@U01D9DWGEB0>",
  },
  init,
} satisfies RopePlugin;
