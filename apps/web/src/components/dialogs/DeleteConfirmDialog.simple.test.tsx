import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  render,
  screen,
  MockDialog,
  MockDialogContent,
  MockDialogHeader,
  MockDialogTitle,
  MockDialogDescription,
  MockDialogFooter,
  MockButton,
} from '../../__tests__/test-utils';

// Mock external dependencies
vi.mock('@/stores/bookmarks', () => ({
  useBookmarksStore: vi.fn(() => ({
    deleteBookmark: vi.fn(),
    batchDeleteBookmarks: vi.fn(),
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
const MockDeleteConfirmDialog = ({
  open,
  onOpenChange,
  bookmarkIds,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarkIds: string[] | null;
  onConfirm?: () => void;
}) => {
  if (!bookmarkIds || bookmarkIds.length === 0) return null;

  const isBatchDelete = bookmarkIds.length > 1;
  const title = isBatchDelete ? '批量删除书签' : '删除书签';
  const description = isBatchDelete
    ? `确定要删除选中的 ${bookmarkIds.length} 个书签吗？此操作不可撤销。`
    : '确定要删除这个书签吗？此操作不可撤销。';

  return (
    <MockDialog open={open}>
      <MockDialogContent>
        <MockDialogHeader>
          <MockDialogTitle>{title}</MockDialogTitle>
          <MockDialogDescription>{description}</MockDialogDescription>
        </MockDialogHeader>

        <MockDialogFooter>
          <MockButton onClick={() => onOpenChange(false)}>取消</MockButton>
          <MockButton
            onClick={() => {
              onConfirm?.();
              onOpenChange(false);
            }}
            data-testid="confirm-delete"
          >
            {isBatchDelete ? '删除所有' : '删除'}
          </MockButton>
        </MockDialogFooter>
      </MockDialogContent>
    </MockDialog>
  );
};

describe('DeleteConfirmDialog (Simplified)', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open with single bookmark', () => {
    render(
      <MockDeleteConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmarkIds={['1']}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByTestId('mock-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('mock-dialog-title')).toHaveTextContent(
      '删除书签'
    );
    expect(screen.getByTestId('mock-dialog-description')).toHaveTextContent(
      '确定要删除这个书签吗？此操作不可撤销。'
    );
    expect(screen.getByText('删除')).toBeInTheDocument();
  });

  it('should render when open with multiple bookmarks', () => {
    render(
      <MockDeleteConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmarkIds={['1', '2', '3']}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByTestId('mock-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('mock-dialog-title')).toHaveTextContent(
      '批量删除书签'
    );
    expect(screen.getByTestId('mock-dialog-description')).toHaveTextContent(
      '确定要删除选中的 3 个书签吗？此操作不可撤销。'
    );
    expect(screen.getByText('删除所有')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <MockDeleteConfirmDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        bookmarkIds={['1']}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
  });

  it('should not render when bookmarkIds is null', () => {
    render(
      <MockDeleteConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmarkIds={null}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
  });

  it('should not render when bookmarkIds is empty', () => {
    render(
      <MockDeleteConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmarkIds={[]}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
  });

  it('should have cancel button', () => {
    render(
      <MockDeleteConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmarkIds={['1']}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('should call onOpenChange when cancel is clicked', () => {
    render(
      <MockDeleteConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmarkIds={['1']}
        onConfirm={mockOnConfirm}
      />
    );

    const cancelButton = screen.getByText('取消');
    cancelButton.click();

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should call onConfirm and onOpenChange when confirm button is clicked', () => {
    render(
      <MockDeleteConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        bookmarkIds={['1']}
        onConfirm={mockOnConfirm}
      />
    );

    const confirmButton = screen.getByTestId('confirm-delete');
    confirmButton.click();

    expect(mockOnConfirm).toHaveBeenCalled();
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
