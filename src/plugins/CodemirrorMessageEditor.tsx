import type { RopeAPI, RopePlugin, RopePluginInit } from "../api";

import { EditorView, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { EditorState, Compartment, SelectionRange } from "@codemirror/state";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { createHighlighterCore, type HighlighterCore } from "shiki";
//import { createOnigurumaEngine } from "shiki/engine/oniguruma";
// TODO: investigate precompiled languages, https://shiki.style/guide/regex-engines#pre-compiled-languages
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

//import shikiWasm from "shiki/wasm";
//import shikiLangMdx from "@shikijs/langs/mdx";
//import shikiThemeDraculaSoft from "@shikijs/themes/dracula-soft";

import shiki from "codemirror-shiki";

import type Quill from "quill";
import { type Delta, type Range } from "quill";

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

/* TODO: roundtrip Quill Deltas <-> MDX */
function adaptDraft(draft: any): string {
  if (!draft)
    return "";
  if (draft.ops.length === 1 && typeof draft.ops[0].insert === "string")
    return draft.ops[0].insert.trim();
  return "{/* Raw Quill draft:\n" + JSON.stringify(draft.ops, null, 2) + "\n*/}";
}

function deltaOpsFromString(s: string): Delta["ops"] {
  return [
    { insert: s },
  ];
}

function cmSelectionToQuillRange(selection: SelectionRange): Range {
  return {
    index: selection.from,
    length: selection.to - selection.from,
  };
}

function shimQuillFromEditorView(api: RopeAPI, editorView: EditorView, historyCompartment: Compartment, shimCompartment: Compartment): {
  /* Real Quill methods */
  blur: Quill["blur"];
  focus: Quill["focus"];
  hasFocus: Quill["hasFocus"];
  container: Quill["container"];
  getSelection: Quill["getSelection"];
  getLength: Quill["getLength"];
  getContents: () => { contents: Delta["ops"] };//Quill["getContents"];
  getFormat: Quill["getFormat"];
  on: Quill["on"];
  off: Quill["off"];
  once: Quill["once"];

  /* Slack-specific */
  setCursorAtEnd: () => void;
  maybeTriggerMentionAutocomplete?: () => void;
  clearHistory: () => void;
  clear: () => void;
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
      return { contents: deltaOpsFromString(editorView.state.doc.toString()) };
    },
    getFormat: (..._args: any[]) => {
      return {};
    },
    // FIXME: do we actually need to return Emitters?
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
    },
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

