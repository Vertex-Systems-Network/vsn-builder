import { Component, useMemo } from "react";
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

export default function LibraryDesignPreview({ content, className = "", title = "Template preview" }) {
  const renderNodes = useMemo(() => {
    const nodes = Array.isArray(content) ? content : content && typeof content === "object" ? [content] : [];
    return normalizePreviewIds(nodes.filter((item) => !["global-styles", "template-settings"].includes(item?.type)));
  }, [content]);
  if (!renderNodes.length) return <div className={`vsn-library-preview is-empty ${className}`}><span>Blank template</span></div>;
  return (
    <div className={`vsn-library-preview ${className}`} aria-label={title}>
      <div className="vsn-library-preview-stage" aria-hidden="true">
        <div className="vsn-library-preview-document">
          <LibraryPreviewBoundary key={title}>
            <PreviewRenderer elements={renderNodes} globalStyles={DEFAULT_STYLES} reusableSections={[]} staticPreview />
          </LibraryPreviewBoundary>
        </div>
      </div>
    </div>
  );
}
