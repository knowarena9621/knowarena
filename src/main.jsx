import React from "react";
import ReactDOM from "react-dom/client";
import KnowArena from "./KnowArena.jsx";
import "./index.css";

// Catches any crash and shows a readable error instead of blank white screen
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 32, fontFamily: "sans-serif", minHeight: "100vh", background: "#f0f4ff" }}>
        <h2 style={{ color: "#ef4444" }}>⚠️ Something went wrong</h2>
        <pre style={{ background: "#fff", padding: 16, borderRadius: 10, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid #e2e8f0" }}>
          {this.state.error?.message || String(this.state.error)}
        </pre>
        <button onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: "12px 24px", background: "#1a56db", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          🔄 Reload App
        </button>
      </div>
    );
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <KnowArena />
    </ErrorBoundary>
  </React.StrictMode>
);
