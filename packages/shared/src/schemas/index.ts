import { z } from 'zod';

// 自定义验证器
const createSlugValidator = () =>
  z
    .string()
    .min(1, '标识符不能为空')
    .max(100, '标识符不能超过100个字符')
    .regex(/^[a-z0-9-]+$/, '标识符只能包含小写字母、数字和连字符')
    .refine(
      (val) => !val.startsWith('-') && !val.endsWith('-'),
      '标识符不能以连字符开头或结尾'
    );

const createPasswordValidator = () =>
  z
    .string()
    .min(8, '密码至少需要8个字符')
    .max(128, '密码不能超过128个字符')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      '密码必须包含至少一个小写字母、一个大写字母和一个数字'
    );

const createColorValidator = () =>
  z
    .string()
    .regex(
      /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
      '颜色必须是有效的十六进制格式'
    );

// 基础验证 schemas
export const UUIDSchema = z.string().uuid('无效的UUID格式');
export const EmailSchema = z
  .string()
  .email('无效的邮箱格式')
  .max(254, '邮箱地址不能超过254个字符');
export const URLSchema = z
  .string()
  .url('无效的URL格式')
  .max(2048, 'URL不能超过2048个字符');
export const SlugSchema = createSlugValidator();
export const PasswordSchema = createPasswordValidator();
export const ColorSchema = createColorValidator();

// 时间相关 schemas
export const DateTimeSchema = z.coerce.date();
export const TimestampSchema = z.number().int().positive();

// 分页相关 schemas
export const PaginationSchema = z.object({
  page: z.number().int().min(1, '页码必须大于0').default(1),
  limit: z
    .number()
    .int()
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .default(20),
  offset: z.number().int().min(0).optional(),
});

// 排序相关 schemas
export const SortOrderSchema = z.enum(['asc', 'desc'], {
  errorMap: () => ({ message: '排序方向必须是 asc 或 desc' }),
});

// 文本内容验证
export const TitleSchema = z
  .string()
  .min(1, '标题不能为空')
  .max(200, '标题不能超过200个字符')
  .trim();

export const DescriptionSchema = z
  .string()
  .max(1000, '描述不能超过1000个字符')
  .trim()
  .optional();

export const ContentSchema = z
  .string()
  .max(50000, '内容不能超过50000个字符')
  .optional();

// 用户相关 schemas
export const UserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  language: z.enum(['zh-CN', 'en-US']).default('zh-CN'),
  timezone: z.string().default('Asia/Shanghai'),
  itemsPerPage: z.number().int().min(10).max(100).default(20),
  autoSave: z.boolean().default(true),
  notifications: z
    .object({
      email: z.boolean().default(true),
      browser: z.boolean().default(true),
      mobile: z.boolean().default(false),
    })
    .default({}),
});

export const UserAISettingsSchema = z.object({
  enableAI: z.boolean().default(true),
  aiProvider: z.enum(['openai', 'anthropic', 'local']).default('openai'),
  model: z.string().default('gpt-4'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(4096).default(1000),
  autoSummarize: z.boolean().default(true),
  autoTag: z.boolean().default(true),
  autoTranslate: z.boolean().default(false),
});

export const UserSchema = z.object({
  id: UUIDSchema,
  email: EmailSchema,
  name: z
    .string()
    .min(1, '用户名不能为空')
    .max(50, '用户名不能超过50个字符')
    .trim()
    .optional(),
  avatar: URLSchema.optional(),
  preferences: UserPreferencesSchema.default({}),
  aiSettings: UserAISettingsSchema.default({}),
  isActive: z.boolean().default(true),
  isVerified: z.boolean().default(false),
  role: z.enum(['user', 'admin', 'moderator']).default('user'),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  lastLoginAt: DateTimeSchema.optional(),
  lastActiveAt: DateTimeSchema.optional(),
});

export const CreateUserSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: z
    .string()
    .min(1, '用户名不能为空')
    .max(50, '用户名不能超过50个字符')
    .trim()
    .optional(),
  preferences: UserPreferencesSchema.optional(),
  aiSettings: UserAISettingsSchema.optional(),
});

