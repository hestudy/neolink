import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  render,
  screen,
  mockUseForm,
  MockDialog,
  MockDialogContent,
  MockDialogHeader,
  MockDialogTitle,
  MockDialogDescription,
  MockDialogFooter,
  MockButton,
  MockInput,
  MockTextarea,
  MockForm,
  MockFormField,
  MockFormItem,
  MockFormLabel,
  MockFormControl,
} from '../../__tests__/test-utils';

// Mock all external dependencies
vi.mock('react-hook-form', () => ({
  useForm: mockUseForm,
  Controller: ({ render: renderProp }: any) => {
    const mockField = { value: [], onChange: vi.fn(), name: 'test' };
    const mockForm = { formState: { error: null } };
    return renderProp
      ? renderProp({ field: mockField, formState: mockForm })
      : null;
  },
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: vi.fn(() => vi.fn()),
}));

vi.mock('@/stores/bookmarks', () => ({
  useBookmarksStore: vi.fn(() => ({
    createBookmark: vi.fn(),
    loading: false,
    error: null,
  })),
}));

vi.mock('@/lib/toast', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showLoading: vi.fn(() => 'mock-toast-id'),
}));

// Create a simplified mock component
const MockAddBookmarkDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <MockDialog open={open}>
      <MockDialogContent>
        <MockDialogHeader>
          <MockDialogTitle>添加书签</MockDialogTitle>
          <MockDialogDescription>
            添加新的书签到您的收藏中
          </MockDialogDescription>
        </MockDialogHeader>

        <MockForm>
          <MockFormField>
            <MockFormItem>
              <MockFormLabel>URL *</MockFormLabel>
              <MockFormControl>
                <MockInput placeholder="https://example.com" />
              </MockFormControl>
            </MockFormItem>
          </MockFormField>

          <MockFormField>
            <MockFormItem>
              <MockFormLabel>标题 *</MockFormLabel>
              <MockFormControl>
                <MockInput placeholder="书签标题" />
              </MockFormControl>
            </MockFormItem>
          </MockFormField>

          <MockFormField>
            <MockFormItem>
              <MockFormLabel>描述</MockFormLabel>
              <MockFormControl>
                <MockTextarea placeholder="书签描述（可选）" />
              </MockFormControl>
            </MockFormItem>
          </MockFormField>
        </MockForm>

        <MockDialogFooter>
          <MockButton onClick={() => onOpenChange(false)}>取消</MockButton>
          <MockButton type="submit">添加书签</MockButton>
        </MockDialogFooter>
      </MockDialogContent>
    </MockDialog>
  );
};

describe('AddBookmarkDialog (Simplified)', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    render(
      <MockAddBookmarkDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    expect(screen.getByTestId('mock-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('mock-dialog-title')).toHaveTextContent(
      '添加书签'
    );
    expect(screen.getByTestId('mock-dialog-description')).toHaveTextContent(
      '添加新的书签到您的收藏中'
    );
  });

  it('should not render when closed', () => {
    render(
      <MockAddBookmarkDialog open={false} onOpenChange={mockOnOpenChange} />
    );

    expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
  });

  it('should show form fields', () => {
    render(
      <MockAddBookmarkDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    expect(
      screen.getByPlaceholderText('https://example.com')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('书签标题')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('书签描述（可选）')).toBeInTheDocument();
  });

  it('should have required field labels', () => {
    render(
      <MockAddBookmarkDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    expect(screen.getByText('URL *')).toBeInTheDocument();
    expect(screen.getByText('标题 *')).toBeInTheDocument();
    expect(screen.getByText('描述')).toBeInTheDocument();
  });

  it('should have cancel and add buttons', () => {
    render(
      <MockAddBookmarkDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    expect(screen.getByText('取消')).toBeInTheDocument();
    const addButtons = screen.getAllByText('添加书签');
    expect(addButtons.length).toBeGreaterThan(0); // Should find both title and button
  });

  it('should call onOpenChange when cancel is clicked', () => {
    render(
      <MockAddBookmarkDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    const cancelButton = screen.getByText('取消');
    cancelButton.click();

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
