# CF Coach

CF Coach is a Codeforces training workspace built with Next.js, Prisma, and SQLite. Users sign in with Google or GitHub, connect a Codeforces handle, sync public Codeforces data, and get personalized recommendations, roadmap progress, and review queues.

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
- Database: Prisma with SQLite in the current schema.
- Theme: dark mode enabled by default, with a built-in light/dark toggle.
- External data source: live Codeforces API calls.

## Tech stack

- Next.js 14 App Router
- React 18 + TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite
- Recharts
- Lucide React
- `next-themes`
- `react-hot-toast`
- Zustand

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
  dev.db                  Local SQLite database
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

Copy `.env.example` to `.env` and make sure `DATABASE_URL` matches the Prisma schema:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="replace-with-a-random-secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_ID=""
GITHUB_SECRET=""
OPENAI_API_KEY=""
CODEFORCES_API_KEY=""
CODEFORCES_API_SECRET=""
```

Notes:

- `NEXTAUTH_URL` must match the port the app is actually running on locally. If Next starts on `3001`, update `NEXTAUTH_URL` and your OAuth callback URLs to `http://localhost:3001`.
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
2. Go to `Settings`.
3. Enter your Codeforces handle and run sync.
4. Review the dashboard and weakness analysis.
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
- Codeforces does not provide OAuth login. Users authenticate with Google or GitHub, then connect a Codeforces handle for sync.
- The UI assumes network access to `codeforces.com/api`.
- The tag-frequency JSON stays server-side and only lightweight summary data is sent to the client.

## Vercel notes

- Install command: `npm install --legacy-peer-deps`
- Build command: `npm run build`
- `postinstall` already runs `prisma generate`
- Required environment variables on Vercel:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GITHUB_ID`
  - `GITHUB_SECRET`
- Optional environment variables:
  - `OPENAI_API_KEY`
  - `CODEFORCES_API_KEY`
  - `CODEFORCES_API_SECRET`
- The current Prisma schema is SQLite. That is fine for local development, but it is not a durable production datastore for Vercel-hosted auth and user data. Switch to a hosted production database before a live multi-user deployment.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run db:push
npm run db:studio
```

## Status

This codebase already has a substantial end-to-end local workflow: sync, analyze, plan, journal, review, simulate contests, and inspect progress. The biggest current simplification is authentication: everything runs as one local guest user instead of a real multi-user sign-in system.
