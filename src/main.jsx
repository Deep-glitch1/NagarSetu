import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('NagarSetu application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error-boundary">
          <div className="app-error-card">
            <h1>Something went wrong</h1>

            <p>
              NagarSetu encountered an unexpected error. Please refresh the
              page and try again.
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);