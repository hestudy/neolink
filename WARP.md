# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

NeoLink is an AI-powered intelligent bookmark management platform built with a modern TypeScript monorepo architecture. The project uses Turborepo for build orchestration, pnpm for package management, and follows a modular design with separated frontend and backend applications.

### Technology Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 14+ (App Router) + shadcn/ui + Tailwind CSS
- **Backend**: Hono.js + oRPC for type-safe API communication
- **Database**: PostgreSQL + pgvector (for AI embeddings) + Drizzle ORM
- **AI Integration**: OpenAI GPT models + vector embeddings
- **Content Processing**: Puppeteer for web scraping and screenshots
- **Caching & Queues**: Redis + BullMQ
- **Containerization**: Docker + Docker Compose

## Common Development Commands

### Project Setup and Development

```bash
# Install all dependencies
pnpm install

# Start development environment (all services)
pnpm dev

# Start individual applications
pnpm dev:web    # Frontend development server (localhost:3000)
pnpm dev:api    # Backend API server (localhost:8000)

# Alternative: Use the provided development script
./scripts/start-dev.sh
```

### Building and Production

```bash
# Build all packages and applications
pnpm build

# Build specific workspace
pnpm build --filter=@neolink/web
pnpm build --filter=@neolink/api

# Start production servers
pnpm start
```

### Code Quality and Testing

```bash
# Lint all code
pnpm lint

# Lint specific package
pnpm lint --filter=@neolink/web

# Type checking
pnpm type-check

# Format code with Prettier
pnpm format
pnpm format:check

# Run all tests
pnpm test

# Run tests for specific package
pnpm test --filter=@neolink/database
pnpm test --filter=@neolink/ai

# Test with coverage
pnpm test:coverage

# Watch mode for tests
pnpm test:watch
```

### Database Operations

```bash
# Database migrations and schema management
pnpm --filter=@neolink/database migrate     # Run migrations
pnpm --filter=@neolink/database generate    # Generate migrations
pnpm --filter=@neolink/database studio      # Open Drizzle Studio

# Database seeding
pnpm --filter=@neolink/database seed         # Seed database
pnpm --filter=@neolink/database seed:clear  # Clear seeded data

# Backup operations
pnpm --filter=@neolink/database backup              # Create backup
pnpm --filter=@neolink/database backup:restore     # Restore backup
pnpm --filter=@neolink/database backup:list        # List backups
```

### Docker and Deployment

```bash
# Start all Docker services
docker-compose up -d

# Start only infrastructure services (PostgreSQL + Redis)
docker-compose up -d postgres redis

# Build application container
docker-compose build

# View logs
docker-compose logs -f app
docker-compose logs -f worker
```

### AI Package Testing

```bash
# AI package specific commands
pnpm --filter=@neolink/ai test              # Run AI tests
pnpm --filter=@neolink/ai test:coverage     # AI test coverage
pnpm --filter=@neolink/ai test:ui           # Visual test interface
```

## Architecture Overview

### Monorepo Structure

The project follows a domain-driven monorepo architecture:

```
neolink/
├── apps/
│   ├── web/          # Next.js frontend application
│   └── api/          # Hono.js backend API server
├── packages/
│   ├── shared/       # Shared TypeScript types, schemas, and utilities
│   ├── database/     # Drizzle ORM schemas, migrations, and database utilities
│   ├── ai/           # AI processing (OpenAI integration, content extraction)
│   ├── ui/           # shadcn/ui component library extensions
│   └── config/       # Shared tooling configuration (ESLint, TypeScript)
```

### Key Architectural Patterns

**oRPC Type Safety**: The project uses oRPC for end-to-end type safety between frontend and backend. API contracts are defined in `packages/shared` and consumed by both applications.

**Repository Pattern**: Database operations are abstracted through repository classes in the API application, providing clean separation of data access logic.

**AI Service Layer**: AI operations (content summarization, tagging, embeddings) are centralized in the `packages/ai` module with provider abstraction for multiple AI services.

**Queue-Based Processing**: Heavy operations like content extraction and AI processing are handled asynchronously through Redis + BullMQ queues.

### Environment Configuration

The project uses environment variables for configuration. Copy `.env.example` to `.env.local` and configure:

- **Database**: `DATABASE_URL` for PostgreSQL connection
- **AI Services**: `OPENAI_API_KEY` for OpenAI integration
- **Caching**: `REDIS_URL` for Redis connection
- **Authentication**: `NEXTAUTH_SECRET` for session management

### Database Schema and Migrations

The project uses Drizzle ORM with PostgreSQL + pgvector extension for vector similarity search. Key entities include:

- **Bookmarks**: Core bookmark entities with AI-generated metadata
- **Users**: User accounts and preferences
- **ProcessingJobs**: Async job tracking for AI operations
- **Tags**: Both manual and AI-generated tags with usage statistics

### AI Integration Architecture

The AI module provides a unified interface for multiple AI providers:

- **Content Extraction**: Puppeteer-based web scraping with content optimization
- **Summarization**: GPT-4o-mini for intelligent content summaries
- **Auto-tagging**: AI-powered tag generation based on content analysis
- **Vector Embeddings**: text-embedding-3-small for semantic search
- **Cost Management**: Built-in usage tracking and budget controls

### Testing Strategy

**Unit Tests**: Each package includes comprehensive unit tests using Vitest
**Integration Tests**: Database package includes integration tests for schema validation
**Type Safety**: TypeScript strict mode enforced across all packages
**API Contract Testing**: oRPC ensures compile-time API contract validation

### Development Workflow

The project enforces code quality through:

- **Husky Git Hooks**: Automated pre-commit checks
- **Conventional Commits**: Standardized commit message format
- **ESLint + Prettier**: Automated code formatting and linting
- **TypeScript Strict Mode**: Full type safety enforcement
- **Turborepo Caching**: Optimized build and test execution

### Docker Architecture

The production deployment uses multi-container Docker setup:

- **App Container**: Combined Next.js frontend and Hono.js API
- **Worker Container**: Background job processing for AI operations
- **PostgreSQL**: Database with pgvector extension
- **Redis**: Caching and job queue management
- **Traefik**: Reverse proxy with SSL termination

## Development Notes

- The project uses pnpm workspaces with Turborepo for efficient monorepo management
- All packages follow strict TypeScript configuration with shared config from `@neolink/config`
- The API uses oRPC for type-safe client-server communication
- Database operations should use the repository pattern defined in the API application
- AI operations are abstracted through the unified AIService interface
- Heavy processing is handled through Redis queues to avoid blocking the main API
- The project supports both local development and containerized deployment
