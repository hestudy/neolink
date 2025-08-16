# 贡献指南

感谢您对 NeoLink 项目的关注！我们欢迎所有形式的贡献。

## 🚀 快速开始

### 开发环境设置

1. **Fork 仓库**
   - 点击 GitHub 页面右上角的 "Fork" 按钮

2. **克隆您的 Fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/neolink.git
   cd neolink
   ```

3. **添加上游仓库**

   ```bash
   git remote add upstream https://github.com/original-org/neolink.git
   ```

4. **安装依赖**

   ```bash
   pnpm install
   ```

5. **启动开发环境**
   ```bash
   pnpm dev
   ```

## 📝 开发流程

### 分支策略

- `main`: 主分支，包含稳定的生产代码
- `develop`: 开发分支，包含最新的开发代码
- `feature/*`: 功能分支，用于开发新功能
- `fix/*`: 修复分支，用于修复 bug
- `docs/*`: 文档分支，用于文档更新

### 工作流程

1. **创建分支**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **进行开发**
   - 编写代码
   - 添加测试
   - 更新文档

3. **提交代码**

   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

4. **推送分支**

   ```bash
   git push origin feature/your-feature-name
   ```

5. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 填写 PR 模板
   - 等待代码审查

## 📋 代码规范

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**类型 (type):**

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 代码重构
- `test`: 添加或修改测试
- `chore`: 构建工具或辅助工具的变动
- `perf`: 性能优化
- `ci`: CI/CD 相关变动

**示例:**

```
feat(auth): add OAuth2 login support

Add Google and GitHub OAuth2 providers for user authentication.
This includes new API endpoints and frontend components.

Closes #123
```

### 代码风格

项目使用自动化工具确保代码质量：

- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化
- **TypeScript**: 类型检查
- **Husky**: Git hooks 自动化

在提交前，请确保：

```bash
# 代码格式化
pnpm format

# 代码检查
pnpm lint

# 类型检查
pnpm type-check

# 运行测试
pnpm test
```

### 文件命名规范

- **组件**: PascalCase (e.g., `UserProfile.tsx`)
- **工具函数**: camelCase (e.g., `formatDate.ts`)
- **常量**: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS.ts`)
- **类型定义**: PascalCase (e.g., `UserTypes.ts`)

## 🧪 测试

### 测试要求

- 新功能必须包含相应的测试
- 修复 bug 时应添加回归测试
- 测试覆盖率应保持在 80% 以上
- 关键业务逻辑测试覆盖率应达到 95% 以上

### 测试类型

1. **单元测试**: 测试单个函数或组件
2. **集成测试**: 测试模块间的交互
3. **端到端测试**: 测试完整的用户流程

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
pnpm test --filter=@neolink/web

# 监听模式
pnpm test:watch

# 测试覆盖率
pnpm test:coverage
```

## 📚 文档

### 文档要求

- 新功能需要更新相关文档
- API 变更需要更新 API 文档
- 重大变更需要更新 README 和架构文档

### 文档类型

- **README.md**: 项目概述和快速开始
- **docs/architecture.md**: 架构设计文档
- **docs/api.md**: API 接口文档
- **代码注释**: 复杂逻辑的内联注释

## 🐛 Bug 报告

### 报告 Bug

使用 [Bug Report 模板](https://github.com/your-org/neolink/issues/new?template=bug_report.md) 创建 Issue。

请包含：

- 详细的问题描述
- 重现步骤
- 期望行为
- 实际行为
- 环境信息
- 截图或错误日志

### 修复 Bug

1. 在 Issue 中确认 bug
2. 创建修复分支: `fix/issue-number-description`
3. 编写修复代码和测试
4. 提交 PR 并关联 Issue

## 💡 功能请求

### 提出功能请求

使用 [Feature Request 模板](https://github.com/your-org/neolink/issues/new?template=feature_request.md) 创建 Issue。

请包含：

- 功能描述
- 使用场景
- 期望的解决方案
- 替代方案
- 附加信息

## 📞 联系方式

- **GitHub Issues**: 技术问题和 bug 报告
- **GitHub Discussions**: 功能讨论和问答
- **Email**: team@neolink.com

## 🙏 致谢

感谢所有贡献者的努力！您的贡献让 NeoLink 变得更好。

---

再次感谢您的贡献！🎉
