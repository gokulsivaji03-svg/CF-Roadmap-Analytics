# CF Coach

CF Coach is a Codeforces training workspace built with Next.js, Prisma, and PostgreSQL. Users sign in with Google or GitHub, connect a Codeforces handle, sync public Codeforces data, and get personalized recommendations, roadmap progress, and review queues.

## What the app does

- Syncs a Codeforces handle and stores profile data, contest history, submissions, and tag stats locally.
- Shows a dashboard with rating progress, weakness signals, review health, roadmap progress, and recommended next actions.
- Builds a daily practice plan from your rating band, weak tags, and recent problem history.
- Lets you keep a problem journal with ideas tried, where you got stuck, hint usage, confidence, and takeaways.
- Automatically turns failed journaled problems into review items.
- Runs an adaptive review engine with outcomes like `Solved Easily`, `Solved With Effort`, `Needed Hint`, `Needed Editorial`, and `Still Stuck`.
- Tracks recurring mistake patterns and surfaces review analytics such as retention score, editorial dependency, and rating readiness.
- Creates lightweight timed contest simulations from Codeforces problem pools.
- Provides a milestone roadmap for climbing Codeforces rating tiers.
- Includes a Jiangly solution finder that locates accepted `jiangly` submissions for a Codeforces problem reference.

## Current product behavior

- Auth: Google or GitHub login through NextAuth.js v4.
- Codeforces connection: users enter their Codeforces handle in Settings, then sync via the public Codeforces API.
- Database: Prisma with PostgreSQL (local or Neon for Vercel).
- Theme: dark mode enabled by default, with a built-in light/dark toggle.
- External data source: live Codeforces API calls.

## Tech stack

- Next.js 14 App Router
- React 18 + TypeScript
- Tailwind CSS
- Prisma ORM with PostgreSQL
- NextAuth.js v4 (Google + GitHub OAuth)
- Recharts
- Lucide React
- next-themes (dark mode)
- react-hot-toast
- Zustand

> **Database note:** The Prisma schema uses PostgreSQL. For local development, PostgreSQL is required (install via Homebrew, Postgres.app, or Docker). For Vercel production, use a hosted Postgres provider (Neon, Supabase, or Vercel Postgres).

## Main sections

### Dashboard

The dashboard pulls together:

- Codeforces profile summary
- rating progression
- tag accuracy and attempt difficulty breakdowns
- today’s plan
- due reviews
- roadmap readiness
- suggested next steps

### Daily Plan

The daily plan generator builds a practice set from:

- your current rating
- weak tags
- recent solved history
- configurable difficulty ranges

Problems are saved for the day and can be marked complete with time spent.

### Journal

The journal is the reflection layer of the app. Each entry can store:

- problem metadata
- initial idea and what you tried
- where you got stuck
- hints used and final insight
- one or more mistake categories
- time spent, confidence, and independence

If a problem was not solved independently, the app creates or refreshes a review schedule entry automatically.

### Review Engine

The review system is one of the richer parts of the project. It tracks:

- stage-based spaced repetition
- adaptive next-review intervals
- retention, importance, and priority scores
- repeated mistake categories
- review attempt history
- similar repair-problem recommendations

There is also a separate review analytics page for higher-level trends.

### Contest Simulation

The contest page can generate a timed practice contest from Codeforces problems near the user’s rating. It tracks per-problem status and auto-finalizes once everything is done or the timer expires.

### Weakness Analysis

The weakness view summarizes:

- tag-level accuracy
- one-try solve rate
- multiple-wrong-submission patterns
- difficulty-band performance
- journal-derived mistake trends

### Roadmap

The roadmap page maps current progress against milestone tiers and problem-count targets from beginner levels upward.

### Jiangly Finder

The Jiangly page accepts a Codeforces problem URL or shorthand like `1527/A`, scans `jiangly` submissions through the Codeforces API, and returns accepted matching submissions with metadata.

## Project structure

```text
src/
  app/
    dashboard/            Main overview page
    daily-plan/           Daily practice workflow
    journal/              Problem journal
    review/               Review queue
    review/analytics/     Review analytics page
    contest/              Contest simulation page
    weakness/             Weakness analysis page
    roadmap/              Rating roadmap
    problems/             Jiangly solution finder
    settings/             Codeforces sync and preferences
    api/                  App API routes
  components/
    layout/               Navbar
  lib/
    cf-api.ts             Codeforces integration + helpers
    daily-plan-generator.ts
    review-engine.ts
    roadmap.ts
    mistake-patterns.ts
    serialization.ts
    session.ts
prisma/
  schema.prisma           Database schema
  schema.prisma           PostgreSQL schema
server.mjs                Standalone Jiangly finder prototype/server
```

## Local setup

### Prerequisites

- Node.js 18+
- npm

### 1. Install dependencies

```bash
npm install
```

`postinstall` runs `prisma generate` automatically.

### 2. Configure environment

Copy `.env.example` to `.env` and fill in the values. For local PostgreSQL:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/cf-coach"
DIRECT_DATABASE_URL="postgresql://postgres:password@localhost:5432/cf-coach"
NEXTAUTH_SECRET="replace-with-a-random-secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_ID=""
GITHUB_SECRET=""
OPENAI_API_KEY=""

