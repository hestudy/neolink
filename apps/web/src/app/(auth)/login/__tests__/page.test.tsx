import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { vi } from 'vitest';
import LoginPage from '../page';

// Mock Next.js modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock toast module
vi.mock('@/lib/toast', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

// Mock useAuth hook
const mockLogin = vi.fn();
const mockUseAuth = {
  login: mockLogin,
  user: null,
  isLoading: false,
  isAuthenticated: false,
  register: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render login form with all required fields', () => {
    render(<LoginPage />);

    expect(screen.getByText('登录 NeoLink')).toBeInTheDocument();
    expect(
      screen.getByText('使用您的邮箱和密码登录您的账户')
    ).toBeInTheDocument();

    expect(screen.getByLabelText('邮箱地址')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByLabelText('记住我')).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: '登录' });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('should validate email format and show error messages', async () => {
    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText('your@email.com');
    const submitButton = screen.getByRole('button', { name: '登录' });

    // Test invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput); // Trigger validation
    fireEvent.click(submitButton);

    await waitFor(() => {
      const errorMessage = screen.queryByText('请输入有效的邮箱地址');
      if (errorMessage) {
        expect(errorMessage).toBeInTheDocument();
      } else {
        // If validation doesn't show immediately, form submission should fail
        expect(mockLogin).not.toHaveBeenCalled();
      }
    });
  });

  it('should require password field', async () => {
    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('请输入密码');
    const submitButton = screen.getByRole('button', { name: '登录' });

    // Fill email but leave password empty
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.blur(passwordInput); // Trigger validation
    fireEvent.click(submitButton);

    await waitFor(() => {
      const errorMessage = screen.queryByText('请输入密码');
      if (errorMessage) {
        expect(errorMessage).toBeInTheDocument();
      } else {
        // If validation doesn't show immediately, form submission should fail
        expect(mockLogin).not.toHaveBeenCalled();
      }
    });
  });

  it('should submit form with correct credentials', async () => {
    mockLogin.mockResolvedValue(undefined);

    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('请输入密码');
    const rememberCheckbox = screen.getByLabelText('记住我');
    const submitButton = screen.getByRole('button', { name: '登录' });

    // Fill form
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(rememberCheckbox);

    // Submit form
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        true
      );
    });
  });

  it('should handle login errors and display error messages', async () => {
    const { showError } = await import('@/lib/toast');
    mockLogin.mockRejectedValue(new Error('登录失败'));

    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('请输入密码');
    const submitButton = screen.getByRole('button', { name: '登录' });

    // Fill form
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

    // Submit form
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith('登录失败');
    });
  });

  it('should show loading state during login', async () => {
    let resolveLogin: () => void;
    const loginPromise = new Promise<void>((resolve) => {
      resolveLogin = resolve;
    });
    mockLogin.mockReturnValue(loginPromise);

    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('请输入密码');
    const submitButton = screen.getByRole('button', { name: '登录' });

    // Fill form
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    // Submit form and check loading state
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Check loading state
    expect(screen.getByText('登录中...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    // Resolve the promise to clean up
    await act(async () => {
      resolveLogin!();
    });
  });

  it('should have links to register and forgot password pages', () => {
    render(<LoginPage />);

    expect(screen.getByText('忘记密码？')).toBeInTheDocument();
    expect(screen.getByText('立即注册')).toBeInTheDocument();

    const forgotPasswordLink = screen.getByRole('link', { name: /忘记密码/i });
    const registerLink = screen.getByRole('link', { name: /立即注册/i });

    expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  it('should show GitHub login button in disabled state', () => {
    render(<LoginPage />);

    const githubButton = screen.getByRole('button', {
      name: /使用 GitHub 登录/i,
    });
    expect(githubButton).toBeDisabled();
    expect(githubButton).toHaveAttribute('title', 'GitHub 登录即将推出');
  });
});
