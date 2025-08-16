import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  setupErrorHandlers,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  TooManyRequestsError,
} from './errorHandler';

describe('Error Handler Middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    setupErrorHandlers(app);
  });

  it('should handle 404 errors', async () => {
    const res = await app.request('/nonexistent');

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Not Found');
    expect(data.message).toBe('The requested resource was not found');
    expect(data.timestamp).toBeDefined();
  });

  it('should handle ValidationError', async () => {
    app.get('/test', () => {
      throw new ValidationError('Invalid input', { field: 'email' });
    });

    const res = await app.request('/test');

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Validation Error');
    expect(data.message).toBe('Invalid input');
    expect(data.details).toEqual({ field: 'email' });
  });

  it('should handle AuthenticationError', async () => {
    app.get('/test', () => {
      throw new AuthenticationError('Token expired');
    });

    const res = await app.request('/test');

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Authentication Error');
    expect(data.message).toBe('Token expired');
  });

  it('should handle AuthorizationError', async () => {
    app.get('/test', () => {
      throw new AuthorizationError('Access denied');
    });

    const res = await app.request('/test');

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Authorization Error');
    expect(data.message).toBe('Access denied');
  });

  it('should handle NotFoundError', async () => {
    app.get('/test', () => {
      throw new NotFoundError('User not found');
    });

    const res = await app.request('/test');

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Not Found');
    expect(data.message).toBe('User not found');
  });

  it('should handle TooManyRequestsError', async () => {
    app.get('/test', () => {
      throw new TooManyRequestsError('Rate limit exceeded');
    });

    const res = await app.request('/test');

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Too Many Requests');
    expect(data.message).toBe('Rate limit exceeded');
  });

  it('should handle generic errors', async () => {
    app.get('/test', () => {
      throw new Error('Something went wrong');
    });

    const res = await app.request('/test');

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal Server Error');
    // In development, should show actual error message
    expect(data.message).toBe('Something went wrong');
  });

  it('should include request ID in error responses', async () => {
    // Mock request ID
    app.use('*', async (c, next) => {
      c.set('requestId', 'test-request-id');
      await next();
    });

    app.get('/test', () => {
      throw new ValidationError('Test error');
    });

    const res = await app.request('/test');
    const data = await res.json();

    expect(data.requestId).toBe('test-request-id');
  });
});
