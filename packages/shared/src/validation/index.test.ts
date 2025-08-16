import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  safeValidate,
  validateBatch,
  createConditionalSchema,
  createDependentSchema,
  createMutuallyExclusiveSchema,
  createValidationReport,
  withValidationMetrics,
} from './index';

describe('Validation Utils', () => {
  describe('safeValidate', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().int().min(0),
    });

    it('should return success for valid data', () => {
      const data = { name: 'John', age: 25 };
      const result = safeValidate(schema, data);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.errors).toBeUndefined();
    });

    it('should return errors for invalid data', () => {
      const data = { name: '', age: -1 };
      const result = safeValidate(schema, data);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(2);
    });

    it('should handle unexpected errors gracefully', () => {
      const data = { name: 'John', age: 25 };
      const result = safeValidate(schema, data);

      expect(result.success).toBe(true);
    });
  });

  describe('validateBatch', () => {
    const schema = z.object({
      id: z.number(),
      name: z.string().min(1),
    });

    it('should validate multiple items', () => {
      const data = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: '' }, // Invalid
        { id: 3, name: 'Item 3' },
        { id: 'invalid', name: 'Item 4' }, // Invalid
      ];

      const result = validateBatch(schema, data);

      expect(result.validItems).toHaveLength(2);
      expect(result.invalidItems).toHaveLength(2);
      expect(result.summary.total).toBe(4);
      expect(result.summary.valid).toBe(2);
      expect(result.summary.invalid).toBe(2);
      expect(result.summary.successRate).toBe(50);
    });

    it('should handle empty array', () => {
      const result = validateBatch(schema, []);

      expect(result.validItems).toHaveLength(0);
      expect(result.invalidItems).toHaveLength(0);
      expect(result.summary.total).toBe(0);
      expect(result.summary.successRate).toBe(0);
    });
  });

  describe('createConditionalSchema', () => {
    it('should apply different schemas based on condition', () => {
      const conditionalSchema = createConditionalSchema(
        (data: any) => data.type === 'user',
        z.object({ type: z.literal('user'), email: z.string().email() }),
        z.object({ type: z.literal('admin'), permissions: z.array(z.string()) })
      );

      const userData = { type: 'user', email: 'user@example.com' };
      const adminData = { type: 'admin', permissions: ['read', 'write'] };

      const userResult = safeValidate(conditionalSchema, userData);
      const adminResult = safeValidate(conditionalSchema, adminData);

      expect(userResult.success).toBe(true);
      expect(adminResult.success).toBe(true);
    });
  });

  describe('createDependentSchema', () => {
    it('should enforce field dependencies', () => {
      const baseSchema = z.object({
        hasAddress: z.boolean().optional(),
        address: z.string().optional(),
        hasPhone: z.boolean().optional(),
        phone: z.string().optional(),
      });

      const dependentSchema = baseSchema.and(
        createDependentSchema({
          hasAddress: ['address'],
          hasPhone: ['phone'],
        })
      );

      const validData = {
        hasAddress: true,
        address: '123 Main St',
        hasPhone: false,
      };

      const invalidData = {
        hasAddress: true,
        // Missing address
        hasPhone: true,
        // Missing phone
      };

      const validResult = safeValidate(dependentSchema, validData);
      const invalidResult = safeValidate(dependentSchema, invalidData);

      expect(validResult.success).toBe(true);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors).toHaveLength(2);
    });
  });

  describe('createMutuallyExclusiveSchema', () => {
    it('should enforce mutual exclusivity', () => {
      const baseSchema = z.object({
        email: z.string().optional(),
        phone: z.string().optional(),
        username: z.string().optional(),
      });

      const exclusiveSchema = baseSchema.and(
        createMutuallyExclusiveSchema([
          ['email', 'phone'],
          ['email', 'username'],
        ])
      );

      const validData1 = { email: 'user@example.com' };
      const validData2 = { phone: '123-456-7890' };
      const invalidData = { email: 'user@example.com', phone: '123-456-7890' };

      const validResult1 = safeValidate(exclusiveSchema, validData1);
      const validResult2 = safeValidate(exclusiveSchema, validData2);
      const invalidResult = safeValidate(exclusiveSchema, invalidData);

      expect(validResult1.success).toBe(true);
      expect(validResult2.success).toBe(true);
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('createValidationReport', () => {
    it('should create comprehensive validation report', () => {
      const errors = [
        {
          field: 'name',
          message: 'Required',
          code: 'required',
          value: undefined,
        },
        {
          field: 'email',
          message: 'Invalid email',
          code: 'invalid_email',
          value: 'invalid',
        },
        { field: 'name', message: 'Too short', code: 'too_small', value: '' },
        {
          field: 'age',
          message: 'Must be positive',
          code: 'too_small',
          value: -1,
        },
      ];

      const report = createValidationReport(errors);

      expect(report.summary.totalErrors).toBe(4);
      expect(report.summary.fieldCount).toBe(3);
      expect(report.summary.errorsByField.name).toBe(2);
      expect(report.summary.errorsByField.email).toBe(1);
      expect(report.summary.errorsByField.age).toBe(1);
      expect(report.summary.errorsByCode.too_small).toBe(2);
      expect(report.summary.errorsByCode.required).toBe(1);
      expect(report.summary.errorsByCode.invalid_email).toBe(1);
      expect(report.details).toEqual(errors);
    });
  });

  describe('withValidationMetrics', () => {
    it('should provide validation with performance metrics', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const validator = withValidationMetrics(schema, 'test-schema');
      const data = { name: 'John', age: 25 };

      const result = validator.validate(data);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should handle validation errors with metrics', () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().int().min(0),
      });

      const validator = withValidationMetrics(schema, 'test-schema');
      const data = { name: '', age: -1 };

      const result = validator.validate(data);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(2);
    });
  });
});
