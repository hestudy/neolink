import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import type { UserContext } from '@neolink/shared';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage and sessionStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Test component that uses useAuth
const TestComponent = () => {
  const { user, isLoading, isAuthenticated, login, register, logout } =
    useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="authenticated">
        {isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </div>
      <div data-testid="user">{user ? user.email : 'no-user'}</div>
      <button
        onClick={async () => {
          try {
            await login('test@example.com', 'password', false);
          } catch (error) {
            // Handle login error silently for testing
          }
        }}
      >
        Login
      </button>
      <button
        onClick={async () => {
          try {
            await register('test@example.com', 'password', 'Test User');
          } catch (error) {
            // Handle register error silently for testing
          }
        }}
      >
        Register
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  it('should provide initial authentication state', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent(
      'not-authenticated'
    );
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });

  it('should handle successful login', async () => {
    const mockUser: UserContext = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      emailVerified: true,
      role: 'user',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      }),
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');

    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'authenticated'
      );
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'access_token',
      'access-token'
    );
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'refresh_token',
      'refresh-token'
    );
  });

  it('should handle login with remember me', async () => {
    const mockUser: UserContext = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      emailVerified: true,
      role: 'user',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      }),
    });

    const TestComponentRemember = () => {
      const { login } = useAuth();
      return (
        <button onClick={() => login('test@example.com', 'password', true)}>
          Login Remember
        </button>
      );
    };

    render(
      <AuthProvider>
        <TestComponentRemember />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login Remember');

    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'access_token',
        'access-token'
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token'
      );
    });
  });

  it('should handle failed login', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        message: '登录失败',
      }),
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');

    // The login error is handled internally and doesn't throw
    // Instead, we should verify the state remains unchanged
    await act(async () => {
      loginButton.click();
    });

    // Wait for any async operations to complete
    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'not-authenticated'
      );
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });
  });

  it('should handle successful registration', async () => {
    const mockUser: UserContext = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      emailVerified: false,
      role: 'user',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      }),
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const registerButton = screen.getByText('Register');

    await act(async () => {
      registerButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'authenticated'
      );
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });
  });

  it('should handle logout', async () => {
    // First set up an authenticated state
    const mockUser: UserContext = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      emailVerified: true,
      role: 'user',
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            user: mockUser,
            accessToken: 'token',
            refreshToken: 'refresh',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Login first
    const loginButton = screen.getByText('Login');
    await act(async () => {
      loginButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'authenticated'
      );
    });

    // Now logout
    const logoutButton = screen.getByText('Logout');
    await act(async () => {
      logoutButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'not-authenticated'
      );
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('access_token');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refresh_token');
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('refresh_token');
  });

  it('should restore user session on initialization with stored tokens', async () => {
    mockLocalStorage.getItem.mockReturnValue('stored-access-token');

    const mockUser: UserContext = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      emailVerified: true,
      role: 'user',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { user: mockUser },
      }),
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'authenticated'
      );
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });
  });

  it('should handle token refresh failure during initialization', async () => {
    mockLocalStorage.getItem.mockReturnValue('expired-access-token');

    mockFetch
      .mockRejectedValueOnce(new Error('获取用户信息失败'))
      .mockRejectedValueOnce(new Error('令牌刷新失败'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'not-authenticated'
      );
    });

    expect(mockLocalStorage.removeItem).toHaveBeenCalled();
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    const TestComponentOutside = () => {
      useAuth();
      return <div>test</div>;
    };

    expect(() => render(<TestComponentOutside />)).toThrow(
      'useAuth 必须在 AuthProvider 内使用'
    );
  });
});
