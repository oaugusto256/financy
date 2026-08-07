import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * The last line of defence against an uncaught render exception: without one,
 * React unmounts everything it manages, which below `App.tsx` is the whole
 * tree — a blank page with nothing on screen and nothing recorded. Class-only
 * because React has no hook equivalent of `getDerivedStateFromError` /
 * `componentDidCatch`. `docs/audits/2026-08-07-findings.md` row 3.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No error reporter exists in this project yet — console.error is
    // today's floor, same as the rest of the backend and frontend.
    console.error('Uncaught render error', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center"
        >
          <TriangleAlert aria-hidden="true" className="size-10 text-danger" />
          <p className="text-sm text-gray-600">
            Algo deu errado. Tente recarregar a página.
          </p>
          <Button variant="secondary" size="sm" onClick={this.handleReload}>
            Recarregar
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
