# System Architecture

## High-Level Overview

```
                          Client (Frontend)
                                 |
                                 |  REST API (JSON over HTTPS)
                                 v
                       Express.js Backend
                       (Node.js + TypeScript)
                                 |
                 ----------------------------------
                 |                |                 |
                 v                v                 v
           PostgreSQL          Redis           Gemini API
        (Prisma ORM)      (rate limiting)   (AI summaries)
```

## Request Flow

```
Incoming Request
      |
      v
CORS + express.json()
      |
      v
Rate Limiter (express-rate-limit)
   - global limiter on all routes
   - stricter limiter on /api/auth
      |
      v
Router (per-resource: auth / projects / tasks)
      |
      v
Auth Middleware (verifies JWT, attaches req.user)
      |
      v
Controller
   - input validation
   - ownership / permission checks
   - Prisma queries
      |
      v
PostgreSQL (via Prisma Client)
```

There is no separate service layer in this codebase — controllers call Prisma directly. At this scope (a handful of resources, no complex business rules shared across multiple entry points) that's a reasonable, deliberate choice; a service layer would be the first refactor if this grew into a larger application with logic reused across multiple controllers or background jobs.

## Database Design

Three core models, defined in `prisma/schema.prisma`:

- **User** — `id`, `name`, `email` (unique), `password` (hashed), `role` (`USER` | `ADMIN`)
- **Project** — `id`, `name`, `description`, `ownerId` (FK → User, cascade delete)
- **Task** — `id`, `title`, `description`, `status` (`TODO` | `IN_PROGRESS` | `DONE`), `priority` (`LOW` | `MEDIUM` | `HIGH`), `aiSummary`, `projectId` (FK → Project, cascade delete), `createdById` (FK → User), `assignedToId` (FK → User, nullable)

Indexes:
- `User.email` — unique lookup on login
- `Project.ownerId` — used by every project list/ownership query
- `Task.projectId`, `Task.status`, `Task.title` — used by task listing, filtering, and search

## Authorization Model

- JWT issued on login/register, sent as `Authorization: Bearer <token>` on every protected request
- `auth.middleware.ts` verifies the token and attaches the decoded user to `req.user`
- **Project-level:** only the project's `ownerId` can update or delete it. Reads are scoped to `ownerId` as well — no cross-user project visibility
- **Task-level:** a task is visible to its creator (`createdById`) and its assignee (`assignedToId`). Status updates require being one of those two; task creation requires owning the parent project

## Security Measures

- Passwords hashed with `bcrypt` before storage
- JWT-based stateless auth (no server-side session store)
- CORS restricted to an explicit allow-list via `CORS_ORIGIN` (not wide open)
- Two-tier rate limiting: a global limiter, and a stricter limiter specifically on `/api/auth` to reduce brute-force risk on login/register
- Ownership checks performed server-side before any mutation (never trusting a client-supplied ID alone)
- No raw SQL — all queries go through Prisma's parameterized query builder, which protects against SQL injection by construction

## Performance Considerations

- Pagination (`page` / `limit` query params, capped at a max page size) on every list endpoint, so result sets can't grow unbounded
- `Promise` batching via `prisma.$transaction([...])` for paired `findMany` + `count` calls, so the total count used for `totalPages` stays consistent with the page of results returned
- Selective `select` / `include` in Prisma queries (e.g. task list returns only `id`, `title`, `status` for nested project relations) to avoid over-fetching

## AI Integration

`generateSummary` calls the Gemini API (`gemini-2.5-flash` by default) to produce a one-line summary of a task. The call is wrapped in a try/catch with a deterministic fallback:

```
Task "<title>" is currently <status> with <priority> priority.
```

This means the AI summary feature degrades gracefully — a Gemini outage, invalid key, or model deprecation never breaks the endpoint, it just returns a less detailed but still useful summary.
