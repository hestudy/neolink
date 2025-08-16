import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { vector } from 'pgvector/drizzle-orm';

// Users table
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    name: text('name'),
    preferences: jsonb('preferences').default({}),
    aiSettings: jsonb('ai_settings').default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastLoginAt: timestamp('last_login_at'),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
  })
);

// Processing status enum type
export const processingStatusEnum = [
  'pending',
  'processing',
  'completed',
  'failed',
] as const;

// Bookmarks table
export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    url: text('url').notNull(),
    title: text('title'),
    description: text('description'),
    content: text('content'),
    summary: text('summary'),
    favicon: text('favicon'),
    screenshot: text('screenshot'),
    tags: jsonb('tags').default([]),
    aiTags: jsonb('ai_tags').default([]),
    manualTags: jsonb('manual_tags').default([]),
    notes: text('notes'),
    isArchived: boolean('is_archived').default(false).notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    processingStatus: text('processing_status').default('pending').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_bookmarks_user_id').on(table.userId),
    createdAtIdx: index('idx_bookmarks_created_at').on(table.createdAt),
    urlIdx: index('idx_bookmarks_url').on(table.url),
    isDeletedIdx: index('idx_bookmarks_is_deleted').on(table.isDeleted),
    processingStatusIdx: index('idx_bookmarks_processing_status').on(
      table.processingStatus
    ),
    embeddingIdx: index('idx_bookmarks_embedding').using(
      'ivfflat',
      table.embedding
    ),
  })
);

// Tags table
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    color: text('color'),
    description: text('description'),
    isAiGenerated: boolean('is_ai_generated').default(false).notNull(),
    usageCount: integer('usage_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_tags_user_id').on(table.userId),
    nameIdx: index('idx_tags_name').on(table.name),
    isAiGeneratedIdx: index('idx_tags_is_ai_generated').on(table.isAiGenerated),
  })
);

// Bookmark tags junction table
export const bookmarkTags = pgTable(
  'bookmark_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookmarkId: uuid('bookmark_id')
      .references(() => bookmarks.id, { onDelete: 'cascade' })
      .notNull(),
    tagId: uuid('tag_id')
      .references(() => tags.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    bookmarkIdIdx: index('idx_bookmark_tags_bookmark_id').on(table.bookmarkId),
    tagIdIdx: index('idx_bookmark_tags_tag_id').on(table.tagId),
  })
);

// Type definitions
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type BookmarkTag = typeof bookmarkTags.$inferSelect;
export type NewBookmarkTag = typeof bookmarkTags.$inferInsert;

// Processing status type
export type ProcessingStatus = (typeof processingStatusEnum)[number];
