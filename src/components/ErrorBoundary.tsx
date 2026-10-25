import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the stack for local debugging, never the user's record contents.
    console.error("Zuofei render error", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="boot-error">
        <div className="boot-error-panel">
          <h1>昨非遇到了一点问题</h1>
          <p>Something went wrong while opening the rulebook. No data was changed.</p>
          <button
            type="button"
            className="button button--primary"
            onClick={() => window.location.reload()}
          >
            刷新 / Reload
          </button>
        </div>
      </div>
    );
  }
}
