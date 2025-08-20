import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import RegisterPage from '../page';

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
const mockRegister = vi.fn();
const mockUseAuth = {
  register: mockRegister,
  user: null,
  isLoading: false,
  isAuthenticated: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth,
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render register form with all required fields', () => {
    render(<RegisterPage />);

    expect(screen.getByText('注册 NeoLink')).toBeInTheDocument();
    expect(
      screen.getByText('创建您的账户开始管理智能书签')
    ).toBeInTheDocument();

    expect(screen.getByLabelText('姓名')).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱地址')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByLabelText('确认密码')).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: '注册账户' })
    ).toBeInTheDocument();
  });

  it('should validate required fields and show error messages', async () => {
    render(<RegisterPage />);

    const submitButton = screen.getByRole('button', { name: '注册账户' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('请输入您的姓名')).toBeInTheDocument();
      expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument();
      expect(screen.getByText('密码至少需要8个字符')).toBeInTheDocument();
      expect(screen.getByText('请确认密码')).toBeInTheDocument();
    });
  });

  it('should validate email format', async () => {
    render(<RegisterPage />);

    const emailInput = screen.getByPlaceholderText('your@email.com');
    const submitButton = screen.getByRole('button', { name: '注册账户' });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument();
    });
  });

  it('should validate password length', async () => {
    render(<RegisterPage />);

    const passwordInput = screen.getByPlaceholderText('请输入密码');
    const submitButton = screen.getByRole('button', { name: '注册账户' });

    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('密码至少需要8个字符')).toBeInTheDocument();
    });
  });

  it('should validate password confirmation match', async () => {
    render(<RegisterPage />);

    const passwordInput = screen.getByPlaceholderText('请输入密码');
    const confirmPasswordInput = screen.getByPlaceholderText('请再次输入密码');
    const submitButton = screen.getByRole('button', { name: '注册账户' });

    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'different123' },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('密码确认不匹配')).toBeInTheDocument();
    });
  });

  it('should submit form with correct data', async () => {
    mockRegister.mockResolvedValue(undefined);

    render(<RegisterPage />);

    const nameInput = screen.getByPlaceholderText('请输入您的姓名');
    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('请输入密码');
    const confirmPasswordInput = screen.getByPlaceholderText('请再次输入密码');
    const submitButton = screen.getByRole('button', { name: '注册账户' });

    // Fill form
    fireEvent.change(nameInput, { target: { value: '测试用户' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'password123' },
    });

    // Submit form
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        '测试用户'
      );
    });
  });

  it('should handle registration errors and display error messages', async () => {
    const { showError } = await import('@/lib/toast');
    mockRegister.mockRejectedValue(new Error('邮箱已存在'));

    render(<RegisterPage />);

    const nameInput = screen.getByPlaceholderText('请输入您的姓名');
    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('请输入密码');
    const confirmPasswordInput = screen.getByPlaceholderText('请再次输入密码');
    const submitButton = screen.getByRole('button', { name: '注册账户' });

    // Fill form
    fireEvent.change(nameInput, { target: { value: '测试用户' } });
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'password123' },
    });

    // Submit form
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith('邮箱已存在');
    });
  });

  it('should show loading state during registration', async () => {
    mockRegister.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(<RegisterPage />);

    const nameInput = screen.getByPlaceholderText('请输入您的姓名');
    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('请输入密码');
    const confirmPasswordInput = screen.getByPlaceholderText('请再次输入密码');
    const submitButton = screen.getByRole('button', { name: '注册账户' });

    // Fill form
    fireEvent.change(nameInput, { target: { value: '测试用户' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'password123' },
    });

    // Submit form
    fireEvent.click(submitButton);

    // Check loading state
    expect(screen.getByText('注册中...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('should have link to login page', () => {
    render(<RegisterPage />);

    expect(screen.getByText('已有账户？')).toBeInTheDocument();
    expect(screen.getByText('立即登录')).toBeInTheDocument();

    const loginLink = screen.getByRole('link', { name: /立即登录/i });
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('should disable all form fields during loading', async () => {
    mockRegister.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(<RegisterPage />);

    const nameInput = screen.getByPlaceholderText('请输入您的姓名');
    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('请输入密码');
    const confirmPasswordInput = screen.getByPlaceholderText('请再次输入密码');
    const submitButton = screen.getByRole('button', { name: '注册账户' });

    // Fill form
    fireEvent.change(nameInput, { target: { value: '测试用户' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'password123' },
    });

    // Submit form
    fireEvent.click(submitButton);

    // Check all inputs are disabled
    await waitFor(() => {
      expect(nameInput).toBeDisabled();
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(confirmPasswordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });
  });
});
