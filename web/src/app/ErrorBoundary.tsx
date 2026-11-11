import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Copy, Home, RotateCcw } from "lucide-react";
import { explainError } from "./explainError";

type Props = { children: ReactNode };
type State = { error: unknown; stack: string };

// Catches any error while a page draws, and shows what happened, why, and how to fix it instead of a blank screen.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: "" };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.setState({ stack: info.componentStack ?? "" });
    console.error("MoonScope page error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const e = explainError(this.state.error);
    const details = `${e.detail}\n${this.state.stack}`.trim();

    return (
      <div role="alert" className="mx-auto max-w-2xl px-5 py-16">
        <div className="rounded-3xl border border-fail/40 bg-surface p-6 md:p-8">
          <div className="flex items-center gap-3 text-fail">
            <AlertTriangle size={22} />
            <h1 className="text-2xl font-bold text-text">{e.title}</h1>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="font-semibold">What caused it</dt>
              <dd className="mt-0.5 text-text/80">{e.cause}</dd>
            </div>
            <div>
              <dt className="font-semibold">How to fix it</dt>
              <dd className="mt-0.5 text-text/80">{e.fix}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/85"
            >
              <RotateCcw size={14} /> Reload the page
            </button>
            <a href="#/" onClick={() => this.setState({ error: null })} className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-muted">
              <Home size={14} /> Go to Home
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(details).catch(() => undefined)}
              className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-muted"
            >
              <Copy size={14} /> Copy details
            </button>
          </div>
          <details className="mt-5 text-xs text-muted">
            <summary className="cursor-pointer">Technical details</summary>
            <pre className="num mt-2 max-h-48 overflow-auto rounded-lg bg-surface-2 p-3 whitespace-pre-wrap">{details}</pre>
          </details>
        </div>
      </div>
    );
  }
}