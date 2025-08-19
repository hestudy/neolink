import { z } from 'zod';

export const CreateBookmarkSchema = z.object({
  url: z.string().url('请输入有效的URL地址'),
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200个字符'),
  description: z.string().max(500, '描述最多500个字符').optional(),
  tags: z
    .array(z.string().min(1).max(30))
    .max(20, '最多添加20个标签')
    .optional(),
});

export const UpdateBookmarkSchema = z.object({
  title: z
    .string()
    .min(1, '标题不能为空')
    .max(200, '标题最多200个字符')
    .optional(),
  description: z.string().max(1000, '描述最多1000个字符').optional(),
  tags: z
    .array(z.string().min(1).max(30))
    .max(20, '最多添加20个标签')
    .optional(),
  isArchived: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export type CreateBookmarkInput = z.infer<typeof CreateBookmarkSchema>;
export type UpdateBookmarkInput = z.infer<typeof UpdateBookmarkSchema>;