export const UpdateUserSchema = z.object({
  name: z
    .string()
    .min(1, '用户名不能为空')
    .max(50, '用户名不能超过50个字符')
    .trim()
    .optional(),
  avatar: URLSchema.optional(),
  preferences: UserPreferencesSchema.partial().optional(),
  aiSettings: UserAISettingsSchema.partial().optional(),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '当前密码不能为空'),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '新密码和确认密码不匹配',
    path: ['confirmPassword'],
  });

// 书签相关 schemas
export const BookmarkTagSchema = z
  .string()
  .min(1, '标签不能为空')
  .max(30, '标签不能超过30个字符')
  .trim()
  .regex(/^[^\s,;]+$/, '标签不能包含空格、逗号或分号');

export const BookmarkSchema = z.object({
  id: UUIDSchema,
  url: URLSchema,
  title: TitleSchema.optional(),
  description: DescriptionSchema,
  content: ContentSchema,
  favicon: URLSchema.optional(),
  userId: UUIDSchema,
  folderId: UUIDSchema.optional(),
  tags: z.array(BookmarkTagSchema).max(20, '标签数量不能超过20个').default([]),
  isArchived: z.boolean().default(false),
  isPrivate: z.boolean().default(false),
  isFavorite: z.boolean().default(false),
  readingTime: z.number().int().min(0).optional(), // 预估阅读时间（分钟）
  wordCount: z.number().int().min(0).optional(), // 字数统计
  language: z.string().max(10).optional(), // 内容语言
  domain: z.string().max(100).optional(), // 域名
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  lastAccessedAt: DateTimeSchema.optional(),
  accessCount: z.number().int().min(0).default(0),
});

export const CreateBookmarkSchema = z.object({
  url: URLSchema,
  title: TitleSchema.optional(),
  description: DescriptionSchema,
  folderId: UUIDSchema.optional(),
  tags: z.array(BookmarkTagSchema).max(20, '标签数量不能超过20个').optional(),
  isPrivate: z.boolean().default(false),
  isFavorite: z.boolean().default(false),
});

export const UpdateBookmarkSchema = z.object({
  title: TitleSchema.optional(),
  description: DescriptionSchema,
  folderId: UUIDSchema.nullable().optional(), // 允许设置为 null 来移除文件夹
  tags: z.array(BookmarkTagSchema).max(20, '标签数量不能超过20个').optional(),
  isPrivate: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const ListBookmarksSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  folderId: UUIDSchema.optional(),
  isArchived: z.boolean().optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'title', 'lastAccessedAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const BookmarkListSchema = z.object({
  bookmarks: z.array(BookmarkSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

// 文件夹相关 schemas
export const FolderSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  description: z.string().optional(),
  userId: UUIDSchema,
  parentId: UUIDSchema.optional(),
  isPrivate: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateFolderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  parentId: UUIDSchema.optional(),
  isPrivate: z.boolean().optional(),
});

export const UpdateFolderSchema = CreateFolderSchema.partial();

// 标签相关 schemas
export const TagSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  color: z.string().optional(),
  userId: UUIDSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().optional(),
});

export const UpdateTagSchema = CreateTagSchema.partial();

