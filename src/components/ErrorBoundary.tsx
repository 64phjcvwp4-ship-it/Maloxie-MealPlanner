import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = 'Something unexpected happened while syncing your meal planner.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed && parsed.error) {
        message = parsed.error.includes('Missing or insufficient permissions')
          ? 'Your cloud session could not verify permissions. Please sign in again or reload.'
          : parsed.error;
      }
    } catch {
      if (error?.message) {
        message = error.message;
      }
    }
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Maloxie ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#6A6754] flex items-center justify-center p-6 text-[#2E2D24]">
          <div className="max-w-md w-full rounded-2xl bg-[#FAF8F6] border border-[#D9D0CB] p-6 shadow-xl text-center space-y-4">
            <div className="w-11 h-11 rounded-full bg-[#B86B4B]/15 text-[#B86B4B] mx-auto flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="font-display text-xl font-bold text-[#2E2D24]">
              Unable to load planner
            </h1>
            <p className="text-sm text-[#6A6754] leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#3B392D] text-[#FAF8F6] text-sm font-medium hover:bg-[#2E2D24] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Maloxie</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