const init: RopePluginInit = (api) => {
  const slackStore = api.redux.virtualPrettyReduxStore("slack");
  //const storeLocalDraft = api.webpack.virtualPopulatePrettyWebpackExport("actionCreators::setLocalDraft", m => m?.meta?.name === "setLocalDraft");
  //const clearLocalDrafts = api.webpack.virtualPopulatePrettyWebpackExport("actionCreators::clearLocalDrafts", m => m?.meta?.name === "clearLocalDrafts");

  const { ComposerAttachments } = api.slack;

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
    //const [cmIsFocused, setCmIsFocused] = globalThis.React.useState(true);
    const [shouldStoreDraft, setShouldStoreDraft] = globalThis.React.useState(false);
    const [shouldSendMessage, setShouldSendMessage] = globalThis.React.useState(false);
    const [lastStoredDraft, setLastStoredDraft] = globalThis.React.useState(null);
    //const [cmSelectionChange, setCmSelectionChange] = globalThis.React.useState(0);

    function updateDraft(draft: any, draftId: string, stateSnapshot: EditorState) {
      //const editorView = editorViewRef.current;
      //if (stateSnapshot.doc.toString() === "") {
      //  // clear the draft
      //  //if (draft?.client_draft_id)
      //  //  //slackStore.dispatch(clearLocalDrafts({
      //  //  props.clearDrafts({
      //  //    ids: [draft.client_draft_id],
      //  //  });
      //  props.clearDrafts({
      //    ids: [draftId],
      //    reason: "MessageInput:updateDraft",
      //  });
      //} else {
      //  // XXX: do I need to pass all of these fields here?
      //  //slackStore.dispatch(storeLocalDraft({
      //  props.setDraft({
      //    draft: {
      //      cursor_index: stateSnapshot.selection.main.from,
      //      //last_updated: Math.floor(Date.now() / 1000),
      //      ...(draft ?? {
      //        //client_draft_id: props.channelId!,
      //        client_draft_id: draftId,
      //        // does this work? lol
      //        destinations: [
      //          { channel_id: props.channelId! },
      //        ],
      //        is_from_composer: false,
      //        shouldWithold: true,
      //        //skipEqualityCheck: false,
      //      }),
      //      ops: deltaOpsFromString(stateSnapshot.doc.toString()),
      //      //blocks: props.convertDeltaToBlocks({
      //      //  delta: { ops: deltaOpsFromString(editorView.state.doc.toString()) } as any,
      //      //}),
      //    },
      //    reason: "MessageInput:updateDraft",
      //    skipEqualityCheck: false,
      //  });
      //}
      const d = {
        cursor_index: stateSnapshot.selection.main.from,
        //last_updated: Math.floor(Date.now() / 1000),
        ...(draft ?? {
          //client_draft_id: props.channelId!,
          client_draft_id: draftId,
          // does this work? lol
          destinations: [
            { channel_id: props.channelId! },
          ],
          is_from_composer: false,
          shouldWithold: true,
          //skipEqualityCheck: false,
        }),
        ops: deltaOpsFromString(stateSnapshot.doc.toString()),
        //blocks: props.convertDeltaToBlocks({
        //  delta: { ops: deltaOpsFromString(editorView.state.doc.toString()) } as any,
        //}),
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
            doc: "",//adaptDraft(props.draft),
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
                indentWithTab,
                ...historyKeymap,
                ...defaultKeymap,
              ]),
              shimCompartmentRef.current.of([]),
              //EditorView.updateListener.of(update => {
              //  if (update.focusChanged)
              //    setCmIsFocused(update.view.hasFocus);
              //}),
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

        quillShimRef.current = shimQuillFromEditorView(api, editorViewRef.current, historyCompartmentRef.current, shimCompartmentRef.current);
        //quillShimRef.current.on("selection-change", () => setCmSelectionChange(x => x+1));
        quillShimRef.current.on("editor-change", () => {
          if (draftTimerRef.current)
            clearTimeout(draftTimerRef.current);
          draftTimerRef.current = setTimeout(() => setShouldStoreDraft(true), 2000);
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

    /* update state when draft changes */
    globalThis.React.useEffect(() => {
      const editorView = editorViewRef.current;
      if (editorView)
        editorView.dispatch({
          changes: {
            from: 0,
            to: editorView.state.doc.length,
            insert: adaptDraft(props.draft),
          },
        });
      // check if this causes issues
      //updateDraft();
    }, [props.draft]);

    ///* store draft on focus changes *AND* unmount (!!) */
    //globalThis.React.useEffect(() => {
    //  if (!cmIsFocused)
    //    updateDraft(props.draft, props.draftId, editorViewRef.current.state);
    //  /* on cleanup, also save the draft FROM OLD PROPS! */
    //  // FIXME: spooky
    //  //return () => updateDraft(props.draft, props.draftId, editorViewRef.current.state);
    //}, [cmIsFocused]);

    // store draft on timer
    globalThis.React.useEffect(() => {
      if (shouldStoreDraft) {
        updateDraft(props.draft, props.draftId, editorViewRef.current.state);
        setShouldStoreDraft(false);
      }
    }, [shouldStoreDraft]);

    /* clear draft when unmounted or draft id changes */
    globalThis.React.useEffect(() => {
      return () => {
        if (lastStoredDraft?.ops[0].insert === "") {
          props.clearDrafts({
            ids: [lastStoredDraft.client_draft_id],
            reason: "MessageInput:updateDraft",
          });
        }
      };
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
        //updateDraft(props.draft, props.draftId, editorViewRef.current.state);
        props.sendMessage?.();
        ///* clear the message box ourself since sometimes Slack doesn't do it */
        //quillShimRef.current?.clear();
        setShouldSendMessage(false);
      }
    }, [shouldSendMessage]);

    const tempShowOldInput = false;
    /* flex stuff is a hack? but it works */
    const res = (
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
      </div>
    );
    return tempShowOldInput ? <>
      {res}
      <MessageInput {...props} />
    </> : res;
  });

  return () => {
    unpatchMessageInput();
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
