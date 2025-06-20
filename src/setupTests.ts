// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Add TextEncoder/TextDecoder polyfill for Node.js test environment
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock Firebase completely to avoid Node.js compatibility issues
jest.mock('./firebase', () => ({
  auth: {
    currentUser: null,
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
  },
  db: {},
  storage: {},
  getCurrentUserId: jest.fn(() => 'test-user-id'),
}));

// Mock Firebase Auth Context
jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: null,
    logout: jest.fn(),
    loading: false,
  }),
}));