```

Notes:

- `DATABASE_URL` must point to a PostgreSQL database. For Vercel, use a Neon pooled connection string.
- `DIRECT_DATABASE_URL` — used by Prisma CLI for schema push/migrate (non-pooled). On Vercel runtime only `DATABASE_URL` (pooled) is required; keep `DIRECT_DATABASE_URL` for local CLI against prod if needed.
- `NEXTAUTH_URL` must match the port the app is actually running on. Use `npm run dev -- -p 3000` to pin the port.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are required to sign in with Google.
- `GITHUB_ID` and `GITHUB_SECRET` are required to sign in with GitHub.
- `OPENAI_API_KEY` is optional.
- `CODEFORCES_API_KEY` and `CODEFORCES_API_SECRET` are optional placeholders only. Basic public sync works with a Codeforces handle and does not require them.

### OAuth callback URLs

Google local:

- `http://localhost:3000/api/auth/callback/google`

GitHub local:

- `http://localhost:3000/api/auth/callback/github`

Google production:

- `https://YOUR_DOMAIN/api/auth/callback/google`

GitHub production:

- `https://YOUR_DOMAIN/api/auth/callback/github`

### 3. Prepare the database

```bash
npx prisma db push
```

Optional:

```bash
npx prisma studio
```

### 4. Start the app

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Typical workflow

1. Open the app and sign in with Google or GitHub.
2. Connect your Codeforces handle at `/connect-handle` (or from Settings).
3. Run sync and review the dashboard and weakness analysis.
5. Generate a daily plan.
6. Log failed or partially solved problems in the journal.
7. Work through the review queue over time.
8. Use the roadmap and contest simulation pages to track progress.

## API routes

The project exposes app routes for:

- `/api/cf/sync`
- `/api/cf/analysis`
- `/api/cf/problems`
- `/api/cf/jiangly`
- `/api/daily-plan`
- `/api/journal`
- `/api/review`
- `/api/contest`
- `/api/roadmap`
- `/api/auth/[...nextauth]`

## Important implementation notes

- Authentication uses NextAuth.js v4 with the Prisma adapter.
- User-specific data is keyed by the signed-in app user, not a global guest profile.
- Codeforces sync currently imports up to the latest 2000 submissions for the selected handle.
- **Sync timeout on Vercel:** Large handles may exceed the default serverless duration (10s on Hobby). First sync can take a while; retry or use a smaller test handle. Pro plans can raise `maxDuration` if needed.
- Codeforces does not provide OAuth login. Users authenticate with Google or GitHub, then connect a Codeforces handle for sync.
- The UI assumes network access to `codeforces.com/api`.
- The tag-frequency JSON stays server-side and only lightweight summary data is sent to the client.

## Vercel notes

### Deployment

1. Push this repo to GitHub.
2. In Vercel, import the repo.
3. Configure:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Install Command | `npm install --legacy-peer-deps` |
| Build Command | `npm run build` |
| Output Directory | `.next` (auto-detected) |
| Node.js Version | 18.x or 20.x |

4. Add environment variables in Vercel dashboard (see below).
5. Deploy.

### Required Environment Variables on Vercel

- `DATABASE_URL` — Hosted PostgreSQL connection string (Neon pooled URL recommended)
- `NEXTAUTH_SECRET` — Random string (`openssl rand -base64 32`)
- `NEXTAUTH_URL` — `https://your-project.vercel.app`
- `GOOGLE_CLIENT_ID` — From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` — From Google Cloud Console
- `GITHUB_ID` — From GitHub Developer Settings
- `GITHUB_SECRET` — From GitHub Developer Settings

Optional:
- `OPENAI_API_KEY` — For AI Coach
- `DIRECT_DATABASE_URL` — Non-pooled URL for one-time `prisma db push` from your machine (not needed at runtime on Vercel)
- `CODEFORCES_API_KEY` / `CODEFORCES_API_SECRET` — Not required for basic sync

### Preview deployments

NextAuth v4 uses a single `NEXTAUTH_URL` per deployment. For Vercel preview URLs, either:
- Add each preview callback URL to your Google/GitHub OAuth apps, or
- Use a stable custom domain for auth and set `NEXTAUTH_URL` to that domain.

Preview sign-in often fails until callback URLs match the preview origin exactly.

### OAuth Callback URLs

| Provider | Local | Production |
|----------|-------|------------|
| Google | `http://localhost:3000/api/auth/callback/google` | `https://YOUR_DOMAIN/api/auth/callback/google` |
| GitHub | `http://localhost:3000/api/auth/callback/github` | `https://YOUR_DOMAIN/api/auth/callback/github` |

### Database Note

This app uses **PostgreSQL**. For Vercel production:
- **Neon** (recommended): Free tier includes pooled connections. Use the pooled connection string for `DATABASE_URL`.
- **Supabase**: Works well; use the Session pooler connection string.
- **Vercel Postgres**: Native integration, set `DATABASE_URL` to the pooled URL.

After connecting the database, run `npx prisma db push` locally pointing to the production DB, or use Vercel's `postinstall` hook (which runs `prisma generate` — the client must match the pushed schema).

### Common Deployment Errors

| Error | Fix |
|-------|-----|
| `NEXTAUTH_URL` mismatch | Set `NEXTAUTH_URL` to the exact Vercel deployment URL (no trailing slash) |
| OAuth callback fails | Verify the callback URL is added in Google/GitHub OAuth app settings |
| Prisma client not found | Ensure `postinstall: prisma generate` runs; check build logs |
| Database connection refused | Verify `DATABASE_URL` points to a running PostgreSQL instance |
| Sign-in buttons disabled | Set all OAuth env vars (Google or GitHub); at least one provider is required |

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run db:push
npm run db:studio
```

## Status

This codebase supports full multi-user sign-in (Google/GitHub via NextAuth v4), per-user Codeforces handle connection, and an end-to-end workflow: sync, analyze, plan, journal, review, simulate contests, and inspect progress. Guest mode at `/guest` remains available for browsing without an account.
