#!/bin/bash

# NeoLink 开发环境启动脚本

echo "🚀 Starting NeoLink development environment..."

# 检查 pnpm 是否安装
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first:"
    echo "   npm install -g pnpm"
    exit 1
fi

# 检查 Docker 是否运行
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# 安装依赖
echo "📦 Installing dependencies..."
pnpm install

# 启动 Docker 服务
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis

# 等待数据库启动
echo "⏳ Waiting for database to be ready..."
sleep 10

# 启动开发服务器
echo "🔥 Starting development servers..."
pnpm dev

echo "✅ Development environment is ready!"
echo "   - Web: http://localhost:3000"
echo "   - API: http://localhost:8000"
echo "   - Health Check: http://localhost:8000/health"
