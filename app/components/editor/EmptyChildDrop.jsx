const BASE = { minHeight: 120, display: "grid", placeItems: "center", textAlign: "center", border: "1px dashed #b7bdc1", borderRadius: 10, background: "#fafbfb", color: "#6d7175", pointerEvents: "none" };
// An empty image/media container keeps its artwork visible: the drop hint floats
// centred over it instead of painting an opaque box across the top.
const OVER_MEDIA = { flex: 1, minHeight: 0, alignSelf: "stretch", background: "transparent", border: "1px dashed rgba(255,255,255,.75)", color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.45)" };

export default function EmptyChildDrop({ overMedia = false }) {
  return <div data-vsn-empty-child-drop="1" style={overMedia ? { ...BASE, ...OVER_MEDIA } : BASE}><div><div aria-hidden="true" style={{ fontSize: 34, lineHeight: 1 }}>＋</div><strong style={{ display: "block", fontSize: 12, marginTop: 6 }}>Add Widget</strong><span style={{ fontSize: 10 }}>Drag any widget here</span></div></div>;
}
