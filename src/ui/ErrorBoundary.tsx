import { Component, type ReactNode } from 'react';

interface Props {
  /** Rendered instead of the children after an error; `retry` remounts them. */
  fallback: (retry: () => void) => ReactNode;
  children: ReactNode;
}

/** Keeps a crash in one area (e.g. the 3D view) from taking down the whole lab. */
export class ErrorBoundary extends Component<Props, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('NEURAL: view crashed and was contained', error);
  }

  render() {
    if (this.state.failed)
      return this.props.fallback(() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 })));
    return (
      <div key={this.state.attempt} style={{ display: 'contents' }}>
        {this.props.children}
      </div>
    );
  }
}
