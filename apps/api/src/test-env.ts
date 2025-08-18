/**
 * Test environment setup
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret';
process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium-browser';

// Disable console output in tests
if (process.env.NODE_ENV === 'test') {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
}
