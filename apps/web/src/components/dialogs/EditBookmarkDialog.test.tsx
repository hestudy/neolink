import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditBookmarkDialog } from './EditBookmarkDialog';
import { Bookmark } from '@neolink/shared/schemas';
import { useBookmarksStore } from '@/stores/bookmarks';

// Mock react-hook-form
vi.mock('react-hook-form', () => ({
  useForm: () => ({
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
  }),
  Controller: ({ children, render: renderProp }: any) => {
    const mockField = {
      value: [],
      onChange: vi.fn(),
      onBlur: vi.fn(),
      name: 'test',
      ref: vi.fn(),
    };
    const mockForm = {
      formState: { error: null },
    };
    return renderProp
      ? renderProp({ field: mockField, formState: mockForm })
      : children;
  },
  FormProvider: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'form-provider' }, children),
  useFormContext: () => ({
    formState: { errors: {} },
    register: vi.fn(),
  }),
}));

// Mock @hookform/resolvers
vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: vi.fn(() => vi.fn()),
}));

// Mock the stores and utilities
vi.mock('@/stores/bookmarks', () => ({
  useBookmarksStore: vi.fn(() => ({
    updateBookmark: vi.fn(),
    bookmarks: [],
    loading: false,
    error: null,
    fetchBookmarks: vi.fn(),
    createBookmark: vi.fn(),
    deleteBookmark: vi.fn(),
    setFilters: vi.fn(),
    setPage: vi.fn(),
    selectedBookmarks: [],
    editingBookmark: null,
    processingOperations: new Map(),
    selectBookmark: vi.fn(),
    selectAllBookmarks: vi.fn(),
    clearSelection: vi.fn(),
    setEditingBookmark: vi.fn(),
    batchDeleteBookmarks: vi.fn(),
    batchUpdateTags: vi.fn(),
    filters: {},
    pagination: { page: 1, limit: 20, total: 0 },
  })),
}));

vi.mock('@/lib/toast', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showLoading: vi.fn(() => 'mock-toast-id'),
}));

// Mock all UI components to avoid React hooks issues
vi.mock('@neolink/ui', () => ({
  Dialog: ({ children, open }: any) =>
    open
      ? React.createElement('div', { 'data-testid': 'dialog' }, children)
      : null,
  DialogContent: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'dialog-content' }, children),
  DialogHeader: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'dialog-header' }, children),
  DialogTitle: ({ children }: any) => React.createElement('h2', {}, children),
  DialogDescription: ({ children }: any) =>
    React.createElement('p', {}, children),
  DialogFooter: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'dialog-footer' }, children),
  Button: ({ children, onClick }: any) =>
    React.createElement('button', { onClick }, children),
  Input: ({ value, onChange, ...props }: any) =>
    React.createElement('input', { value, onChange, ...props }),
  Label: ({ children }: any) => React.createElement('label', {}, children),
  Textarea: ({ value, onChange, ...props }: any) =>
    React.createElement('textarea', { value, onChange, ...props }),
}));

vi.mock('@/components/ui/form', () => ({
  Form: ({ children }: any) => React.createElement('form', {}, children),
  FormControl: ({ children }: any) => React.createElement('div', {}, children),
  FormField: ({ children, render }: any) => {
    const mockField = { value: '', onChange: vi.fn(), name: 'test' };
    const mockForm = { formState: { error: null } };
    return render
      ? render({ field: mockField, formState: mockForm })
      : children;
  },
  FormItem: ({ children }: any) => React.createElement('div', {}, children),
  FormLabel: ({ children }: any) => React.createElement('label', {}, children),
  FormMessage: ({ children }: any) => React.createElement('div', {}, children),
}));

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