// 搜索相关 schemas
export const SearchQuerySchema = z.object({
  query: z.string().min(1),
  filters: z
    .object({
      tags: z.array(z.string()).optional(),
      dateRange: z
        .object({
          start: z.date().optional(),
          end: z.date().optional(),
        })
        .optional(),
      contentType: z.enum(['all', 'bookmarks', 'notes']).default('all'),
    })
    .optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export const SearchResultSchema = z.object({
  results: z.array(
    z.object({
      id: UUIDSchema,
      type: z.enum(['bookmark', 'note']),
      title: z.string(),
      description: z.string().optional(),
      url: z.string().optional(),
      relevanceScore: z.number(),
      highlights: z.array(z.string()).optional(),
    })
  ),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
  facets: z.object({
    tags: z.array(
      z.object({
        name: z.string(),
        count: z.number(),
      })
    ),
    contentTypes: z.array(
      z.object({
        type: z.string(),
        count: z.number(),
      })
    ),
  }),
});

// API 响应 schemas
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    timestamp: z.string(),
    requestId: z.string().optional(),
  });

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string(),
  details: z.any().optional(),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// 健康检查 schema
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  timestamp: z.string(),
  version: z.string(),
  services: z.object({
    database: z.enum(['connected', 'disconnected']),
    redis: z.enum(['connected', 'disconnected']).optional(),
  }),
});

// 导出类型
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export type Bookmark = z.infer<typeof BookmarkSchema>;
export type CreateBookmark = z.infer<typeof CreateBookmarkSchema>;
export type UpdateBookmark = z.infer<typeof UpdateBookmarkSchema>;
export type ListBookmarks = z.infer<typeof ListBookmarksSchema>;
export type BookmarkList = z.infer<typeof BookmarkListSchema>;

export type Folder = z.infer<typeof FolderSchema>;
export type CreateFolder = z.infer<typeof CreateFolderSchema>;
export type UpdateFolder = z.infer<typeof UpdateFolderSchema>;

export type Tag = z.infer<typeof TagSchema>;
export type CreateTag = z.infer<typeof CreateTagSchema>;
export type UpdateTag = z.infer<typeof UpdateTagSchema>;

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ===== 认证相关 Schema =====

// 用户名验证器
export const UsernameSchema = z
  .string()
  .min(3, '用户名至少需要3个字符')
  .max(30, '用户名不能超过30个字符')
  .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符');

// 登录请求
export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, '密码不能为空'),
  rememberMe: z.boolean().default(false),
});

// 注册请求
export const RegisterRequestSchema = z
  .object({
    username: UsernameSchema,
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '密码确认不匹配',
    path: ['confirmPassword'],
  });

// JWT载荷
export const JWTPayloadSchema = z.object({
  userId: UUIDSchema,
  username: z.string(),
  email: EmailSchema,
  role: z.enum(['user', 'admin', 'moderator']).default('user'),
  iat: z.number(),
  exp: z.number(),
  type: z.enum(['access', 'refresh']).default('access'),
});

// 令牌响应
export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  tokenType: z.literal('Bearer').default('Bearer'),
  user: z.object({
    id: UUIDSchema,
    username: z.string(),
    email: EmailSchema,
    role: z.enum(['user', 'admin', 'moderator']),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

// 刷新令牌请求
export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, '刷新令牌不能为空'),
});

// 修改密码请求
export const ChangePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, '当前密码不能为空'),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '新密码确认不匹配',
    path: ['confirmPassword'],
  });

// 重置密码请求
export const ResetPasswordRequestSchema = z.object({
  email: EmailSchema,
});

// 重置密码确认
export const ResetPasswordConfirmSchema = z
  .object({
    token: z.string().min(1, '重置令牌不能为空'),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '密码确认不匹配',
    path: ['confirmPassword'],
  });

// 用户上下文
export const UserContextSchema = z.object({
  id: UUIDSchema,
  username: z.string(),
  email: EmailSchema,
  role: z.enum(['user', 'admin', 'moderator']),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  lastLoginAt: z.date().optional(),
});

// 权限检查
export const PermissionSchema = z.object({
  resource: z.string(),
  action: z.enum(['create', 'read', 'update', 'delete', 'manage']),
  conditions: z.record(z.any()).optional(),
});

// 认证相关类型导出
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type JWTPayload = z.infer<typeof JWTPayloadSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type ResetPasswordConfirm = z.infer<typeof ResetPasswordConfirmSchema>;
export type UserContext = z.infer<typeof UserContextSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
