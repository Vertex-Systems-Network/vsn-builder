import { Component, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PreviewRenderer from "./PreviewRenderer";


class LibraryPreviewBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.warn("VSN library preview isolated a render error:", error);
  }
  render() {
    if (this.state.error) {
      return <div className="vsn-library-preview is-empty"><span>Preview unavailable</span></div>;
    }
    return this.props.children;
  }
}

const DEFAULT_STYLES = {
  backgroundColor: "#ffffff",
  textColor: "#1a1a1a",
  fontFamily: "Inter, system-ui, sans-serif",
  headingFontFamily: "inherit",
  containerMaxWidth: "1200px",
};

function normalizePreviewIds(nodes = []) {
  const walk = (items, path = "root") => (Array.isArray(items) ? items : []).map((node, index) => {
    if (!node || typeof node !== "object") return node;
    const key = `${path}-${index}-${String(node.type || "node")}`;
    return { ...node, id: `preview-${key}`, children: walk(node.children, key) };
  });
  return walk(nodes);
}

// Device previews render inside an iframe so the template's responsive @media rules see the real device width.
function PreviewFrame({ width, title, children }) {
  const [frameBody, setFrameBody] = useState(null);
  const [height, setHeight] = useState(680);
  const frameRef = useRef(null);
  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return undefined;
    doc.open(); doc.write("<!doctype html><html><head><meta charset=\"utf-8\"></head><body style=\"margin:0\"></body></html>"); doc.close();
    for (const node of document.querySelectorAll("link[rel=stylesheet],style")) doc.head.appendChild(node.cloneNode(true));
    setFrameBody(doc.body);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => setHeight(Math.max(680, doc.body.scrollHeight)));
    observer?.observe(doc.body);
    return () => observer?.disconnect();
  }, []);
  return <iframe ref={frameRef} title={title} tabIndex={-1} style={{ display: "block", width, height, border: 0, background: "#fff" }}>{frameBody ? createPortal(children, frameBody) : null}</iframe>;
}

const PREVIEW_DEVICES = Object.freeze({ desktop: { label: "Desktop", width: 1180 }, tablet: { label: "Tablet", width: 768 }, mobile: { label: "Mobile", width: 390 } });

export default function LibraryDesignPreview({ content, className = "", title = "Template preview", devices = false }) {
  const [device, setDevice] = useState("desktop");
  const [scale, setScale] = useState(0.255);
  const stageRef = useRef(null);
  const documentWidth = PREVIEW_DEVICES[device]?.width || PREVIEW_DEVICES.desktop.width;
  const renderNodes = useMemo(() => {
    const nodes = Array.isArray(content) ? content : content && typeof content === "object" ? [content] : [];
    return normalizePreviewIds(nodes.filter((item) => !["global-styles", "template-settings"].includes(item?.type)));
  }, [content]);
  // Fit the virtual document to the available width instead of a fixed thumbnail scale.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return undefined;
    const update = () => { const width = stage.clientWidth; if (width > 0) setScale(Math.min(1, width / documentWidth)); };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [documentWidth]);
  if (!renderNodes.length) return <div className={`vsn-library-preview is-empty ${className}`}><span>Blank template</span></div>;
  return (
    <div className={`vsn-library-preview ${devices ? "has-devices" : ""} ${className}`} aria-label={title}>
      {devices ? <div className="vsn-library-preview-devices" role="group" aria-label="Preview device">{Object.entries(PREVIEW_DEVICES).map(([key, item]) => <button key={key} type="button" className={device === key ? "is-active" : ""} aria-pressed={device === key} onClick={() => setDevice(key)}>{item.label}</button>)}</div> : null}
      <div ref={stageRef} className="vsn-library-preview-stage" aria-hidden="true">
        <div className="vsn-library-preview-document" data-vsn-preview-device={device} style={{ width: documentWidth, transform: devices ? `translateX(-50%) scale(${scale})` : `scale(${scale})` }}>
          <LibraryPreviewBoundary key={title}>
            {devices
              ? <PreviewFrame width={documentWidth} title={title}><PreviewRenderer elements={renderNodes} globalStyles={DEFAULT_STYLES} reusableSections={[]} staticPreview /></PreviewFrame>
              : <PreviewRenderer elements={renderNodes} globalStyles={DEFAULT_STYLES} reusableSections={[]} staticPreview />}
          </LibraryPreviewBoundary>
        </div>
      </div>
    </div>
  );
}
