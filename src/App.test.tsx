import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock Firebase modules
jest.mock('./firebase', () => ({
  auth: {},
  db: {},
  storage: {},
}));

// Mock AuthContext
jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

test('renders application', () => {
  render(<App />);
  // This is a basic smoke test to ensure the app renders without crashing
  expect(document.body).toBeInTheDocument();
});

test('basic functionality check', () => {
  // Simple test to ensure testing framework works
  expect(1 + 1).toBe(2);
});
