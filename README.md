# VillageAPI

VillageAPI is a B2B SaaS platform that provides production-ready REST APIs for India's village-level geography data. It is designed for teams building forms, checkout flows, logistics systems, and any product where address entry must be fast, consistent, and reliable.

After reading this document, you should understand:

1. What the platform does and why it exists.
2. How the codebase is organized.
3. How to run everything locally.
4. How authentication, rate limits, caching, and data access work.
5. How to troubleshoot common issues quickly.

## 1. Product Overview

### 1.1 Problem This Project Solves

Many teams in India face the same location-data issues:

1. No single clean source for complete village hierarchy.
2. Inconsistent address formats across products.
3. Heavy dropdowns and poor autocomplete performance.
4. High maintenance cost for private geography databases.

VillageAPI centralizes this data and exposes an easy-to-integrate API layer.

### 1.2 What VillageAPI Provides

1. Normalized hierarchy: Country -> State -> District -> Sub-District -> Village.
2. Search and autocomplete APIs ready for UI controls.
3. Standardized address composition for downstream systems.
4. API keys, usage tracking, admin controls, and plan-based rate limits.
5. Dashboard apps for admins and B2B clients.

### 1.3 Primary Consumers

1. B2B engineering teams integrating location APIs.
2. Admin operators managing users, plans, and observability.
3. Sales/demo users showcasing a live autocomplete experience.

## 2. Repository Structure

1. [api/](api): Express API service, middleware, and route handlers.
2. [frontend/](frontend): Main React dashboard for admin and B2B portals.
3. [demo-client/](demo-client): Public demo app for smart address autocomplete.
4. [prisma/](prisma): Database schema and migration files.
5. [scripts/](scripts): Python import and verification utilities.
6. [public/all_india_villages.csv](public/all_india_villages.csv): Default import dataset.

## 3. Technology Stack

### 3.1 Backend

1. Node.js + Express
2. Prisma ORM
3. JWT + bcrypt
4. Redis (Upstash) for cache and distributed limits

### 3.2 Data Layer

1. PostgreSQL (NeonDB)
2. Third-normal-form hierarchy for geography entities

### 3.3 Frontend

1. React + TypeScript + Vite
2. Tailwind CSS
3. Recharts for analytics charts

### 3.4 Infrastructure Pattern

1. API-first backend with key-auth and JWT-auth routes
2. CORS-aware local and multi-client development setup
3. Fast response path through cache + query optimization

## 4. Core Features Implemented

1. JWT registration/login flow with business email validation.
2. API key management (create, list, revoke) with hashed secrets.
3. Geography endpoints:
	1. states
	2. districts by state
	3. sub-districts by district
	4. villages by sub-district
	5. search
	6. autocomplete
4. Redis-backed caching and plan-based limits.
5. Admin analytics and user lifecycle controls.
6. B2B usage visibility and state-access visibility.
7. Demo smart address form with hierarchy autofill.
8. API request logging for key-auth traffic.

## 5. Data Model Summary

### 5.1 Geography Entities

1. Country
2. State
3. District
4. SubDistrict
5. Village

Hierarchy relationship:

1. Country has many states.
2. State has many districts.
3. District has many sub-districts.
4. Sub-district has many villages.

### 5.2 Access and Operational Entities

1. User: account status, plan, admin flag.
2. ApiKey: key, secret hash, status, expiry, last-used timestamp.
3. UserStateAccess: per-user state permissions.
4. ApiLog: endpoint-level API usage telemetry.

## 6. Authentication and Authorization

### 6.1 Dashboard Login

1. JWT token issued on successful login.
2. Token expires in 24 hours.

### 6.2 API Access

1. Geography/search endpoints require `X-API-Key`.
2. Non-GET operations require `X-API-Secret`.
3. API keys validate key status, expiry, and owning user status.

### 6.3 State-Level Authorization

When a user has state mappings in `UserStateAccess`, query results are scoped to those states.

## 7. Rate Limiting, Caching, and Resilience

### 7.1 Plan-Based Limits

1. Daily quota by plan.
2. Burst limit per minute by plan.
3. Standard rate headers are returned.

### 7.2 Caching

1. API key lookups cached in Redis.
2. Geography and search/autocomplete responses cached.
3. Cache operations fail gracefully to keep APIs available.

### 7.3 Resilience Behavior

1. If Redis is temporarily unavailable, requests continue (degraded mode).
2. Rate limiter and cache middleware avoid hard-failing user requests during transient Redis interruptions.

## 8. API Surface

### 8.1 Public Routes

1. POST [api/v1/auth/register](api/src/routes/auth.js)
2. POST [api/v1/auth/login](api/src/routes/auth.js)
3. GET [api/v1/auth/me](api/src/routes/auth.js)
4. GET [/health](api/src/index.js)

### 8.2 API Key Protected Routes

