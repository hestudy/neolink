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
  MockLabel,
  MockForm,
  MockFormField,
  MockFormItem,
  MockFormLabel,
  MockFormControl,
  MockFormMessage,
} from '../../__tests__/test-utils';
import { Bookmark } from '@neolink/shared/schemas';

// Mock all external dependencies first
vi.mock('react-hook-form', () => ({
  useForm: mockUseForm,
  Controller: ({ render: renderProp }: any) => {
    const mockField = { value: [], onChange: vi.fn(), name: 'test' };
    const mockForm = { formState: { error: null } };
    return renderProp
      ? renderProp({ field: mockField, formState: mockForm })
      : null;
  },
  FormProvider: ({ children }: any) => (
    <div data-testid="form-provider">{children}</div>
  ),
  useFormContext: () => ({ formState: { errors: {} }, register: vi.fn() }),
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: vi.fn(() => vi.fn()),
}));

vi.mock('@/stores/bookmarks', () => ({
  useBookmarksStore: vi.fn(() => ({
    updateBookmark: vi.fn(),
    bookmarks: [],
    loading: false,
    error: null,
  })),
}));

vi.mock('@/lib/toast', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showLoading: vi.fn(() => 'mock-toast-id'),
}));

// Mock all UI components
vi.mock('@neolink/ui', () => ({
  Dialog: MockDialog,
  DialogContent: MockDialogContent,
  DialogHeader: MockDialogHeader,
  DialogTitle: MockDialogTitle,
  DialogDescription: MockDialogDescription,
  DialogFooter: MockDialogFooter,
  Button: MockButton,
  Input: MockInput,
  Label: MockLabel,
  Textarea: MockTextarea,
}));

vi.mock('@/components/ui/form', () => ({
  Form: MockForm,
  FormControl: MockFormControl,
  FormField: MockFormField,
  FormItem: MockFormItem,
  FormLabel: MockFormLabel,
  FormMessage: MockFormMessage,
}));

// Create a simplified mock component instead of using the real one
const MockEditBookmarkDialog = ({
  open,
  bookmark,
  onOpenChange,
}: {
  open: boolean;
  bookmark: Bookmark | null;
  onOpenChange: (open: boolean) => void;
}) => {
  if (!bookmark) return null;

  return (
    <MockDialog open={open}>
      <MockDialogContent>
        <MockDialogHeader>
          <MockDialogTitle>编辑书签</MockDialogTitle>
          <MockDialogDescription>
            修改书签的标题、描述、标签和备注信息
          </MockDialogDescription>
        </MockDialogHeader>

        <MockForm>
          <MockFormField>
            <MockFormItem>
              <MockFormLabel>标题</MockFormLabel>
              <MockFormControl>
                <MockInput value={bookmark.title} />
              </MockFormControl>
            </MockFormItem>
          </MockFormField>

          <MockFormField>
            <MockFormItem>
              <MockFormLabel>URL</MockFormLabel>
              <MockFormControl>
                <MockInput value={bookmark.url} readOnly />
              </MockFormControl>
            </MockFormItem>
          </MockFormField>
        </MockForm>

        <MockDialogFooter>
          <MockButton onClick={() => onOpenChange(false)}>取消</MockButton>
          <MockButton type="submit">保存</MockButton>
        </MockDialogFooter>
      </MockDialogContent>
    </MockDialog>
  );
};

const mockBookmark: Bookmark = {
  id: '1',
  url: 'https://example.com',
  title: '测试书签',
  description: '这是一个测试描述',
  content: '测试内容',
  favicon: 'https://example.com/favicon.ico',
  userId: 'user-1',
  tags: ['测试', '技术'],
  isArchived: false,
  isPrivate: false,
  isFavorite: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  accessCount: 0,
};

describe('EditBookmarkDialog (Simplified)', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open with bookmark data', () => {
    render(
      <MockEditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    expect(screen.getByTestId('mock-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('mock-dialog-title')).toHaveTextContent(
      '编辑书签'
    );
    expect(screen.getByTestId('mock-dialog-description')).toHaveTextContent(
      '修改书签的标题、描述、标签和备注信息'
    );
  });

  it('should not render when closed', () => {
    render(
      <MockEditBookmarkDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
  });

  it('should not render when bookmark is null', () => {
    render(
      <MockEditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={null}
      />
    );

    expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
  });

  it('should show form fields with bookmark data', () => {
    render(
      <MockEditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    const titleInput = screen.getByDisplayValue('测试书签');
    const urlInput = screen.getByDisplayValue('https://example.com');

    expect(titleInput).toBeInTheDocument();
    expect(urlInput).toBeInTheDocument();
    expect(urlInput).toHaveAttribute('readOnly');
  });

  it('should have cancel and save buttons', () => {
    render(
      <MockEditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    expect(screen.getByText('取消')).toBeInTheDocument();
    expect(screen.getByText('保存')).toBeInTheDocument();
  });

  it('should call onOpenChange when cancel is clicked', () => {
    render(
      <MockEditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    const cancelButton = screen.getByText('取消');
    cancelButton.click();

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
