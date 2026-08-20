import { Component } from "react";

export default class EditorRecoveryBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("VSN editor recovered from a render error:", error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full w-full overflow-auto bg-white p-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <strong className="block">This editor area recovered from an invalid widget state.</strong>
          <span className="mt-1 block">Undo the last change or select the widget again. Your page data remains preserved.</span>
        </div>
      </div>
    );
  }
}
