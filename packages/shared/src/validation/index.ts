import { z, ZodSchema, ZodError } from 'zod';

/**
 * 验证结果类型
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * 验证错误类型
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

/**
 * 验证选项
 */
export interface ValidationOptions {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  context?: Record<string, any>;
}

/**
 * 安全验证函数 - 不抛出异常
 */
export function safeValidate<T>(
  schema: ZodSchema<T>,
  data: unknown,
  _options: ValidationOptions = {}
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        errors: formatZodErrors(result.error),
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          field: 'root',
          message: error instanceof Error ? error.message : '未知验证错误',
          code: 'unknown_error',
        },
      ],
    };
  }
}

/**
 * 格式化 Zod 错误
 */
export function formatZodErrors(zodError: ZodError): ValidationError[] {
  return zodError.errors.map((error) => ({
    field: error.path.join('.') || 'root',
    message: error.message,
    code: error.code,
    value: 'received' in error ? error.received : undefined,
  }));
}

/**
 * 创建条件验证 schema
 */
export function createConditionalSchema<T>(
  condition: (_data: any) => boolean,
  trueSchema: ZodSchema<T>,
  falseSchema: ZodSchema<T>
): ZodSchema<T> {
  return z.any().superRefine((_data, ctx) => {
    const targetSchema = condition(_data) ? trueSchema : falseSchema;
    const result = targetSchema.safeParse(_data);

    if (!result.success) {
      result.error.errors.forEach((error) => {
        ctx.addIssue(error);
      });
    }

    return result.success ? result.data : z.NEVER;
  }) as ZodSchema<T>;
}

/**
 * 创建依赖验证 schema
 */
export function createDependentSchema<T extends Record<string, any>>(
  dependencies: Record<keyof T, (keyof T)[]>
): z.ZodEffects<z.ZodType<T>, T> {
  return z.any().superRefine((_data: T, ctx) => {
    Object.entries(dependencies).forEach(([field, deps]) => {
      if (_data[field] !== undefined) {
        deps.forEach((dep) => {
          if (_data[dep as string] === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `当设置 ${field} 时，${String(dep)} 是必需的`,
              path: [dep as string],
            });
          }
        });
      }
    });
  }) as z.ZodEffects<z.ZodType<T>, T>;
}

/**
 * 创建互斥验证 schema
 */
export function createMutuallyExclusiveSchema<T extends Record<string, any>>(
  exclusiveGroups: (keyof T)[][]
): z.ZodEffects<z.ZodType<T>, T> {
  return z.any().superRefine((_data: T, ctx) => {
    exclusiveGroups.forEach((group) => {
      const presentFields = group.filter((field) => _data[field] !== undefined);

      if (presentFields.length > 1) {
        presentFields.forEach((field) => {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${String(field)} 与 ${presentFields
              .filter((f) => f !== field)
              .map(String)
              .join(', ')} 不能同时设置`,
            path: [field as string],
          });
        });
      }
    });
  }) as z.ZodEffects<z.ZodType<T>, T>;
}

/**
 * 创建自定义验证器
 */
export function createCustomValidator<T>(
  validator: (_value: T) => boolean | Promise<boolean>,
  message: string
) {
  return z.any().superRefine(async (_value: T, ctx) => {
    const isValid = await validator(_value);
    if (!isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
      });
    }
  });
}

/**
 * 批量验证
 */
export function validateBatch<T>(
  schema: ZodSchema<T>,
  dataArray: unknown[],
  options: ValidationOptions = {}
): {
  validItems: T[];
  invalidItems: Array<{
    index: number;
    data: unknown;
    errors: ValidationError[];
  }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    successRate: number;
  };
} {
  const validItems: T[] = [];
  const invalidItems: Array<{
    index: number;
    data: unknown;
    errors: ValidationError[];
  }> = [];

  dataArray.forEach((data, index) => {
    const result = safeValidate(schema, data, options);

    if (result.success && result.data) {
      validItems.push(result.data);
    } else {
      invalidItems.push({
        index,
        data,
        errors: result.errors || [],
      });
    }
  });

  const total = dataArray.length;
  const valid = validItems.length;
  const invalid = invalidItems.length;

  return {
    validItems,
    invalidItems,
    summary: {
      total,
      valid,
      invalid,
      successRate: total > 0 ? (valid / total) * 100 : 0,
    },
  };
}

/**
 * 创建验证报告
 */
export function createValidationReport(errors: ValidationError[]): {
  summary: {
    totalErrors: number;
    fieldCount: number;
    errorsByField: Record<string, number>;
    errorsByCode: Record<string, number>;
  };
  details: ValidationError[];
} {
  const fieldCount = new Set(errors.map((e) => e.field)).size;
  const errorsByField = errors.reduce(
    (acc, error) => {
      acc[error.field] = (acc[error.field] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const errorsByCode = errors.reduce(
    (acc, error) => {
      acc[error.code] = (acc[error.code] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    summary: {
      totalErrors: errors.length,
      fieldCount,
      errorsByField,
      errorsByCode,
    },
    details: errors,
  };
}

/**
 * 验证性能监控
 */
export function withValidationMetrics<T>(
  schema: ZodSchema<T>,
  name: string = 'unknown'
) {
  return {
    validate: (data: unknown): ValidationResult<T> => {
      const startTime = performance.now();
      const result = safeValidate(schema, data);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // 在开发环境中记录性能指标
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Validation Metrics] ${name}: ${duration.toFixed(2)}ms`);

        if (duration > 100) {
          console.warn(
            `[Validation Warning] Slow validation for ${name}: ${duration.toFixed(2)}ms`
          );
        }
      }

      return result;
    },
  };
}
