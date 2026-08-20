import { Component } from "react";

export default class AppRuntimeBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reported = new Set();
    this.onWindowError = (event) => this.report(event?.error || new Error(String(event?.message || "Window runtime error")), "window-error");
    this.onUnhandledRejection = (event) => this.report(event?.reason instanceof Error ? event.reason : new Error(String(event?.reason || "Unhandled promise rejection")), "unhandled-rejection");
  }

  static getDerivedStateFromError(error) { return { error }; }
  componentDidMount() { window.addEventListener("error", this.onWindowError); window.addEventListener("unhandledrejection", this.onUnhandledRejection); }
  componentWillUnmount() { window.removeEventListener("error", this.onWindowError); window.removeEventListener("unhandledrejection", this.onUnhandledRejection); }
  componentDidCatch(error, info) { this.report(error, "react-boundary", info?.componentStack || ""); }

  report(error, source = "client", componentStack = "") {
    try {
      const message = String(error?.message || "Client runtime error").slice(0, 1200);
      const signature = `${source}:${message}:${window.location.pathname}`;
      if (this.reported.has(signature)) return;
      this.reported.add(signature);
      if (this.reported.size > 50) this.reported.clear();
      const body = new FormData();
      body.set("release", String(this.props.release || ""));
      body.set("route", window.location.pathname + window.location.search);
      body.set("message", `${source}: ${message}`);
      body.set("stack", String(error?.stack || componentStack || "").slice(0, 7000));
      body.set("href", String(window.location.href || "").slice(0, 1600));
      fetch("/app/client-errors", { method: "POST", body, credentials: "same-origin", keepalive: true }).catch(() => {});
    } catch {}
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="vsn-runtime-recovery" role="alert">
        <div className="vsn-runtime-recovery-card">
          <span className="vsn-runtime-recovery-eyebrow">VSN runtime recovery</span>
          <h2>This screen stopped rendering</h2>
          <p>VSN isolated the client error instead of leaving the embedded app blank. Retry this screen first; use System Health if it returns.</p>
          <div className="vsn-runtime-recovery-actions">
            <button type="button" onClick={() => this.setState({ error: null })}>Retry screen</button>
            <button type="button" className="primary" onClick={() => window.location.reload()}>Reload app</button>
            <a href="/app/pages?panel=control-center">System Health</a>
          </div>
        </div>
      </div>
    );
  }
}
