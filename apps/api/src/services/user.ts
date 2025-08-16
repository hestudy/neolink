import bcrypt from 'bcryptjs';
import { UserContext, LoginRequest, RegisterRequest } from '@neolink/shared';

/**
 * 用户数据接口（模拟数据库结构）
 */
export interface UserData {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin' | 'moderator';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  emailVerified: boolean;
  permissions?: string[];
}

/**
 * 模拟用户数据库
 * 在实际项目中，这应该是真实的数据库操作
 */
class UserDatabase {
  private users: Map<string, UserData> = new Map();
  private emailIndex: Map<string, string> = new Map();
  private usernameIndex: Map<string, string> = new Map();

  constructor() {
    // 创建默认管理员用户
    this.createDefaultAdmin();
  }

  private createDefaultAdmin() {
    const adminId = 'admin-user-id-12345';
    const admin: UserData = {
      id: adminId,
      username: 'admin',
      email: 'admin@neolink.com',
      passwordHash: bcrypt.hashSync('Admin123!', 10),
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
      permissions: ['*'], // 所有权限
    };

    this.users.set(adminId, admin);
    this.emailIndex.set(admin.email, adminId);
    this.usernameIndex.set(admin.username, adminId);
  }

  async findById(id: string): Promise<UserData | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<UserData | null> {
    const id = this.emailIndex.get(email);
    return id ? this.users.get(id) || null : null;
  }

  async findByUsername(username: string): Promise<UserData | null> {
    const id = this.usernameIndex.get(username);
    return id ? this.users.get(id) || null : null;
  }

  async create(
    userData: Omit<UserData, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<UserData> {
    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const user: UserData = {
      ...userData,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(id, user);
    this.emailIndex.set(user.email, id);
    this.usernameIndex.set(user.username, id);

    return user;
  }

  async update(
    id: string,
    updates: Partial<UserData>
  ): Promise<UserData | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);

    // 更新索引
    if (updates.email && updates.email !== user.email) {
      this.emailIndex.delete(user.email);
      this.emailIndex.set(updates.email, id);
    }
    if (updates.username && updates.username !== user.username) {
      this.usernameIndex.delete(user.username);
      this.usernameIndex.set(updates.username, id);
    }

    return updatedUser;
  }

  async delete(id: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;

    this.users.delete(id);
    this.emailIndex.delete(user.email);
    this.usernameIndex.delete(user.username);

    return true;
  }
}

// 全局用户数据库实例
const userDB = new UserDatabase();

/**
 * 用户服务类
 */
export class UserService {
  /**
   * 用户登录
   */
  async login(loginData: LoginRequest): Promise<UserContext | null> {
    const user = await userDB.findByEmail(loginData.email);

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(
      loginData.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      return null;
    }

    // 更新最后登录时间
    await userDB.update(user.id, { lastLoginAt: new Date() });

    return this.toUserContext(user);
  }

  /**
   * 用户注册
   */
  async register(registerData: RegisterRequest): Promise<UserContext> {
    // 检查邮箱是否已存在
    const existingUserByEmail = await userDB.findByEmail(registerData.email);
    if (existingUserByEmail) {
      throw new Error('邮箱已被使用');
    }

    // 检查用户名是否已存在
    const existingUserByUsername = await userDB.findByUsername(
      registerData.username
    );
    if (existingUserByUsername) {
      throw new Error('用户名已被使用');
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(registerData.password, 10);

    // 创建用户
    const userData: Omit<UserData, 'id' | 'createdAt' | 'updatedAt'> = {
      username: registerData.username,
      email: registerData.email,
      passwordHash,
      role: 'user',
      isActive: true,
      emailVerified: false,
    };

    const user = await userDB.create(userData);
    return this.toUserContext(user);
  }

  /**
   * 根据ID获取用户
   */
  async getUserById(id: string): Promise<UserContext | null> {
    const user = await userDB.findById(id);
    return user ? this.toUserContext(user) : null;
  }

  /**
   * 根据邮箱获取用户
   */
  async getUserByEmail(email: string): Promise<UserContext | null> {
    const user = await userDB.findByEmail(email);
    return user ? this.toUserContext(user) : null;
  }

  /**
   * 更新用户信息
   */
  async updateUser(
    id: string,
    updates: Partial<UserData>
  ): Promise<UserContext | null> {
    const user = await userDB.update(id, updates);
    return user ? this.toUserContext(user) : null;
  }

  /**
   * 修改密码
   */
  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const user = await userDB.findById(id);
    if (!user) {
      return false;
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );
    if (!isCurrentPasswordValid) {
      return false;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await userDB.update(id, { passwordHash: newPasswordHash });

    return true;
  }

  /**
   * 验证用户密码
   */
  async verifyPassword(id: string, password: string): Promise<boolean> {
    const user = await userDB.findById(id);
    if (!user) {
      return false;
    }

    return await bcrypt.compare(password, user.passwordHash);
  }

  /**
   * 激活/停用用户
   */
  async setUserActive(id: string, isActive: boolean): Promise<boolean> {
    const user = await userDB.update(id, { isActive });
    return !!user;
  }

  /**
   * 将 UserData 转换为 UserContext
   */
  private toUserContext(user: UserData): UserContext {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
    };
  }
}

// 导出单例实例
export const userService = new UserService();

/**
 * 清理用户数据库（仅用于测试）
 */
export function clearUserDatabase() {
  userDB['users'].clear();
  userDB['emailIndex'].clear();
  userDB['usernameIndex'].clear();

  // 重新创建默认管理员
  userDB['createDefaultAdmin']();
}
