import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const AuthDebug: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setLoading(false);

      // Debug info
      console.log('🔐 Auth Debug Info:');
      console.log('Current User:', currentUser);
      console.log('Project ID from config:', auth.app.options.projectId);
      console.log('Auth Domain from config:', auth.app.options.authDomain);

      if (currentUser) {
        console.log('User UID:', currentUser.uid);
        console.log('User Email:', currentUser.email);
        console.log('User Provider Data:', currentUser.providerData);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-blue-100 border border-blue-300 rounded">
        Loading auth state...
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-100 border border-gray-300 rounded mb-4">
      <h3 className="font-bold text-lg mb-2">🔐 Authentication Debug Info</h3>
      <div className="space-y-2 text-sm">
        <div>
          <strong>Firebase Project ID:</strong> {auth.app.options.projectId}
        </div>
        <div>
          <strong>Auth Domain:</strong> {auth.app.options.authDomain}
        </div>
        <div>
          <strong>Environment:</strong> {process.env.REACT_APP_ENV}
        </div>
        <div>
          <strong>Node Environment:</strong> {process.env.NODE_ENV}
        </div>

        <hr className="my-2" />

        <div>
          <strong>Authentication Status:</strong>
        </div>
        {user ? (
          <div className="ml-4 space-y-1 text-green-700">
            <div>✅ User is logged in</div>
            <div>
              <strong>UID:</strong> {user.uid}
            </div>
            <div>
              <strong>Email:</strong> {user.email}
            </div>
            <div>
              <strong>Display Name:</strong> {user.displayName || 'Not set'}
            </div>
            <div>
              <strong>Provider:</strong>{' '}
              {user.providerData[0]?.providerId || 'Unknown'}
            </div>
          </div>
        ) : (
          <div className="ml-4 text-red-700">❌ No user logged in</div>
        )}

        <hr className="my-2" />

        <div className="text-xs text-gray-600">
          <strong>Expected for Development:</strong>
          <br />
          Project ID should be: junkyard-dev-9497a
          <br />
          Auth Domain should be: junkyard-dev-9497a.firebaseapp.com
        </div>
      </div>
    </div>
  );
};

export default AuthDebug;
