'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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

const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, '密码至少需要8个字符'),
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '密码确认不匹配',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof ResetPasswordSchema>;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (!tokenFromUrl) {
      showError('无效的重置链接');
      router.push('/login');
      return;
    }
    setToken(tokenFromUrl);
  }, [searchParams, router]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      showError('无效的重置令牌');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setIsSuccess(true);
        showSuccess('密码重置成功！请使用新密码登录');
      } else {
        throw new Error(result.message || '密码重置失败');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      const errorMessage =
        error instanceof Error ? error.message : '密码重置失败，请重试';
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

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              密码重置成功
            </CardTitle>
            <CardDescription className="text-center">
              您的密码已成功重置
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                您的密码已成功重置。现在可以使用新密码登录您的账户。
              </p>
              <Link href="/login">
                <Button className="w-full">立即登录</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              无效的重置链接
            </CardTitle>
            <CardDescription className="text-center">
              该重置链接无效或已过期
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-600">请重新申请密码重置链接</p>
              <Link href="/forgot-password">
                <Button className="w-full">申请新的重置链接</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            重置密码
          </CardTitle>
          <CardDescription className="text-center">
            请输入您的新密码
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新密码</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="请输入新密码"
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
                    <FormLabel>确认新密码</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="请再次输入新密码"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? '重置中...' : '重置密码'}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">记起密码了？</span>{' '}
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              立即登录
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
