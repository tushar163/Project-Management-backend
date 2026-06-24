# API Documentation

**Base URL:** `http://localhost:5000/api` (local) or your deployed Render URL + `/api`

All endpoints below except `/auth/register` and `/auth/login` require:
```
Authorization: Bearer <jwt_token>
```

---

## Authentication

### Register

```
POST /auth/register
```

**Body:**
```json
{
  "name": "John Doe",
  "email": "john@test.com",
  "password": "123456"
}
```

**Response — 201:**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@test.com"
  },
  "token": "jwt-token"
}
```

### Login

```
POST /auth/login
```

**Body:**
```json
{
  "email": "john@test.com",
  "password": "123456"
}
```

**Response — 200:**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@test.com"
  },
  "token": "jwt-token"
}
```

> Both endpoints are rate-limited more strictly than the rest of the API to reduce brute-force risk.

---

## Projects

### Create Project

```
POST /projects
```

**Body:**
```json
{
  "name": "Ecommerce Application",
  "description": "Build ecommerce platform"
}
```

**Response — 201:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Ecommerce Application",
    "description": "Build ecommerce platform",
    "ownerId": "uuid",
    "createdAt": "2026-06-24T10:00:00.000Z",
    "updatedAt": "2026-06-24T10:00:00.000Z"
  },
  "message": "Project created Successfully",
  "success": true
}
```

### Get Projects (paginated)

```
GET /projects?page=1&limit=10&search=ecommerce
```

| Query param | Default | Notes |
|---|---|---|
| `page` | 1 | |
| `limit` | 10 | capped at 100 |
| `search` | — | optional, case-insensitive match on project name |

**Response — 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Ecommerce Application",
      "tasks": [{ "id": "uuid", "title": "...", "status": "TODO", "priority": "MEDIUM" }],
      "_count": { "tasks": 5 }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 23,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

Returns only projects owned by the authenticated user.

### Get Project By ID

```
GET /projects/:id
```

**Response — 200:** project details including all tasks and each task's assignee.
**Response — 404:** if the project doesn't exist or isn't owned by the requester.

### Update Project

```
PUT /projects/:id
```

**Body** (either field optional):
```json
{
  "name": "New name",
  "description": "New description"
}
```

**Response — 403** if the requester isn't the project owner.

### Delete Project

```
DELETE /projects/:id
```

**Response — 204** (no body) on success.
**Response — 403** if the requester isn't the project owner.

---

## Tasks

### Create Task

```
POST /tasks
```

**Body:**
```json
{
  "title": "Create Login API",
  "description": "Implement JWT authentication",
  "projectId": "uuid",
  "assignedToId": "uuid",
  "priority": "HIGH"
}
```

`assignedToId` and `priority` are optional. The requester must own `projectId`, and `assignedToId` (if given) must be a real existing user.

**Response — 201:**
```json
{
  "data": { "id": "uuid", "title": "Create Login API", "status": "TODO", "priority": "HIGH", "...": "..." },
  "message": "Task created Successfully",
  "success": true
}
```

### Get Tasks (paginated, filterable)

```
GET /tasks?page=1&limit=10&status=IN_PROGRESS&priority=HIGH&projectId=uuid
```

All query params optional. Returns tasks where the requester is either the creator or the assignee.

**Response — 200:**
```json
{
  "data": [ { "id": "uuid", "title": "...", "status": "IN_PROGRESS", "project": { "id": "uuid", "name": "..." }, "assignedTo": { "id": "uuid", "name": "...", "email": "..." } } ],
  "pagination": { "page": 1, "limit": 10, "total": 12, "totalPages": 2 }
}
```

### Search Tasks

```
GET /tasks/search?q=login&page=1&limit=10
```

Searches `title` and `description` (case-insensitive). Scoped to tasks the requester created or is assigned to — never returns another user's tasks.

**Response — 200:** same shape as Get Tasks.
**Response — 400** if `q` is missing or empty.

### Update Task Status

```
PATCH /tasks/:id/status
```

**Body:**
```json
{
  "status": "DONE"
}
```

`status` must be one of `TODO`, `IN_PROGRESS`, `DONE`. Only the task's creator or assignee may update it.

**Response — 200:**
```json
{
  "data": { "id": "uuid", "status": "DONE", "...": "..." },
  "message": "Task updated successfully",
  "success": true
}
```

### Generate AI Summary

```
POST /tasks/:id/summary
```

Calls Gemini to generate a one-line summary of the task and saves it to `aiSummary`. Only the task's creator or assignee may trigger this. If the Gemini call fails for any reason (invalid key, rate limit, model deprecated), falls back to a rule-based summary instead of failing the request.

**Response — 200:**
```json
{
  "data": {
    "id": "uuid",
    "title": "Create Login API",
    "aiSummary": "Implement JWT-based authentication for the login API.",
    "...": "..."
  },
  "message": "Summary generated successfully",
  "success": true
}
```

---

## Error Response Shape

All error responses follow:
```json
{
  "message": "Human-readable error description"
}
```

| Status | Meaning |
|---|---|
| 400 | Validation error (missing/invalid field) |
| 401 | Missing or invalid JWT |
| 403 | Authenticated, but not authorized for this resource |
| 404 | Resource not found |
| 500 | Unexpected server error |
