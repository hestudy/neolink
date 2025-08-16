import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  validateParams,
  validateData,
  formatZodError,
  getValidatedData,
} from './validation';
import { setupErrorHandlers } from './errorHandler';

describe('Validation Middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    setupErrorHandlers(app);
  });

  describe('validateData', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().int().min(0),
    });

    it('should validate correct data', () => {
      const data = { name: 'John', age: 25 };
      const result = validateData(testSchema, data);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.errors).toBeUndefined();
    });

    it('should return errors for invalid data', () => {
      const data = { name: '', age: -1 };
      const result = validateData(testSchema, data);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(2);
      expect(result.errors?.some((e) => e.field === 'name')).toBe(true);
      expect(result.errors?.some((e) => e.field === 'age')).toBe(true);
    });

    it('should handle missing required fields', () => {
      const data = { name: 'John' };
      const result = validateData(testSchema, data);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some((e) => e.field === 'age')).toBe(true);
    });
  });

  describe('validateBody', () => {
    const bodySchema = z.object({
      title: z.string().min(1),
      content: z.string().optional(),
    });

    it('should validate valid request body', async () => {
      app.post('/test', validateBody(bodySchema), (c) => {
        const validatedBody = getValidatedData(c, 'body');
        return c.json({ success: true, data: validatedBody });
      });

      const res = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Title', content: 'Test Content' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('Test Title');
    });

    it('should reject invalid request body', async () => {
      app.post('/test', validateBody(bodySchema), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }), // Invalid: empty title
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation Error');
    });

    it('should handle malformed JSON', async () => {
      app.post('/test', validateBody(bodySchema), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe('无效的JSON格式');
    });
  });

  describe('validateQuery', () => {
    const querySchema = z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      active: z.boolean().optional(),
    });

    it('should validate and transform query parameters', async () => {
      app.get('/test', validateQuery(querySchema), (c) => {
        const validatedQuery = getValidatedData(c, 'query');
        return c.json({ success: true, data: validatedQuery });
      });

      const res = await app.request(
        '/test?page=2&limit=50&active=true&search=hello'
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.page).toBe(2);
      expect(data.data.limit).toBe(50);
      expect(data.data.active).toBe(true);
      expect(data.data.search).toBe('hello');
    });

    it('should apply default values', async () => {
      app.get('/test', validateQuery(querySchema), (c) => {
        const validatedQuery = getValidatedData(c, 'query');
        return c.json({ success: true, data: validatedQuery });
      });

      const res = await app.request('/test');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.page).toBe(1);
      expect(data.data.limit).toBe(20);
    });

    it('should reject invalid query parameters', async () => {
      app.get('/test', validateQuery(querySchema), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test?page=0&limit=200'); // Invalid values

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation Error');
    });

    it('should handle array parameters', async () => {
      const arrayQuerySchema = z.object({
        tags: z.array(z.string()).optional(),
      });

      app.get('/test', validateQuery(arrayQuerySchema), (c) => {
        const validatedQuery = getValidatedData(c, 'query');
        return c.json({ success: true, data: validatedQuery });
      });

      const res = await app.request('/test?tags=tag1,tag2,tag3');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });

  describe('validateParams', () => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
      slug: z.string().min(1),
    });

    it('should validate path parameters', async () => {
      app.get('/test/:id/:slug', validateParams(paramsSchema), (c) => {
        const validatedParams = getValidatedData(c, 'params');
        return c.json({ success: true, data: validatedParams });
      });

      const testId = '123e4567-e89b-12d3-a456-426614174000';
      const res = await app.request(`/test/${testId}/my-slug`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testId);
      expect(data.data.slug).toBe('my-slug');
    });

    it('should reject invalid path parameters', async () => {
      app.get('/test/:id/:slug', validateParams(paramsSchema), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test/invalid-uuid/valid-slug'); // Invalid UUID

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation Error');
    });
  });

  describe('formatZodError', () => {
    it('should format Zod errors correctly', () => {
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().int().min(0),
      });

      try {
        schema.parse({
          name: '',
          email: 'invalid-email',
          age: -1,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodError(error);

          expect(formatted).toHaveLength(3);
          expect(formatted.some((e) => e.field === 'name')).toBe(true);
          expect(formatted.some((e) => e.field === 'email')).toBe(true);
          expect(formatted.some((e) => e.field === 'age')).toBe(true);
        }
      }
    });
  });
});
