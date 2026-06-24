# Deployment Guide

## Backend Deployment (Render)

1. Push the repository to GitHub.
2. In Render, create a new **Web Service** and connect the repo.
3. Set **Root Directory** to `backend` (if the backend lives in a subfolder of a monorepo; omit if it's the repo root).
4. **Build Command:**
   ```bash
   npm install && npx prisma generate && npx prisma migrate deploy && npm run build
   ```
5. **Start Command:**
   ```bash
   npm start
   ```
6. Add environment variables in Render's dashboard:
   | Variable | Description |
   |---|---|
   | `DATABASE_URL` | PostgreSQL connection string (see Database section below) |
   | `JWT_SECRET` | Secret used to sign JWTs — generate with `openssl rand -hex 32` |
   | `REDIS_URL` | Redis connection string |
   | `GEMINI_API_KEY` | Gemini API key from Google AI Studio |
   | `GEMINI_MODEL` | e.g. `gemini-2.5-flash` |
   | `CORS_ORIGIN` | Your deployed frontend URL |
   | `PORT` | Render sets this automatically; no action needed |
7. Deploy. Render will run the build command, apply pending migrations, and start the server.

## Database (Neon PostgreSQL)

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the connection string it gives you — it already includes `?sslmode=require`, which is required for Neon.
3. Use that string as `DATABASE_URL`.

> **Cold start note:** Neon's free tier suspends inactive databases. The first request after a period of inactivity can be slow and, in rare cases, can trigger a Prisma `P2028` transaction-timeout error. If this happens, retry the request — the database will be awake by the second attempt.


## Frontend Deployment (Vercel)

1. Connect the GitHub repository in Vercel.
2. Set the project root to the `frontend` directory.
3. Add the environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
   ```
4. Deploy.


## Post-Deployment Checklist

- [ ] Confirm `npx prisma migrate deploy` ran cleanly (check Render's build logs)
- [ ] Hit `/api/auth/register` once to confirm the DB connection is live
- [ ] Confirm `GEMINI_API_KEY` is valid by triggering one `POST /api/tasks/:id/summary` call
- [ ] Confirm CORS_ORIGIN matches the actual deployed frontend URL exactly (including protocol, no trailing slash)
