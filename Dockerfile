# 多阶段构建 Dockerfile
FROM node:20-alpine AS base

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# 复制所有包的 package.json
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/*/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 开发阶段
FROM base AS development

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3000 8000

# 启动开发服务器
CMD ["pnpm", "dev"]

# 构建阶段
FROM base AS builder

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build

# 生产阶段 - Web
FROM node:20-alpine AS web-production

RUN npm install -g pnpm

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# 安装生产依赖
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["pnpm", "--filter=@neolink/web", "start"]

# 生产阶段 - API
FROM node:20-alpine AS api-production

RUN npm install -g pnpm

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/*/dist ./packages/*/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# 安装生产依赖
RUN pnpm install --prod --frozen-lockfile

EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["pnpm", "--filter=@neolink/api", "start"]
