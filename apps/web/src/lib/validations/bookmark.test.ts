import { describe, it, expect } from 'vitest';
import { CreateBookmarkSchema, UpdateBookmarkSchema } from './bookmark';
import { ZodError } from 'zod';

describe('CreateBookmarkSchema', () => {
  it('should validate valid bookmark data', () => {
    const validData = {
      url: 'https://example.com',
      title: '测试标题',
      description: '测试描述',
      tags: ['标签1', '标签2'],
    };

    const result = CreateBookmarkSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should validate minimal valid data', () => {
    const validData = {
      url: 'https://example.com',
      title: '标题',
    };

    const result = CreateBookmarkSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  describe('URL validation', () => {
    it('should reject invalid URLs', () => {
      const invalidData = {
        url: 'not-a-url',
        title: '标题',
      };

      const result = CreateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['url']);
      }
    });

    it('should accept various valid URL formats', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://sub.example.com',
        'https://example.com/path',
        'https://example.com/path?query=value',
        'https://example.com:8080',
      ];

      validUrls.forEach((url) => {
        const result = CreateBookmarkSchema.safeParse({
          url,
          title: '标题',
        });
        expect(result.success).toBe(true);
      });
    });

    it('should require URL field', () => {
      const invalidData = {
        title: '标题',
      };

      const result = CreateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Title validation', () => {
    it('should reject empty title', () => {
      const invalidData = {
        url: 'https://example.com',
        title: '',
      };

      const result = CreateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['title']);
      }
    });

    it('should reject title longer than 200 characters', () => {
      const longTitle = 'a'.repeat(201);
      const invalidData = {
        url: 'https://example.com',
        title: longTitle,
      };

      const result = CreateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['title']);
      }
    });

    it('should accept title exactly 200 characters', () => {
      const exactTitle = 'a'.repeat(200);
      const validData = {
        url: 'https://example.com',
        title: exactTitle,
      };

      const result = CreateBookmarkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require title field', () => {
      const invalidData = {
        url: 'https://example.com',
      };

      const result = CreateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Description validation', () => {
    it('should accept optional description', () => {
      const validData = {
        url: 'https://example.com',
        title: '标题',
      };

      const result = CreateBookmarkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept valid description', () => {
      const validData = {
        url: 'https://example.com',
        title: '标题',
        description: '这是一个有效的描述',
      };

      const result = CreateBookmarkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject description longer than 500 characters', () => {
      const longDescription = 'a'.repeat(501);
      const invalidData = {
        url: 'https://example.com',
        title: '标题',
        description: longDescription,
      };

      const result = CreateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['description']);
      }
    });

    it('should accept description exactly 500 characters', () => {
      const exactDescription = 'a'.repeat(500);
      const validData = {
        url: 'https://example.com',
        title: '标题',
        description: exactDescription,
      };

      const result = CreateBookmarkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Tags validation', () => {
    it('should accept optional tags', () => {
      const validData = {
        url: 'https://example.com',
        title: '标题',
      };

      const result = CreateBookmarkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept valid tags array', () => {
      const validData = {
        url: 'https://example.com',
        title: '标题',
        tags: ['标签1', '标签2', '标签3'],
      };

      const result = CreateBookmarkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject more than 20 tags', () => {
      const tooManyTags = Array.from({ length: 21 }, (_, i) => `标签${i}`);
      const invalidData = {
        url: 'https://example.com',
        title: '标题',
        tags: tooManyTags,
      };

      const result = CreateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['tags']);
      }
    });

    it('should accept exactly 20 tags', () => {
      const exactTags = Array.from({ length: 20 }, (_, i) => `标签${i}`);
      const validData = {
        url: 'https://example.com',
        title: '标题',
        tags: exactTags,
      };

      const result = CreateBookmarkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty tags in array', () => {
      const invalidData = {
        url: 'https://example.com',
        title: '标题',
        tags: ['有效标签', ''],
      };

      const result = CreateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject tags longer than 30 characters', () => {
      const longTag = 'a'.repeat(31);
      const invalidData = {
        url: 'https://example.com',
        title: '标题',
        tags: [longTag],
      };

      const result = CreateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept tag exactly 30 characters', () => {
      const exactTag = 'a'.repeat(30);
      const validData = {
        url: 'https://example.com',
        title: '标题',
        tags: [exactTag],
      };

      const result = CreateBookmarkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

describe('UpdateBookmarkSchema', () => {
  it('should validate valid update data', () => {
    const validData = {
      title: '更新的标题',
      description: '更新的描述',
      tags: ['新标签'],
      isArchived: true,
      isFavorite: false,
    };

    const result = UpdateBookmarkSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should validate empty update data', () => {
    const validData = {};

    const result = UpdateBookmarkSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate partial update data', () => {
    const validData = {
      title: '仅更新标题',
    };

    const result = UpdateBookmarkSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  describe('Title validation', () => {
    it('should reject empty title when provided', () => {
      const invalidData = {
        title: '',
      };

      const result = UpdateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['title']);
      }
    });

    it('should reject title longer than 200 characters', () => {
      const longTitle = 'a'.repeat(201);
      const invalidData = {
        title: longTitle,
      };

      const result = UpdateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['title']);
      }
    });
  });

  describe('Description validation', () => {
    it('should reject description longer than 1000 characters', () => {
      const longDescription = 'a'.repeat(1001);
      const invalidData = {
        description: longDescription,
      };

      const result = UpdateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['description']);
      }
    });

    it('should accept description exactly 1000 characters', () => {
      const exactDescription = 'a'.repeat(1000);
      const validData = {
        description: exactDescription,
      };

      const result = UpdateBookmarkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Tags validation', () => {
    it('should apply same tag validation as CreateBookmarkSchema', () => {
      const tooManyTags = Array.from({ length: 21 }, (_, i) => `标签${i}`);
      const invalidData = {
        tags: tooManyTags,
      };

      const result = UpdateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['tags']);
      }
    });
  });

  describe('Boolean fields validation', () => {
    it('should accept boolean values for isArchived', () => {
      const validData = {
        isArchived: true,
      };

      const result = UpdateBookmarkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept boolean values for isFavorite', () => {
      const validData = {
        isFavorite: false,
      };

      const result = UpdateBookmarkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject non-boolean values', () => {
      const invalidData = {
        isArchived: 'true',
      };

      const result = UpdateBookmarkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