1. GET [api/v1/search](api/src/routes/search.js)
2. GET [api/v1/autocomplete](api/src/routes/search.js)
3. GET [api/v1/states](api/src/routes/states.js)
4. GET [api/v1/states/:id/districts](api/src/routes/states.js)
5. GET [api/v1/districts/:id/subdistricts](api/src/routes/districts.js)
6. GET [api/v1/subdistricts/:id/villages](api/src/routes/subdistricts.js)

### 8.3 JWT Protected Routes

1. GET [api/v1/b2b/api-keys](api/src/routes/b2b.js)
2. POST [api/v1/b2b/api-keys](api/src/routes/b2b.js)
3. DELETE [api/v1/b2b/api-keys/:id](api/src/routes/b2b.js)
4. GET [api/v1/b2b/usage](api/src/routes/b2b.js)
5. GET [api/v1/b2b/state-access](api/src/routes/b2b.js)
6. GET [api/v1/admin/users](api/src/routes/admin.js)
7. PATCH [api/v1/admin/users/:id/status](api/src/routes/admin.js)
8. PATCH [api/v1/admin/users/:id/plan](api/src/routes/admin.js)
9. GET [api/v1/admin/stats](api/src/routes/admin.js)
10. POST [api/v1/admin/cache/flush](api/src/routes/admin.js)

## 9. Standard Response Pattern

Success response includes:

1. `success`
2. `count`
3. `data`
4. `meta.requestId`
5. `meta.responseTime`
6. Optional `meta.rateLimit`
7. Optional pagination fields for list endpoints

Error response includes:

1. `success: false`
2. `error.code`
3. `error.message`

## 10. Local Setup

### 10.1 Prerequisites

1. Node.js 20+ (or compatible)
2. npm
3. Python 3.x (for data import scripts)

### 10.2 Install Dependencies

```bash
cd api && npm install
cd ../frontend && npm install
cd ../demo-client && npm install
```

### 10.3 Configure Environment Variables

Create root `.env` (recommended):

```bash
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
JWT_SECRET=your-secret
FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:5173,http://localhost:5174,http://localhost:5175
```

Create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:3001/api/v1
```

Create `demo-client/.env.local`:

```bash
VITE_API_URL=http://localhost:3001/api/v1
VITE_API_KEY=your-demo-api-key
```

### 10.4 Prisma Setup

```bash
cd api
npm run prisma:generate
npm run prisma:migrate
```

### 10.5 Optional Bootstrap Utilities

```bash
node api/create-admin-user.mjs
node api/create-demo-key.mjs
```

1. `create-admin-user.mjs`: creates or updates an active admin user.
2. `create-demo-key.mjs`: creates or updates a demo API key for autocomplete demos.

### 10.6 Import and Verify Village Data

```bash
python scripts/import_villages.py
python scripts/verify_import.py
```

Default dataset: [public/all_india_villages.csv](public/all_india_villages.csv).

## 11. Running the Project

Run all apps from repository root in separate terminals:

```bash
npm --prefix api run dev
npm --prefix frontend run dev
npm --prefix demo-client run dev
```

Expected local URLs:

1. API: `http://localhost:3001`
2. Main dashboard: `http://localhost:5173`
3. Demo client: `http://localhost:5175` (or next free Vite port)

## 12. Health and Validation Commands

### 12.1 Dependency Check

```bash
node api/check-deps.mjs
```

Expected output includes DB counts and Redis `PONG`.

### 12.2 Build Checks

```bash
npm --prefix frontend run build
npm --prefix demo-client run build
```

### 12.3 Python Script Validation

```bash
python -m py_compile scripts/import_villages.py scripts/verify_import.py
```

## 13. Troubleshooting Guide

### 13.1 Port Already In Use (`EADDRINUSE`)

Cause: old dev instance still running.

Fix:

1. Stop old process bound to the port.
2. Restart service.

### 13.2 Missing Env Errors (for example `DATABASE_URL`)

Cause: env not loaded in current startup context.

Fix:

1. Ensure root `.env` exists.
2. Start backend via `npm --prefix api run dev` or `node api/src/index.js`.

### 13.3 CORS Errors in Demo Client

Cause: demo runs on a port not included in CORS config.

Fix:

1. Add origin to `FRONTEND_URLS`.
2. Restart backend.

### 13.4 Autocomplete Returns Empty

Cause options:

1. Missing/invalid demo API key.
2. Data not imported.
3. Wrong API URL in frontend env.

Fix:

1. Regenerate demo key using `node api/create-demo-key.mjs`.
2. Re-run import/verify scripts.
3. Check `VITE_API_URL` and restart client.

## 14. Operational Notes

1. API keys use `ak_` prefix and secrets use `as_` prefix.
2. API logs are written asynchronously.
3. Rate limiting is Redis-backed with graceful fallback.
4. Search performance benefits from trigram indexing (`pg_trgm`).

## 15. Roadmap Ideas

1. Full OpenAPI/Swagger documentation page.
2. CI smoke tests for API + DB + Redis checks.
3. Exportable admin usage reports (CSV/JSON).
4. Alerting for unusual API usage and quota nearing.

## License

MIT
