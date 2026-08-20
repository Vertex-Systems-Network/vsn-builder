import { AnchoredOverlay } from "./OverlayManager";

export default function EditorSuggestionMenu({ suggestions = [], activeSuggestion = 0, onPick, anchorRef, onClose }) {
  if (!suggestions.length) return null;
  return (
    <AnchoredOverlay
      open
      anchorRef={anchorRef}
      placement="bottom-start"
      matchAnchorWidth
      minWidth={240}
      maxWidth="calc(100vw - 20px)"
      className="vsn-editor-code-suggestions"
      role="listbox"
      layer="menu"
      onRequestClose={onClose}
    >
      {suggestions.map((item, index) => (
        <button
          key={`${item.kind || "item"}-${item.label || item}`}
          type="button"
          role="option"
          aria-selected={index === activeSuggestion}
          className={`vsn-code-suggestion ${index === activeSuggestion ? "is-active" : ""}`}
          onMouseDown={(event) => { event.preventDefault(); onPick?.(item); }}
        >
          <span>{item.label || item}</span>
          {item.meta ? <small>{item.meta}</small> : null}
        </button>
      ))}
    </AnchoredOverlay>
  );
}
