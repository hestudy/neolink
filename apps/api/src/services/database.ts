import { checkDatabaseConnection as dbCheck } from '@neolink/database';

/**
 * 检查数据库连接状态
 * 使用 Drizzle ORM 进行真实的数据库连接测试
 */
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    return await dbCheck();
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
};
