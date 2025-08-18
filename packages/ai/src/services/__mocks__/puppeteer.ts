import { vi } from 'vitest';

export const mockPage = {
  setViewport: vi.fn(),
  setUserAgent: vi.fn(),
  setDefaultTimeout: vi.fn(),
  setDefaultNavigationTimeout: vi.fn(),
  setRequestInterception: vi.fn(),
  on: vi.fn(),
  goto: vi.fn(),
  evaluate: vi.fn(),
  screenshot: vi.fn(),
  close: vi.fn(),
  content: vi.fn(),
};

export const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  isConnected: vi.fn().mockReturnValue(true),
  close: vi.fn(),
};

const puppeteer = {
  launch: vi.fn().mockResolvedValue(mockBrowser),
};

export default puppeteer;
