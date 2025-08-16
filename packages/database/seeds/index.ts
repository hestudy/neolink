import { db } from '../src/connection';
import { users, bookmarks, tags, bookmarkTags } from '../src/schema';

// Sample user data
const sampleUsers = [
  {
    email: 'demo@neolink.com',
    name: 'Demo User',
    preferences: {
      theme: 'light',
      language: 'zh-CN',
      autoTag: true,
    },
    aiSettings: {
      enableAiSummary: true,
      enableAiTags: true,
      summaryLength: 'medium',
    },
  },
  {
    email: 'test@example.com',
    name: 'Test User',
    preferences: {
      theme: 'dark',
      language: 'en-US',
      autoTag: false,
    },
    aiSettings: {
      enableAiSummary: false,
      enableAiTags: false,
      summaryLength: 'short',
    },
  },
];

// Sample bookmark data
const sampleBookmarks = [
  {
    url: 'https://github.com/drizzle-team/drizzle-orm',
    title: 'Drizzle ORM - TypeScript ORM for SQL databases',
    description:
      'Drizzle ORM is a lightweight and performant TypeScript ORM with developer experience in mind.',
    content:
      "Drizzle ORM is a headless TypeScript ORM with a head. It looks like an ORM, it smells like an ORM, but it's not an ORM.",
    summary:
      'A modern TypeScript ORM that provides type safety and excellent developer experience.',
    tags: ['typescript', 'orm', 'database', 'sql'],
    aiTags: ['development', 'backend', 'database-tools'],
    manualTags: ['favorite', 'learning'],
    notes: 'Great ORM for TypeScript projects. Consider for future projects.',
    processingStatus: 'completed' as const,
  },
  {
    url: 'https://nextjs.org/docs',
    title: 'Next.js Documentation',
    description: 'Learn about Next.js features and API.',
    content:
      'Next.js is a React framework that gives you building blocks to create web applications.',
    summary: 'Comprehensive documentation for Next.js React framework.',
    tags: ['react', 'nextjs', 'frontend', 'documentation'],
    aiTags: ['web-development', 'framework', 'react-ecosystem'],
    manualTags: ['reference', 'documentation'],
    notes: 'Essential reference for Next.js development.',
    processingStatus: 'completed' as const,
  },
  {
    url: 'https://www.postgresql.org/docs/current/pgvector.html',
    title: 'pgvector: Open-source vector similarity search for Postgres',
    description:
      'pgvector is an open-source vector similarity search for Postgres.',
    content:
      'Store your vectors with the rest of your data. Supports exact and approximate nearest neighbor search.',
    summary:
      'PostgreSQL extension for vector similarity search and embeddings.',
    tags: ['postgresql', 'vector', 'search', 'ai'],
    aiTags: ['machine-learning', 'embeddings', 'similarity-search'],
    manualTags: ['research', 'ai-tools'],
    notes: 'Useful for implementing semantic search features.',
    processingStatus: 'completed' as const,
  },
];

// Sample tags data
const sampleTags = [
  {
    name: 'typescript',
    color: '#3178c6',
    description: 'TypeScript programming language',
    isAiGenerated: false,
    usageCount: 2,
  },
  {
    name: 'database',
    color: '#336791',
    description: 'Database related content',
    isAiGenerated: false,
    usageCount: 2,
  },
  {
    name: 'development',
    color: '#28a745',
    description: 'Software development',
    isAiGenerated: true,
    usageCount: 1,
  },
  {
    name: 'ai',
    color: '#ff6b6b',
    description: 'Artificial Intelligence',
    isAiGenerated: false,
    usageCount: 1,
  },
];

export async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // Clear existing data (in reverse order due to foreign keys)
    console.log('Clearing existing data...');
    await db.delete(bookmarkTags);
    await db.delete(bookmarks);
    await db.delete(tags);
    await db.delete(users);

    // Insert users
    console.log('Inserting users...');
    const insertedUsers = await db
      .insert(users)
      .values(sampleUsers)
      .returning();
    console.log(`✅ Inserted ${insertedUsers.length} users`);

    // Insert tags for the first user
    console.log('Inserting tags...');
    const tagsWithUserId = sampleTags.map((tag) => ({
      ...tag,
      userId: insertedUsers[0].id,
    }));
    const insertedTags = await db
      .insert(tags)
      .values(tagsWithUserId)
      .returning();
    console.log(`✅ Inserted ${insertedTags.length} tags`);

    // Insert bookmarks for the first user
    console.log('Inserting bookmarks...');
    const bookmarksWithUserId = sampleBookmarks.map((bookmark) => ({
      ...bookmark,
      userId: insertedUsers[0].id,
    }));
    const insertedBookmarks = await db
      .insert(bookmarks)
      .values(bookmarksWithUserId)
      .returning();
    console.log(`✅ Inserted ${insertedBookmarks.length} bookmarks`);

    // Create bookmark-tag relationships
    console.log('Creating bookmark-tag relationships...');
    const bookmarkTagRelations = [];

    // Link first bookmark with typescript and database tags
    const typescriptTag = insertedTags.find((tag) => tag.name === 'typescript');
    const databaseTag = insertedTags.find((tag) => tag.name === 'database');

    if (typescriptTag && databaseTag) {
      bookmarkTagRelations.push(
        { bookmarkId: insertedBookmarks[0].id, tagId: typescriptTag.id },
        { bookmarkId: insertedBookmarks[0].id, tagId: databaseTag.id }
      );
    }

    // Link third bookmark with ai and database tags
    const aiTag = insertedTags.find((tag) => tag.name === 'ai');
    if (aiTag && databaseTag) {
      bookmarkTagRelations.push(
        { bookmarkId: insertedBookmarks[2].id, tagId: aiTag.id },
        { bookmarkId: insertedBookmarks[2].id, tagId: databaseTag.id }
      );
    }

    if (bookmarkTagRelations.length > 0) {
      await db.insert(bookmarkTags).values(bookmarkTagRelations);
      console.log(
        `✅ Created ${bookmarkTagRelations.length} bookmark-tag relationships`
      );
    }

    console.log('🎉 Database seeding completed successfully!');

    return {
      users: insertedUsers.length,
      bookmarks: insertedBookmarks.length,
      tags: insertedTags.length,
      relationships: bookmarkTagRelations.length,
    };
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

export async function clearDatabase() {
  console.log('🧹 Clearing database...');

  try {
    await db.delete(bookmarkTags);
    await db.delete(bookmarks);
    await db.delete(tags);
    await db.delete(users);

    console.log('✅ Database cleared successfully');
  } catch (error) {
    console.error('❌ Database clearing failed:', error);
    throw error;
  }
}

// CLI runner
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'seed') {
    seedDatabase()
      .then((result) => {
        console.log('Seeding result:', result);
        process.exit(0);
      })
      .catch((error) => {
        console.error('Seeding failed:', error);
        process.exit(1);
      });
  } else if (command === 'clear') {
    clearDatabase()
      .then(() => {
        console.log('Database cleared');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Clearing failed:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage: tsx seeds/index.ts [seed|clear]');
    process.exit(1);
  }
}
