import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import * as React from 'react';

// Mock window.localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock window.location
const mockLocation = {
  href: '',
  assign: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock window.open
Object.defineProperty(window, 'open', {
  value: vi.fn(),
  writable: true,
});

// Make React available globally
(globalThis as any).React = React;

// Mock React JSX Runtime
vi.mock('react/jsx-runtime', () => ({
  jsx: React.createElement,
  jsxs: React.createElement,
  Fragment: React.Fragment,
}));
