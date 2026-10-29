import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from "@codemirror/commands";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle, foldGutter } from "@codemirror/language";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { formatCode } from "./formatCode.js";

// VS Code-style editor for Widget Studio HTML/CSS: suggestions while typing,
// Tab indents, Ctrl/Cmd+/ comments, Shift+Alt+F formats, Ctrl/Cmd+Z undo.
const theme = EditorView.theme({
  "&": { fontSize: "13px", backgroundColor: "#0f172a", color: "#e2e8f0", borderRadius: "0 0 10px 10px" },
  ".cm-content": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", caretColor: "#93c5fd", padding: "10px 0" },
  ".cm-gutters": { backgroundColor: "#0b1222", color: "#64748b", border: "none" },
  ".cm-activeLine": { backgroundColor: "rgba(148,163,184,.08)" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(148,163,184,.12)", color: "#cbd5e1" },
  "&.cm-focused": { outline: "2px solid #6366f1", outlineOffset: "-2px" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(99,102,241,.35) !important" },
  ".cm-tooltip-autocomplete": { backgroundColor: "#111827", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "#4f46e5", color: "#fff" },
  ".cm-completionDetail": { color: "#94a3b8", fontStyle: "normal", marginLeft: "8px" },
}, { dark: true });

function tokenCompletions(tokens) {
  const options = tokens.map((token) => ({ label: `{{${token.name}}}`, detail: token.detail || "field", type: "variable", apply: `{{${token.name}}}` }));
  return (context) => {
    const word = context.matchBefore(/\{\{?[\w.-]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    return { from: word.from, options, validFor: /^\{\{?[\w.-]*$/ };
  };
}

export default function CodeMirrorEditor({ value = "", onChange, language = "html", rows = 14, tokens = [], readOnly = false, label = "Code" }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const tokenCompartment = useRef(new Compartment());
  onChangeRef.current = onChange;

  useEffect(() => {
    const lang = language === "css" ? css() : html({ autoCloseTags: true });
    const format = (view) => {
      const next = formatCode(view.state.doc.toString(), language);
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
      return true;
    };
    // Polaris web components replace document.adoptedStyleSheets, which wipes
    // CodeMirror's injected styles; a shadow root keeps the editor's styles isolated.
    const host = hostRef.current;
    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.replaceChildren();
    const mount = document.createElement("div");
    shadow.appendChild(mount);
    const view = new EditorView({
      root: shadow,
      parent: mount,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), foldGutter(), highlightActiveLine(), highlightActiveLineGutter(), drawSelection(), history(),
          indentOnInput(), bracketMatching(), closeBrackets(), syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          lang, autocompletion({ activateOnTyping: true }),
          tokenCompartment.current.of(language === "html" ? lang.language.data.of({ autocomplete: tokenCompletions(tokens) }) : []),
          keymap.of([{ key: "Shift-Alt-f", run: format }, { key: "Mod-/", run: toggleComment }, ...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab]),
          EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly),
          EditorView.updateListener.of((update) => { if (update.docChanged) onChangeRef.current?.(update.state.doc.toString()); }),
          EditorView.contentAttributes.of({ "aria-label": label }),
          placeholderExt(language === "css" ? ".my-class { color: #111; }" : "<div {{vsn.root}}>…</div>"),
          theme,
          EditorView.theme({ ".cm-scroller": { minHeight: `${Math.max(6, rows) * 20}px`, maxHeight: "560px" } }),
        ],
      }),
    });
    viewRef.current = view;
    view.formatDocument = () => format(view);
    return () => { view.destroy(); viewRef.current = null; };
  }, [language, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps -- the view owns the document; outside value changes sync below

  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || language !== "html") return;
    const lang = html();
    view.dispatch({ effects: tokenCompartment.current.reconfigure(lang.language.data.of({ autocomplete: tokenCompletions(tokens) })) });
  }, [tokens, language]);

  return <div className="vsn-cm-host" data-vsn-editor-ready="1">
    <div ref={hostRef} />
    {!readOnly ? <button type="button" className="vsn-cm-format" onClick={() => viewRef.current?.formatDocument?.()}>Format</button> : null}
  </div>;
}
