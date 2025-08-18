import React from 'react';
import { render, screen } from '@testing-library/react';
import { BookmarkCard } from './BookmarkCard';
import { Bookmark } from '@neolink/shared/schemas';

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

describe('BookmarkCard', () => {
  it('should render bookmark title and description', () => {
    render(<BookmarkCard bookmark={mockBookmark} />);

    expect(screen.getByText('测试书签')).toBeInTheDocument();
    expect(screen.getByText('这是一个测试描述')).toBeInTheDocument();
  });

  it('should render tags when provided', () => {
    render(<BookmarkCard bookmark={mockBookmark} />);

    expect(screen.getByText('测试')).toBeInTheDocument();
    expect(screen.getByText('技术')).toBeInTheDocument();
  });

  it('should render fallback description when description is empty', () => {
    const bookmarkWithoutDescription = { ...mockBookmark, description: '' };
    render(<BookmarkCard bookmark={bookmarkWithoutDescription} />);

    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('should render favicon when provided', () => {
    render(<BookmarkCard bookmark={mockBookmark} />);

    const img = screen.getByAltText('测试书签');
    expect(img).toHaveAttribute('src', 'https://example.com/favicon.ico');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('should not render favicon when not provided', () => {
    const bookmarkWithoutFavicon = { ...mockBookmark, favicon: undefined };
    render(<BookmarkCard bookmark={bookmarkWithoutFavicon} />);

    expect(screen.queryByAltText('测试书签')).not.toBeInTheDocument();
  });

  it('should call onEdit when edit button is clicked', () => {
    const mockEdit = vi.fn();
    render(<BookmarkCard bookmark={mockBookmark} onEdit={mockEdit} />);

    const editButton = screen.getByLabelText('编辑 测试书签');
    editButton.click();

    expect(mockEdit).toHaveBeenCalledWith('1');
  });

  it('should call onDelete when delete button is clicked', () => {
    const mockDelete = vi.fn();
    render(<BookmarkCard bookmark={mockBookmark} onDelete={mockDelete} />);

    const deleteButton = screen.getByLabelText('删除 测试书签');
    deleteButton.click();

    expect(mockDelete).toHaveBeenCalledWith('1');
  });

  it('should not show edit/delete buttons when handlers are not provided', () => {
    render(<BookmarkCard bookmark={mockBookmark} />);

    expect(screen.queryByLabelText('编辑 测试书签')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('删除 测试书签')).not.toBeInTheDocument();
  });
});
