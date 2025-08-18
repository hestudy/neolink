import { vi } from 'vitest';

// Mock data store
const mockData = {
  users: new Map(),
  bookmarks: new Map(),
};

let userIdCounter = 1;
let bookmarkIdCounter = 1;

// Helper to generate IDs
const generateUserId = () => `user-${userIdCounter++}`;
const generateBookmarkId = () => `bookmark-${bookmarkIdCounter++}`;

// Mock database implementation
export const createMockDb = () => ({
  insert: vi.fn().mockImplementation((table) => {
    const mockInsert = {
      values: vi.fn().mockImplementation((data) => {
        const mockValues = {
          returning: vi.fn().mockImplementation(() => {
            // Check table name by comparing with known table objects
            const tableName = table?.name || 'unknown';

            if (
              tableName === 'users' ||
              JSON.stringify(table).includes('users')
            ) {
              const user = {
                id: generateUserId(),
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              mockData.users.set(user.id, user);
              return Promise.resolve([user]);
            }

            if (
              tableName === 'bookmarks' ||
              JSON.stringify(table).includes('bookmarks')
            ) {
              const bookmark = {
                id: generateBookmarkId(),
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
              };
              mockData.bookmarks.set(bookmark.id, bookmark);
              return Promise.resolve([bookmark]);
            }

            // Default fallback - create a generic object
            const defaultObj = {
              id: generateUserId(),
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            return Promise.resolve([defaultObj]);
          }),
        };

        // Return the values object directly for chaining
        return mockValues;
      }),
    };

    // Return the insert object for chaining
    return mockInsert;
  }),

  select: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation((table) => ({
      where: vi.fn().mockImplementation((_condition) => ({
        limit: vi.fn().mockImplementation((limitNum) => {
          if (table === 'users') {
            return Promise.resolve(
              Array.from(mockData.users.values()).slice(0, limitNum)
            );
          }
          if (table === 'bookmarks') {
            return Promise.resolve(
              Array.from(mockData.bookmarks.values()).slice(0, limitNum)
            );
          }
          return Promise.resolve([]);
        }),
        offset: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation((limitNum) => {
            if (table === 'bookmarks') {
              return Promise.resolve(
                Array.from(mockData.bookmarks.values()).slice(0, limitNum)
              );
            }
            return Promise.resolve([]);
          }),
        })),
      })),
    })),
  })),

  update: vi.fn().mockImplementation((table) => ({
    set: vi.fn().mockImplementation((data) => ({
      where: vi.fn().mockImplementation((_condition) => ({
        returning: vi.fn().mockImplementation(() => {
          if (table === 'bookmarks') {
            const bookmarks = Array.from(mockData.bookmarks.values());
            if (bookmarks.length > 0) {
              const updated = {
                ...bookmarks[0],
                ...data,
                updatedAt: new Date(),
              };
              mockData.bookmarks.set(updated.id, updated);
              return Promise.resolve([updated]);
            }
          }
          return Promise.resolve([]);
        }),
      })),
    })),
  })),

  delete: vi.fn().mockImplementation((table) => ({
    where: vi.fn().mockImplementation((_condition) => ({
      returning: vi.fn().mockImplementation(() => {
        if (table === 'bookmarks') {
          const bookmarks = Array.from(mockData.bookmarks.values());
          if (bookmarks.length > 0) {
            const deleted = { ...bookmarks[0], deletedAt: new Date() };
            mockData.bookmarks.set(deleted.id, deleted);
            return Promise.resolve([deleted]);
          }
        }
        return Promise.resolve([]);
      }),
    })),
  })),
});

// Reset mock data between tests
export const resetMockData = () => {
  mockData.users.clear();
  mockData.bookmarks.clear();
  userIdCounter = 1;
  bookmarkIdCounter = 1;
};
