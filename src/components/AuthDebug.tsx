import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { logger } from '../utils/logger';

/**
 * Debug component for authentication information
 * To use: Add this component to any page and click the "Trigger Error" button
 */
const AuthDebug: React.FC = () => {
  const { user: currentUser } = useAuth();

  const handleDebugInfo = () => {
    const debugInfo = {
      environment: process.env.REACT_APP_ENV || 'unknown',
      nodeEnv: process.env.NODE_ENV || 'unknown',
      projectId: auth.app.options.projectId,
      authDomain: auth.app.options.authDomain,
      userInfo: currentUser
        ? {
            hasUser: true,
            emailVerified: currentUser.emailVerified,
            providerCount: currentUser.providerData.length,
            creationTime: currentUser.metadata.creationTime,
            lastSignInTime: currentUser.metadata.lastSignInTime,
          }
        : { hasUser: false },
    };

    logger.debug('Auth Debug Info', debugInfo, {
      component: 'AuthDebug',
      operation: 'handleDebugInfo',
    });
  };

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 p-4 rounded-lg shadow-lg border border-yellow-300">
      <h3 className="text-sm font-semibold text-yellow-800 mb-2">Auth Debug</h3>
      <div className="text-xs text-yellow-700 space-y-1">
        <div>Status: {currentUser ? 'Authenticated' : 'Not authenticated'}</div>
        <div>Env: {process.env.REACT_APP_ENV || 'unknown'}</div>
        <div>Project: {auth.app.options.projectId}</div>
        <button
          onClick={handleDebugInfo}
          className="mt-2 px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-xs"
        >
          Log Debug Info
        </button>
      </div>
    </div>
  );
};

export default AuthDebug;
