import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-bg p-8 text-text">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-muted">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
