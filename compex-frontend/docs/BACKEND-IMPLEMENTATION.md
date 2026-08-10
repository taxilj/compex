# Backend Implementation Guide

## Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify 4
- **ORM**: Prisma 5 + PostgreSQL 16
- **Auth**: JWT (jsonwebtoken) + httpOnly cookies
- **Jobs**: BullMQ + Redis
- **Validation**: Zod
- **Testing**: Vitest

## Location

```
D:\stitch_compex_sourcing_procurement_platform (1)\
├── compex-frontend\   ← Next.js frontend (frozen)
└── compex-api\        ← Fastify backend (this)
```

## Local Development Setup

### Prerequisites
- Node.js 20+
- Docker Desktop (for PostgreSQL + Redis)

### Steps

```bash
# 1. Start infrastructure
cd compex-api
docker compose up -d

# 2. Copy environment file
cp .env.example .env
# Edit .env — set JWT_SECRET and JWT_REFRESH_SECRET to random 256-bit strings

# 3. Install dependencies
npm install

# 4. Generate Prisma client
npx prisma generate

# 5. Run database migrations
npm run db:migrate

# 6. Seed admin user
npm run db:seed

# 7. Start API server
npm run dev
# → API running at http://localhost:4000

# 8. Start BOM worker (separate terminal)
npm run worker
```

## Running Tests

```bash
# Unit tests (no DB needed)
npx vitest run test/unit/

# Integration tests (requires running DB + Redis)
docker compose up -d
npm run db:migrate
npx vitest run test/integration/
```

## Migrations

```bash
# Create new migration
npx prisma migrate dev --name <description>

# Apply to production
npm run db:migrate:prod

# View schema in browser
npm run db:studio
```

## Environment Variables

See `.env.example` for all required variables. Never commit `.env`.

Critical values to change from defaults:
- `JWT_SECRET` — use `openssl rand -hex 32` or similar
- `JWT_REFRESH_SECRET` — different from JWT_SECRET

## API Base URL

```
http://localhost:4000/api/v1
```

Health check: `GET http://localhost:4000/health`