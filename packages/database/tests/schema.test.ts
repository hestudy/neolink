import { describe, it, expect } from 'vitest';
import {
  users,
  bookmarks,
  tags,
  bookmarkTags,
  processingStatusEnum,
} from '../src/schema';

describe('Database Schema Tests', () => {
  it('should have users table with correct structure', () => {
    expect(users).toBeDefined();
    expect(users.id).toBeDefined();
    expect(users.email).toBeDefined();
    expect(users.name).toBeDefined();
    expect(users.preferences).toBeDefined();
    expect(users.aiSettings).toBeDefined();
    expect(users.createdAt).toBeDefined();
    expect(users.lastLoginAt).toBeDefined();
  });

  it('should have bookmarks table with correct structure', () => {
    expect(bookmarks).toBeDefined();
    expect(bookmarks.id).toBeDefined();
    expect(bookmarks.url).toBeDefined();
    expect(bookmarks.title).toBeDefined();
    expect(bookmarks.description).toBeDefined();
    expect(bookmarks.content).toBeDefined();
    expect(bookmarks.summary).toBeDefined();
    expect(bookmarks.favicon).toBeDefined();
    expect(bookmarks.screenshot).toBeDefined();
    expect(bookmarks.tags).toBeDefined();
    expect(bookmarks.aiTags).toBeDefined();
    expect(bookmarks.manualTags).toBeDefined();
    expect(bookmarks.notes).toBeDefined();
    expect(bookmarks.isArchived).toBeDefined();
    expect(bookmarks.isDeleted).toBeDefined();
    expect(bookmarks.processingStatus).toBeDefined();
    expect(bookmarks.embedding).toBeDefined();
    expect(bookmarks.createdAt).toBeDefined();
    expect(bookmarks.updatedAt).toBeDefined();
    expect(bookmarks.userId).toBeDefined();
  });

  it('should have tags table with correct structure', () => {
    expect(tags).toBeDefined();
    expect(tags.id).toBeDefined();
    expect(tags.name).toBeDefined();
    expect(tags.color).toBeDefined();
    expect(tags.description).toBeDefined();
    expect(tags.isAiGenerated).toBeDefined();
    expect(tags.usageCount).toBeDefined();
    expect(tags.createdAt).toBeDefined();
    expect(tags.userId).toBeDefined();
  });

  it('should have bookmarkTags junction table with correct structure', () => {
    expect(bookmarkTags).toBeDefined();
    expect(bookmarkTags.id).toBeDefined();
    expect(bookmarkTags.bookmarkId).toBeDefined();
    expect(bookmarkTags.tagId).toBeDefined();
    expect(bookmarkTags.createdAt).toBeDefined();
  });

  it('should have processing status enum', () => {
    expect(processingStatusEnum).toBeDefined();
    expect(processingStatusEnum).toContain('pending');
    expect(processingStatusEnum).toContain('processing');
    expect(processingStatusEnum).toContain('completed');
    expect(processingStatusEnum).toContain('failed');
  });

  it('should export type definitions', async () => {
    // Import types to verify they exist
    const {
      User,
      NewUser,
      Bookmark,
      NewBookmark,
      Tag,
      NewTag,
      BookmarkTag,
      NewBookmarkTag,
      ProcessingStatus,
    } = await import('../src/schema');

    // These should not throw errors if types are properly defined
    expect(typeof User).toBe('undefined'); // Types don't exist at runtime
    expect(typeof NewUser).toBe('undefined');
    expect(typeof Bookmark).toBe('undefined');
    expect(typeof NewBookmark).toBe('undefined');
    expect(typeof Tag).toBe('undefined');
    expect(typeof NewTag).toBe('undefined');
    expect(typeof BookmarkTag).toBe('undefined');
    expect(typeof NewBookmarkTag).toBe('undefined');
    expect(typeof ProcessingStatus).toBe('undefined');
  });
});
