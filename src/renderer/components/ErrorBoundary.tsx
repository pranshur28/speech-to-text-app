import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '24px',
          background: 'var(--bg-primary, #1a1a2e)',
          color: 'var(--text-primary, #e0e0e0)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          gap: '16px',
        }}>
          <div style={{
            fontSize: '48px',
            lineHeight: 1,
          }}>
            !
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
            Something went wrong
          </h2>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--text-secondary, #999)',
            maxWidth: '400px',
          }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: '8px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 500,
              border: 'none',
              borderRadius: '8px',
              background: 'var(--accent-primary, #6366f1)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
