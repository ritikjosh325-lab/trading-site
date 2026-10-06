import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CryptoFlow AI crashed:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid-bg flex items-center justify-center p-4">
          <div className="w-full max-w-md panel p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent-red/15 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-accent-red" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-200 mb-1">Something went wrong</h2>
              <p className="text-sm text-gray-500">
                The app hit an unexpected error. Your data is safe — just reload to continue.
              </p>
            </div>
            {this.state.error && (
              <div className="px-3 py-2 bg-bg-raised border border-bg-border rounded-lg text-left">
                <code className="text-xs text-accent-red font-mono break-all">
                  {this.state.error.message}
                </code>
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-semibold hover:bg-accent-blue/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
