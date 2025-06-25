import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { RateLimitedAuth } from '../utils/rateLimitedFirebase';
import AuthDebug from './AuthDebug';

const APP_VERSION = '2.25062025c';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const rateLimitedAuth = new RateLimitedAuth(auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await rateLimitedAuth.signInWithEmailAndPassword(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Nie udało się zalogować');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-md w-full space-y-8">
        {/* Debug component - remove after fixing auth issues */}
        <AuthDebug />
        <div className="text-center">
          <img
            src={`${process.env.PUBLIC_URL}/icon-192x192.png`}
            alt="ScrapYard Logo"
            className="mx-auto h-20 w-20 object-contain rounded-lg shadow-lg"
          />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Zaloguj się do konta
          </h2>
        </div>
        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 text-base text-red-700 bg-red-100 border-l-4 border-red-500 rounded">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label
                className="block text-gray-700 text-lg font-medium"
                htmlFor="email"
              >
                Email
              </label>
              <input
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition duration-200"
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="Wprowadź swój email"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <label
                className="block text-gray-700 text-lg font-medium"
                htmlFor="password"
              >
                Hasło
              </label>
              <input
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition duration-200"
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Wprowadź swoje hasło"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-700 hover:bg-orange-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-lg font-semibold py-3 px-6 rounded-lg transition duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2"
            >
              {loading ? 'Logowanie...' : 'Zaloguj się'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer for login page */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 px-4 py-2">
        <div className="flex justify-center">
          <div className="text-xs text-gray-500">
            Wersja: <span className="font-medium">{APP_VERSION}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Login;
