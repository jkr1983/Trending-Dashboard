import React from "react";
import "./ErrorBoundary.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="eb-icon">⚠</div>
          <h3 className="eb-title">{this.props.title || "Something went wrong"}</h3>
          <p className="eb-message">
            {this.state.error?.message || "An unexpected error occurred in this section."}
          </p>
          {process.env.NODE_ENV !== "production" && this.state.errorInfo && (
            <details className="eb-details">
              <summary>Stack trace</summary>
              <pre>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
          <button className="eb-retry" onClick={this.handleReset}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
