import React, { ComponentType } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface WithErrorBoundaryOptions {
  context?: string;
  fallback?: React.ReactNode;
  showReload?: boolean;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Higher-order component that wraps a component with an ErrorBoundary
 */
function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
) {
  const WithErrorBoundaryComponent = (props: P) => {
    return (
      <ErrorBoundary
        context={options.context}
        fallback={options.fallback}
        showReload={options.showReload}
        onError={options.onError}
      >
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };

  // Set display name for debugging
  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

export default withErrorBoundary;
