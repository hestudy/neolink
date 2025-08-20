import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '@neolink/database';
import { users } from '@neolink/database';
import { generateTokenPair } from '../utils/jwt';
import type { UserContext } from '@neolink/shared';

/**
 * 注册请求接口
 */
export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

/**
 * 登录请求接口
 */
export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

/**
 * 密码重置请求接口
 */
export interface ResetPasswordRequest {
  token: string;
  password: string;
}

/**
 * 认证服务类
 */
export class AuthService {
  /**
   * 用户注册
   */
  async register(data: RegisterRequest): Promise<{
    user: UserContext;
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      tokenType: 'Bearer';
    };
  }> {
    // 检查邮箱是否已存在
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error('邮箱已被注册');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // 创建用户
    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email,
        password: hashedPassword,
        name: data.name || null,
        isActive: true,
        emailVerified: false,
      })
      .returning();

    const userContext: UserContext = {
      id: newUser.id,
      username: newUser.name || 'User',
      email: newUser.email,
      role: 'user',
      isActive: newUser.isActive,
    };

    // 生成令牌
    const tokens = generateTokenPair(userContext);

    return { user: userContext, tokens };
  }

  /**
   * 用户登录
   */
  async login(data: LoginRequest): Promise<{
    user: UserContext;
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      tokenType: 'Bearer';
    };
  }> {
    // 查找用户
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (!user || !user.isActive) {
      throw new Error('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new Error('邮箱或密码错误');
    }

    // 更新最后登录时间
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const userContext: UserContext = {
      id: user.id,
      username: user.name || 'User',
      email: user.email,
      role: 'user',
      isActive: user.isActive,
    };

    // 生成令牌
    const tokens = generateTokenPair(userContext);

    return { user: userContext, tokens };
  }

  /**
   * 根据ID获取用户
   */
  async getUserById(id: string): Promise<UserContext | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      username: user.name || 'User',
      email: user.email,
      role: 'user',
      isActive: user.isActive,
    };
  }

  /**
   * 根据邮箱获取用户
   */
  async getUserByEmail(email: string): Promise<UserContext | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      username: user.name || 'User',
      email: user.email,
      role: 'user',
      isActive: user.isActive,
    };
  }

  /**
   * 请求密码重置
   */
  async requestPasswordReset(email: string): Promise<{ token: string }> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !user.isActive) {
      // 为安全起见，不暴露用户是否存在
      throw new Error('如果该邮箱存在，重置链接已发送');
    }

    // 生成重置令牌
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date();
    resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // 1小时后过期

    // 更新用户记录
    await db
      .update(users)
      .set({
        resetToken,
        resetTokenExpires,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return { token: resetToken };
  }

  /**
   * 验证重置令牌
   */
  async verifyResetToken(token: string): Promise<UserContext | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.resetToken, token)
          // 检查令牌是否还有效
        )
      )
      .limit(1);

    if (
      !user ||
      !user.resetTokenExpires ||
      user.resetTokenExpires < new Date()
    ) {
      return null;
    }

    return {
      id: user.id,
      username: user.name || 'User',
      email: user.email,
      role: 'user',
      isActive: user.isActive,
    };
  }

  /**
   * 重置密码
   */
  async resetPassword(data: ResetPasswordRequest): Promise<UserContext> {
    // 验证重置令牌
    const userContext = await this.verifyResetToken(data.token);
    if (!userContext) {
      throw new Error('无效或已过期的重置令牌');
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // 更新密码并清除重置令牌
    await db
      .update(users)
      .set({
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userContext.id));

    return userContext;
  }

  /**
   * 修改密码
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.isActive) {
      throw new Error('用户不存在或已禁用');
    }

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      throw new Error('当前密码错误');
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // 更新密码
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * 验证密码强度
   */
  validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('密码至少需要8个字符');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('密码需要包含至少一个大写字母');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('密码需要包含至少一个小写字母');
    }

    if (!/\d/.test(password)) {
      errors.push('密码需要包含至少一个数字');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('密码需要包含至少一个特殊字符');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 邮箱验证
   */
  async verifyEmail(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * 禁用/启用用户
   */
  async setUserStatus(userId: string, isActive: boolean): Promise<void> {
    await db
      .update(users)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
}

// 导出单例实例
export const authService = new AuthService();
