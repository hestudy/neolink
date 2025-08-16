-- 初始化数据库脚本
-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 创建用户表 (基础结构，后续会通过 Drizzle 迁移完善)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 注意：实际的表结构由 Drizzle 迁移管理
-- 这里只是为了确保扩展正确安装和基础用户数据存在

-- 创建索引（如果表已存在）
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);

-- 插入测试数据 (仅在开发环境)
INSERT INTO users (email, name) VALUES 
    ('test@example.com', 'Test User')
ON CONFLICT (email) DO NOTHING;
