import { vi } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neolink:neolink_password@localhost:5432/neolink_test';

// Console mock to reduce noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

// Allow error logs to show for debugging
// vi.spyOn(console, 'error').mockImplementation(() => {});
