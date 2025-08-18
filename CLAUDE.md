# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 Quick Commands

### Development Environment

```bash
# Install dependencies
pnpm install

# Start all services in development mode
pnpm dev

# Start individual services
pnpm dev:web    # Next.js frontend (http://localhost:3000)
pnpm dev:api    # Hono.js API (http://localhost:8000)

# Build all packages
pnpm build

# Run tests
pnpm test
pnpm test --filter=@neolink/api    # Run API tests only
pnpm test --filter=@neolink/web    # Run web tests only

# Lint and type checking
pnpm lint
pnpm type-check

# Format code
pnpm format
```

### Docker Commands

```bash
# Development with Docker
pnpm docker:dev

# Production deployment
pnpm docker:prod

# Build images
docker-compose build

# Start services
docker-compose up -d
```

## 🏗️ Architecture Overview

### Monorepo Structure

```
neolink/
├── apps/
│   ├── web/          # Next.js 14 frontend
│   └── api/          # Hono.js backend API
├── packages/
│   ├── shared/       # Shared types and API contracts
│   ├── database/     # Database schema and migrations
│   ├── ai/           # AI processing modules
│   ├── ui/           # shadcn/ui components
│   └── config/       # Shared configurations
├── docs/             # Architecture and user docs
└── scripts/          # Development scripts
```

### Technology Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Backend**: Hono.js + oRPC + TypeScript
- **Database**: PostgreSQL + pgvector (via Docker)
- **Cache/Queue**: Redis (via Docker)
- **AI**: OpenAI GPT + Claude integration
- **UI**: shadcn/ui + Tailwind CSS
- **Build**: Turborepo + pnpm workspaces

## 🔧 Key Development Patterns

### API Development

- **oRPC** for type-safe API contracts
- **Zod** schemas for validation
- **Repository pattern** for data access
- **Service layer** for business logic

Example API route:

```typescript
// apps/api/src/routes/bookmarks.ts
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

const CreateBookmarkSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  tags: z.array(z.string()).optional(),
});
```

### Frontend Development

- **App Router** with server components
- **Zustand** for state management
- **React Hook Form** for forms
- **Shared API types** from packages/shared

### Database Operations

- **Drizzle ORM** for type-safe queries
- **Migration files** in packages/database/migrations/
- **Seed data** in packages/database/seeds/

## 📁 Key Files to Know

### Core Configuration

- `turbo.json` - Turborepo configuration
- `pnpm-workspace.yaml` - Workspace packages
- `docker-compose.yml` - Service orchestration
- `packages/database/src/schema.ts` - Database schema

### Environment Setup

- `.env.example` - Environment variables template
- `scripts/start-dev.sh` - Development startup script
- `scripts/init-db.sql` - Database initialization

### Testing

- `vitest.config.ts` - Test configuration
- `**/*.test.ts` - Test files throughout codebase

## 🎯 Common Tasks

### Adding a New API Endpoint

1. Define schema in `packages/shared/src/api/`
2. Implement handler in `apps/api/src/routes/`
3. Add tests in `apps/api/src/routes/*.test.ts`
4. Update OpenAPI documentation

### Adding a New Database Table

1. Add schema to `packages/database/src/schema.ts`
2. Create migration with `pnpm db:generate`
3. Update repositories in `apps/api/src/repositories/`

### Adding a New UI Component

1. Add to `packages/ui/src/components/` for shared components
2. Use in `apps/web/src/components/` for app-specific components
3. Follow shadcn/ui patterns

## 🔍 Debugging Tips

### Database Issues

```bash
# Check database connection
pnpm db:studio

# Reset database
pnpm db:reset

# View migrations
pnpm db:migrate
```

### Redis Issues

```bash
# Check Redis connection
redis-cli ping

# Monitor Redis commands
redis-cli monitor
```

### AI Service Issues

- Check API keys in environment variables
- Monitor AI usage in logs
- Verify rate limiting settings

## 🚨 Common Pitfalls

1. **Node version**: Requires Node 20+ LTS
2. **pnpm version**: Requires pnpm 8+
3. **Database migrations**: Always run after pulling latest changes
4. **Environment variables**: Copy `.env.example` to `.env.local`
5. **Docker ports**: Ensure 3000, 8000, 5432, 6379 are available

## 📊 Project Context

This is NeoLink, an AI-powered bookmark management platform with:

- Smart content extraction from web pages
- AI-generated summaries and tags
- Full-text and semantic search
- Docker-based deployment for self-hosting
- Modern TypeScript monorepo architecture
