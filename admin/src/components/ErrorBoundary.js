// src/components/ErrorBoundary.js
// Catches render errors in its subtree so a single broken page doesn't
// blank the whole admin. Sidebar, topbar and navigation stay usable.
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log so the panel (and you) can see it in the browser console.
    console.error('[ErrorBoundary]', error);
    console.error('[ErrorBoundary] componentStack:', info?.componentStack);
    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, info } = this.state;
    const { children } = this.props;

    if (!hasError) return children;

    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <div className="error-boundary-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <h2 className="error-boundary-title">Something went wrong</h2>
          <p className="error-boundary-body">
            This page couldn't be displayed. The rest of the admin still works —
            use the sidebar to continue, or try reloading this page.
          </p>

          <div className="error-boundary-actions">
            <button className="btn btn-primary btn-sm" onClick={this.handleReset}>
              Try again
            </button>
            <button className="btn btn-outline btn-sm" onClick={this.handleReload}>
              Reload admin
            </button>
          </div>

          {(error || info) && (
            <details className="error-boundary-details">
              <summary>Technical details</summary>
              {error?.message && (
                <div className="error-boundary-message">
                  <strong>{error.name || 'Error'}:</strong> {error.message}
                </div>
              )}
              {info?.componentStack && (
                <pre className="error-boundary-stack">{info.componentStack.trim()}</pre>
              )}
            </details>
          )}
        </div>
      </div>
    );
  }
}