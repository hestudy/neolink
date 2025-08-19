import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { Bookmark } from '@neolink/shared/schemas';

// Mock the stores and utilities
vi.mock('../../stores/bookmarks', () => ({
  useBookmarksStore: vi.fn(() => ({
    deleteBookmark: vi.fn(),
    batchDeleteBookmarks: vi.fn(),
    clearSelection: vi.fn(),
  })),
}));

vi.mock('../../lib/toast', () => ({
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

const mockBookmarks: Bookmark[] = [
  mockBookmark,
  {
    ...mockBookmark,
    id: '2',
    title: '第二个书签',
    url: 'https://example2.com',
  },
  {
    ...mockBookmark,
    id: '3',
    title: '第三个书签',
    url: 'https://example3.com',
  },
];

describe('DeleteConfirmDialog', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Single bookmark deletion', () => {
    it('should render single bookmark deletion dialog', () => {
      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmark={mockBookmark}
          mode="single"
        />
      );

      expect(screen.getByText('确认删除书签')).toBeInTheDocument();
      expect(
        screen.getByText('你确定要删除书签 "测试书签" 吗？此操作无法撤销。')
      ).toBeInTheDocument();
      expect(screen.getByText('删除书签')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(
        <DeleteConfirmDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          bookmark={mockBookmark}
          mode="single"
        />
      );

      expect(screen.queryByText('确认删除书签')).not.toBeInTheDocument();
    });

    it('should show warning icon', () => {
      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmark={mockBookmark}
          mode="single"
        />
      );

      // Warning icon should be present (AlertTriangle)
      const warningIcon = document.querySelector('.text-red-600');
      expect(warningIcon).toBeInTheDocument();
    });

    it('should call deleteBookmark on confirm', async () => {
      const mockDeleteBookmark = vi.fn().mockResolvedValue(undefined);
      const { useBookmarksStore } = await import('../../stores/bookmarks');

      vi.mocked(useBookmarksStore).mockReturnValue({
        deleteBookmark: mockDeleteBookmark,
        batchDeleteBookmarks: vi.fn(),
        clearSelection: vi.fn(),
      });

      const user = userEvent.setup();
      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmark={mockBookmark}
          mode="single"
        />
      );

      const deleteButton = screen.getByRole('button', { name: /删除书签/ });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteBookmark).toHaveBeenCalledWith('1');
      });
    });

    it('should call onOpenChange with false after successful deletion', async () => {
      const mockDeleteBookmark = vi.fn().mockResolvedValue(undefined);
      const { useBookmarksStore } = await import('../../stores/bookmarks');

      vi.mocked(useBookmarksStore).mockReturnValue({
        deleteBookmark: mockDeleteBookmark,
        batchDeleteBookmarks: vi.fn(),
        clearSelection: vi.fn(),
      });

      const user = userEvent.setup();
      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmark={mockBookmark}
          mode="single"
        />
      );

      const deleteButton = screen.getByRole('button', { name: /删除书签/ });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should show loading state during deletion', async () => {
      const mockDeleteBookmark = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );
      const { useBookmarksStore } = await import('../../stores/bookmarks');

      vi.mocked(useBookmarksStore).mockReturnValue({
        deleteBookmark: mockDeleteBookmark,
        batchDeleteBookmarks: vi.fn(),
        clearSelection: vi.fn(),
      });

      const user = userEvent.setup();
      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmark={mockBookmark}
          mode="single"
        />
      );

      const deleteButton = screen.getByRole('button', { name: /删除书签/ });
      await user.click(deleteButton);

      expect(screen.getByText('删除中...')).toBeInTheDocument();
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('Batch bookmark deletion', () => {
    it('should render batch deletion dialog', () => {
      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmarks={mockBookmarks}
          mode="batch"
        />
      );

      expect(screen.getByText('批量删除书签')).toBeInTheDocument();
      expect(
        screen.getByText('你确定要删除选中的 3 个书签吗？此操作无法撤销。')
      ).toBeInTheDocument();
      expect(screen.getByText('删除 3 个书签')).toBeInTheDocument();
    });

    it('should show list of bookmarks to be deleted', () => {
      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmarks={mockBookmarks}
          mode="batch"
        />
      );

      expect(screen.getByText('将要删除的书签：')).toBeInTheDocument();
      expect(screen.getByText('• 测试书签')).toBeInTheDocument();
      expect(screen.getByText('• 第二个书签')).toBeInTheDocument();
      expect(screen.getByText('• 第三个书签')).toBeInTheDocument();
    });

    it('should truncate long bookmark list', () => {
      const manyBookmarks = Array.from({ length: 15 }, (_, i) => ({
        ...mockBookmark,
        id: `${i}`,
        title: `书签 ${i}`,
      }));

      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmarks={manyBookmarks}
          mode="batch"
        />
      );

      expect(screen.getByText('... 还有 5 个书签')).toBeInTheDocument();
    });

    it('should call batchDeleteBookmarks on confirm', async () => {
      const mockBatchDeleteBookmarks = vi.fn().mockResolvedValue(undefined);
      const mockClearSelection = vi.fn();
      const { useBookmarksStore } = await import('../../stores/bookmarks');

      vi.mocked(useBookmarksStore).mockReturnValue({
        deleteBookmark: vi.fn(),
        batchDeleteBookmarks: mockBatchDeleteBookmarks,
        clearSelection: mockClearSelection,
      });

      const user = userEvent.setup();
      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmarks={mockBookmarks}
          mode="batch"
        />
      );

      const deleteButton = screen.getByRole('button', {
        name: /删除 3 个书签/,
      });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockBatchDeleteBookmarks).toHaveBeenCalledWith(['1', '2', '3']);
        expect(mockClearSelection).toHaveBeenCalled();
      });
    });

    it('should show correct success message for batch deletion', async () => {
      const mockShowSuccess = vi.fn();
      const mockBatchDeleteBookmarks = vi.fn().mockResolvedValue(undefined);
      const { useBookmarksStore } = await import('../../stores/bookmarks');

      // Mock the toast module before using it
      vi.doMock('../../lib/toast', () => ({
        showSuccess: mockShowSuccess,
        showError: vi.fn(),
        showLoading: vi.fn(() => 'mock-toast-id'),
      }));

      vi.mocked(useBookmarksStore).mockReturnValue({
        deleteBookmark: vi.fn(),
        batchDeleteBookmarks: mockBatchDeleteBookmarks,
        clearSelection: vi.fn(),
      });

      const user = userEvent.setup();
      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmarks={mockBookmarks}
          mode="batch"
        />
      );

      const deleteButton = screen.getByRole('button', {
        name: /删除 3 个书签/,
      });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('成功删除 3 个书签');
      });
    });
  });

  describe('Common behavior', () => {
    it('should call onOpenChange with false when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmark={mockBookmark}
          mode="single"
        />
      );

      const cancelButton = screen.getByRole('button', { name: /取消/ });
      await user.click(cancelButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should handle deletion errors gracefully', async () => {
      const mockDeleteBookmark = vi
        .fn()
        .mockRejectedValue(new Error('删除失败'));
      const mockShowError = vi.fn();
      const { useBookmarksStore } = await import('../../stores/bookmarks');

      // Mock the toast module before using it
      vi.doMock('../../lib/toast', () => ({
        showSuccess: vi.fn(),
        showError: mockShowError,
        showLoading: vi.fn(() => 'mock-toast-id'),
      }));

      vi.mocked(useBookmarksStore).mockReturnValue({
        deleteBookmark: mockDeleteBookmark,
        batchDeleteBookmarks: vi.fn(),
        clearSelection: vi.fn(),
      });

      const user = userEvent.setup();
      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmark={mockBookmark}
          mode="single"
        />
      );

      const deleteButton = screen.getByRole('button', { name: /删除书签/ });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('删除失败');
      });
    });

    it('should disable cancel button during deletion', async () => {
      const mockDeleteBookmark = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );
      const { useBookmarksStore } = await import('../../stores/bookmarks');

      vi.mocked(useBookmarksStore).mockReturnValue({
        deleteBookmark: mockDeleteBookmark,
        batchDeleteBookmarks: vi.fn(),
        clearSelection: vi.fn(),
      });

      const user = userEvent.setup();
      render(
        <DeleteConfirmDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          bookmark={mockBookmark}
          mode="single"
        />
      );

      const deleteButton = screen.getByRole('button', { name: /删除书签/ });
      await user.click(deleteButton);

      const cancelButton = screen.getByRole('button', { name: /取消/ });
      expect(cancelButton).toBeDisabled();
    });
  });
});
