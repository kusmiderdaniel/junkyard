import React, { useState } from 'react';

/**
 * Test component for verifying error boundaries during development
 * To use: Add this component to any page and click the "Trigger Error" button
 * Remove this component before production deployment
 */
const ErrorBoundaryTest: React.FC = () => {
  const [shouldThrowError, setShouldThrowError] = useState(false);

  // This will trigger an error to test error boundaries
  if (shouldThrowError) {
    throw new Error('Test error for error boundary verification');
  }

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h3 className="text-sm font-medium text-yellow-800 mb-2">
        🧪 Error Boundary Test (Development Only)
      </h3>
      <p className="text-xs text-yellow-700 mb-3">
        This component tests error boundaries. Click the button below to trigger
        an error and verify that the error boundary catches it and displays the
        fallback UI.
      </p>
      <button
        onClick={() => setShouldThrowError(true)}
        className="inline-flex items-center px-3 py-1 border border-yellow-300 text-xs font-medium rounded text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
      >
        🚨 Trigger Error
      </button>
      <p className="text-xs text-yellow-600 mt-2">
        Expected behavior: Error boundary should catch the error and show
        fallback UI
      </p>
    </div>
  );
};

export default ErrorBoundaryTest;