describe('EditBookmarkDialog', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open with bookmark data', () => {
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    expect(screen.getByText('编辑书签')).toBeInTheDocument();
    expect(
      screen.getByText('修改书签的标题、描述、标签和备注信息')
    ).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <EditBookmarkDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    expect(screen.queryByText('编辑书签')).not.toBeInTheDocument();
  });

  it('should not render when bookmark is null', () => {
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={null}
      />
    );

    expect(screen.queryByText('编辑书签')).not.toBeInTheDocument();
  });

  it('should populate form with bookmark data', () => {
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    expect(screen.getByDisplayValue('测试书签')).toBeInTheDocument();
    expect(screen.getByDisplayValue('这是一个测试描述')).toBeInTheDocument();
    expect(screen.getByText('测试')).toBeInTheDocument();
    expect(screen.getByText('技术')).toBeInTheDocument();
  });

  it('should display URL as readonly', () => {
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText('网页地址')).toBeInTheDocument();
  });

  it('should validate required title field', async () => {
    const user = userEvent.setup();
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    const titleInput = screen.getByDisplayValue('测试书签');
    await user.clear(titleInput);

    const submitButton = screen.getByRole('button', { name: /保存修改/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('标题不能为空')).toBeInTheDocument();
    });
  });

  it('should add new tags', async () => {
    const user = userEvent.setup();
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    const tagInput = screen.getByPlaceholderText('添加标签...');
    await user.type(tagInput, '新标签');
    await user.keyboard('{Enter}');

    expect(screen.getByText('新标签')).toBeInTheDocument();
  });

  it('should remove existing tags', async () => {
    const user = userEvent.setup();
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    // Find and click the remove button for '测试' tag
    const testTag = screen.getByText('测试');
    const removeButton = testTag.parentElement?.querySelector('button');
    expect(removeButton).toBeInTheDocument();

    if (removeButton) {
      await user.click(removeButton);
    }

    expect(screen.queryByText('测试')).not.toBeInTheDocument();
  });

  it('should enforce maximum tag limit of 20', async () => {
    const bookmarkWithManyTags = {
      ...mockBookmark,
      tags: Array.from({ length: 19 }, (_, i) => `tag-${i}`),
    };

    const user = userEvent.setup();
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={bookmarkWithManyTags}
      />
    );

    const tagInput = screen.getByPlaceholderText('添加标签...');

    // Add one more tag (should work - 20th tag)
    await user.type(tagInput, 'tag-19');
    await user.keyboard('{Enter}');
    expect(screen.getByText('tag-19')).toBeInTheDocument();

    // Try to add 21st tag (should not work)
    await user.click(tagInput);
    await user.keyboard('{Control>}a{/Control}');
    await user.type(tagInput, 'tag-20');
    await user.keyboard('{Enter}');
    expect(screen.queryByText('tag-20')).not.toBeInTheDocument();
  });

  it('should prevent duplicate tags', async () => {
    const user = userEvent.setup();
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    const tagInput = screen.getByPlaceholderText('添加标签...');
    await user.type(tagInput, '测试'); // Try to add existing tag
    await user.keyboard('{Enter}');

    // Should still only appear once
    const testTags = screen.getAllByText('测试');
    expect(testTags).toHaveLength(1);
  });

  it('should show correct tag count', async () => {
    const user = userEvent.setup();
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    expect(screen.getByText('最多添加 20 个标签 (2/20)')).toBeInTheDocument();

    const tagInput = screen.getByPlaceholderText('添加标签...');
    await user.type(tagInput, '新标签');
    await user.keyboard('{Enter}');

    expect(screen.getByText('最多添加 20 个标签 (3/20)')).toBeInTheDocument();
  });

  it('should call updateBookmark on form submission', async () => {
    const mockUpdateBookmark = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useBookmarksStore).mockReturnValue({
      updateBookmark: mockUpdateBookmark,
    } as any);

    const user = userEvent.setup();
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    const titleInput = screen.getByDisplayValue('测试书签');
    await user.clear(titleInput);
    await user.type(titleInput, '更新后的标题');

    const submitButton = screen.getByRole('button', { name: /保存修改/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateBookmark).toHaveBeenCalledWith('1', {
        title: '更新后的标题',
        description: '这是一个测试描述',
        tags: ['测试', '技术'],
        isArchived: false,
        isFavorite: false,
      });
    });
  });

  it('should show loading state during submission', async () => {
    const mockUpdateBookmark = vi.fn(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    vi.mocked(useBookmarksStore).mockReturnValue({
      updateBookmark: mockUpdateBookmark,
    } as any);

    const user = userEvent.setup();
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    const submitButton = screen.getByRole('button', { name: /保存修改/ });
    await user.click(submitButton);

    expect(screen.getByText('更新中...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('should call onOpenChange with false on successful submission', async () => {
    const mockUpdateBookmark = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useBookmarksStore).mockReturnValue({
      updateBookmark: mockUpdateBookmark,
    } as any);

    const user = userEvent.setup();
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    const submitButton = screen.getByRole('button', { name: /保存修改/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should call onOpenChange with false when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(
      <EditBookmarkDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmark={mockBookmark}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /取消/ });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
