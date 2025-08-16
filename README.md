# NeoLink

NeoLink 是一个基于 AI 的智能链接管理平台，帮助用户高效地收集、组织和分享链接资源。

## 🚀 特性

- **智能分类**: 使用 AI 自动分析和分类链接内容
- **智能标签**: 自动生成相关标签，提升搜索效率
- **内容摘要**: AI 生成链接内容摘要，快速了解链接价值
- **协作分享**: 支持团队协作和链接集合分享
- **多平台支持**: Web 应用 + 浏览器扩展

## 🏗️ 技术架构

### Monorepo 结构

```
neolink/
├── apps/
│   ├── web/          # Next.js 前端应用
│   └── api/          # Hono.js 后端 API
├── packages/
│   ├── shared/       # 共享类型和工具
│   ├── database/     # 数据库 schema 和迁移
│   ├── ai/           # AI 处理模块
│   ├── ui/           # shadcn/ui 组件扩展
│   └── config/       # 共享配置
└── docs/             # 项目文档
```

### 技术栈

- **前端**: Next.js 14+ (App Router) + TypeScript 5.0+
- **后端**: Hono.js + oRPC + TypeScript 5.0+
- **数据库**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI GPT + 向量数据库
- **UI**: shadcn/ui + Tailwind CSS
- **构建工具**: Turborepo + pnpm
- **运行时**: Node.js 20+ LTS
- **容器化**: Docker + Docker Compose

## 🛠️ 开发环境设置

### 前置要求

- Node.js 20+ LTS
- pnpm 8+
- Docker & Docker Compose
- Git

### 快速开始

1. **克隆仓库**

   ```bash
   git clone https://github.com/your-org/neolink.git
   cd neolink
   ```

2. **安装依赖**

   ```bash
   pnpm install
   ```

3. **启动开发环境**

   ```bash
   # 启动所有服务
   pnpm dev

   # 或者分别启动
   pnpm dev:web    # 前端开发服务器
   pnpm dev:api    # 后端开发服务器
   ```

4. **访问应用**
   - 前端: http://localhost:3000
   - API: http://localhost:8000
   - API 文档: http://localhost:8000/docs

### 环境变量

复制环境变量模板并配置：

```bash
cp .env.example .env.local
```

主要环境变量：

- `DATABASE_URL`: PostgreSQL 连接字符串
- `REDIS_URL`: Redis 连接字符串
- `OPENAI_API_KEY`: OpenAI API 密钥
- `NEXTAUTH_SECRET`: NextAuth.js 密钥

## 📝 开发指南

### 代码规范

项目使用严格的代码质量标准：

- **TypeScript**: 启用严格模式
- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化
- **Husky**: Git hooks 自动化

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 构建工具或辅助工具的变动
```

### 测试

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
pnpm test --filter=@neolink/web

# 测试覆盖率
pnpm test:coverage
```

## 🚀 部署

### Docker 部署

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d
```

### 生产构建

```bash
# 构建所有包
pnpm build

# 启动生产服务器
pnpm start
```

## 📚 文档

- [架构文档](./docs/architecture.md)
- [产品需求文档](./docs/prd.md)
- [API 文档](./docs/api.md)
- [贡献指南](./CONTRIBUTING.md)

## 🤝 贡献

欢迎贡献代码！请阅读 [贡献指南](./CONTRIBUTING.md) 了解详细信息。

## 📄 许可证

本项目采用 [MIT 许可证](./LICENSE)。

## 🆘 支持

如有问题，请：

1. 查看 [FAQ](./docs/faq.md)
2. 搜索 [Issues](https://github.com/your-org/neolink/issues)
3. 创建新的 Issue

---

Made with ❤️ by NeoLink Team
