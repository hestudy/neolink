import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditBookmarkDialog } from './EditBookmarkDialog';
import { Bookmark } from '@neolink/shared/schemas';

// Mock the stores and utilities
vi.mock('@/stores/bookmarks', () => ({
  useBookmarksStore: () => ({
    updateBookmark: vi.fn(),
  }),
}));

vi.mock('@/lib/toast', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showLoading: vi.fn(() => 'mock-toast-id'),
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
    await user.clear(tagInput);
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

    vi.mocked(require('@/stores/bookmarks').useBookmarksStore).mockReturnValue({
      updateBookmark: mockUpdateBookmark,
    });

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

    vi.mocked(require('@/stores/bookmarks').useBookmarksStore).mockReturnValue({
      updateBookmark: mockUpdateBookmark,
    });

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

    vi.mocked(require('@/stores/bookmarks').useBookmarksStore).mockReturnValue({
      updateBookmark: mockUpdateBookmark,
    });

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
