import React from "react";
import "./ErrorBoundary.css";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary-icon">⚠</div>
          <h3 className="error-boundary-title">
            {this.props.title || "Something went wrong"}
          </h3>
          <p className="error-boundary-message">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button className="error-boundary-btn" onClick={this.handleReset}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
