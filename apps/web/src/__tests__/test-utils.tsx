import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// Mock all problematic hooks at module level
const mockUseForm = () => ({
  register: vi.fn(() => ({
    name: 'test',
    onBlur: vi.fn(),
    onChange: vi.fn(),
    ref: vi.fn(),
  })),
  handleSubmit: vi.fn((fn) => (e?: React.FormEvent) => {
    e?.preventDefault();
    return fn({});
  }),
  formState: {
    errors: {},
    isSubmitting: false,
    isValid: true,
  },
  setValue: vi.fn(),
  watch: vi.fn(() => []),
  reset: vi.fn(),
  control: {},
  getValues: vi.fn(() => ({})),
});

// Create a wrapper that provides all necessary contexts
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div data-testid="test-wrapper">{children}</div>;
};

// Custom render function that uses our wrapper
const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) =>
  render(ui, {
    wrapper: TestWrapper,
    ...options,
  });

// Mock components for testing
export const MockDialog = ({ children, open }: any) =>
  open ? <div data-testid="mock-dialog">{children}</div> : null;

export const MockDialogContent = ({ children }: any) => (
  <div data-testid="mock-dialog-content">{children}</div>
);

export const MockDialogHeader = ({ children }: any) => (
  <div data-testid="mock-dialog-header">{children}</div>
);

export const MockDialogTitle = ({ children }: any) => (
  <h2 data-testid="mock-dialog-title">{children}</h2>
);

export const MockDialogDescription = ({ children }: any) => (
  <p data-testid="mock-dialog-description">{children}</p>
);

export const MockDialogFooter = ({ children }: any) => (
  <div data-testid="mock-dialog-footer">{children}</div>
);

export const MockButton = ({
  children,
  onClick,
  type,
  'data-testid': dataTestId,
  ...props
}: any) => (
  <button
    data-testid={dataTestId || 'mock-button'}
    onClick={onClick}
    type={type}
    {...props}
  >
    {children}
  </button>
);

export const MockInput = ({ value, onChange, ...props }: any) => (
  <input
    data-testid="mock-input"
    value={value}
    onChange={onChange}
    {...props}
  />
);

export const MockTextarea = ({ value, onChange, ...props }: any) => (
  <textarea
    data-testid="mock-textarea"
    value={value}
    onChange={onChange}
    {...props}
  />
);

export const MockLabel = ({ children }: any) => (
  <label data-testid="mock-label">{children}</label>
);

export const MockForm = ({ children }: any) => (
  <form data-testid="mock-form">{children}</form>
);

export const MockFormField = ({ children, render }: any) => {
  const mockField = { value: '', onChange: vi.fn(), name: 'test' };
  const mockForm = { formState: { error: null } };
  return render ? render({ field: mockField, formState: mockForm }) : children;
};

export const MockFormItem = ({ children }: any) => (
  <div data-testid="mock-form-item">{children}</div>
);

export const MockFormLabel = ({ children }: any) => (
  <label data-testid="mock-form-label">{children}</label>
);

export const MockFormControl = ({ children }: any) => (
  <div data-testid="mock-form-control">{children}</div>
);

export const MockFormMessage = ({ children }: any) => (
  <div data-testid="mock-form-message">{children}</div>
);

// Export everything that testing-library exports
export * from '@testing-library/react';
// Override the render method
export { customRender as render };

export { mockUseForm };
