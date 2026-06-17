import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('App screen error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app-error">
        <strong>Screen could not open.</strong>
        <p>Refresh once. If it still happens, clear browser data for this app and try again.</p>
        <button className="pill" type="button" onClick={() => window.location.reload()}>
          Refresh
        </button>
      </div>
    );
  }
}
