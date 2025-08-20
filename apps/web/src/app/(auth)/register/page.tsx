'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { showError, showSuccess } from '@/lib/toast';
import { useAuth } from '@/hooks/useAuth';

const RegisterSchema = z
  .object({
    name: z.string().min(1, '请输入您的姓名'),
    email: z.string().email('请输入有效的邮箱地址'),
    password: z.string().min(8, '密码至少需要8个字符'),
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '密码确认不匹配',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof RegisterSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      await register(data.email, data.password, data.name);
      showSuccess('注册成功，欢迎使用 NeoLink！');
      router.push('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage =
        error instanceof Error ? error.message : '注册失败，请重试';
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrengthText = (password: string) => {
    if (!password) return null;

    const checks = [
      { test: /.{8,}/, text: '至少8个字符' },
      { test: /[A-Z]/, text: '包含大写字母' },
      { test: /[a-z]/, text: '包含小写字母' },
      { test: /\d/, text: '包含数字' },
      { test: /[!@#$%^&*(),.?":{}|<>]/, text: '包含特殊字符' },
    ];

    const passedChecks = checks.filter((check) => check.test.test(password));
    const strength = passedChecks.length;

    const colors = [
      'text-red-600',
      'text-red-500',
      'text-orange-500',
      'text-yellow-500',
      'text-green-500',
      'text-green-600',
    ];

    const labels = ['很弱', '弱', '一般', '良好', '强', '很强'];

    return {
      strength,
      label: labels[strength] || '很弱',
      color: colors[strength] || 'text-red-600',
      passedChecks,
      failedChecks: checks.filter((check) => !check.test.test(password)),
    };
  };

  const passwordStrength = getPasswordStrengthText(form.watch('password'));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            注册 NeoLink
          </CardTitle>
          <CardDescription className="text-center">
            创建您的账户开始管理智能书签
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓名</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入您的姓名"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱地址</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密码</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="请输入密码"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    {passwordStrength && passwordStrength.strength > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div
                                key={level}
                                className={`h-1 w-4 rounded ${
                                  level <= passwordStrength.strength
                                    ? passwordStrength.strength <= 2
                                      ? 'bg-red-400'
                                      : passwordStrength.strength <= 3
                                        ? 'bg-yellow-400'
                                        : 'bg-green-400'
                                    : 'bg-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                          <span
                            className={`text-xs font-medium ${passwordStrength.color}`}
                          >
                            {passwordStrength.label}
                          </span>
                        </div>
                        {passwordStrength.failedChecks.length > 0 && (
                          <div className="mt-1">
                            <ul className="text-xs text-gray-600 space-y-1">
                              {passwordStrength.failedChecks.map(
                                (check, index) => (
                                  <li key={index} className="flex items-center">
                                    <span className="text-red-400 mr-1">✗</span>
                                    {check.text}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>确认密码</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="请再次输入密码"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? '注册中...' : '注册账户'}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">已有账户？</span>{' '}
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              立即登录
            </Link>
          </div>

          {/* GitHub 注册准备 */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">或</span>
              </div>
            </div>
            <div className="mt-6">
              <Button
                variant="outline"
                className="w-full"
                disabled={true}
                title="GitHub 注册即将推出"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                使用 GitHub 注册 (即将推出)
              </Button>
            </div>
          </div>

          <div className="mt-6 text-xs text-gray-500 text-center">
            注册即表示您同意我们的{' '}
            <Link href="/terms" className="underline hover:text-gray-700">
              服务条款
            </Link>{' '}
            和{' '}
            <Link href="/privacy" className="underline hover:text-gray-700">
              隐私政策
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
