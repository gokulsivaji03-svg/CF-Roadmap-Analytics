# CF Coach — Codeforces Training Platform

A personalized competitive programming training platform that analyzes your Codeforces weaknesses, generates daily practice, tracks mistakes, and helps you climb from newbie to 1600+.

> **Built for beginner-to-intermediate Codeforces competitors who want structured, data-driven improvement.**

---

## Features

### 1. Codeforces Profile Dashboard
- Connect via Codeforces API using your handle
- View rating, contests, solved problems, and progress over time
- Tag-based strength/weakness analysis with accuracy percentages
- Solve speed metrics and consistency tracking

### 2. Weakness Diagnosis Engine
- Identifies which problem types you struggle with most
- Detects patterns like overcomplicating, reading errors, math intuition gaps
- Analyzes submissions to find recurring mistake categories
- Lets you manually log why you failed a problem

### 3. Daily Training Plan
- Generates a personalized practice set based on your current rating
- Prioritizes 800–1100 rated problems initially
- Mixes review problems (spaced repetition) with new problems
- Targets weak tags: math, greedy, implementation, brute force, constructive

### 4. Problem Solving Journal
- Log your initial idea, what you tried, where you got stuck
- Track hints used, final insight, mistake category, and takeaway
- Record whether you solved independently, time spent, confidence level
- Expand/collapse entries for quick review

### 5. Mistake Review System (Spaced Repetition)
- Failed problems enter a review queue: 1 day → 3 days → 7 days → 21 days
- Mark problems as "Solved it!" to advance stages, or "Still stuck" to reset
- View recurring mistake patterns across all your entries
- Generate insights like "You overuse hash maps when only existence is needed"

### 6. Contest Simulation Mode
- Timed practice contests with problems at your skill level
- Track solved, attempted, failed, and skipped problems
- Countdown timer and automatic scoring
- Perfect for practicing under contest pressure

### 7. Hint Ladder (via AI Coach)
- Progressive hints: direction → key observation → formula → implementation
- Full editorial summary as last resort
- Encourages independent problem solving before revealing answers

### 8. AI Coach (Chat Interface)
- Ask the AI coach for hints, mistake analysis, and practice recommendations
- Powered by OpenAI GPT-4o-mini (optional) with local fallback responses
- Socratic questioning approach — coaches without giving full solutions
- Suggest similar problems and create study plans

### 9. Roadmap System
- 7 milestones: 800 → 900 → 1000 → 1200 → 1400 → 1600
- Each milestone has required skills, tags, problem counts, and contest goals
- Visual progress tracking with color-coded tiers

### 10. Jiangly Solution Finder
- Find jiangly's accepted solutions for any Codeforces problem
- Supports URLs or shorthand like `1527/A`
- Scans up to 50,000 submissions to find matches

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript |
| **Styling** | Tailwind CSS 3, Dark mode support |
| **Charts** | Recharts 2 |
| **Icons** | Lucide React |
| **Auth** | NextAuth.js 4 with GitHub OAuth |
| **Database** | PostgreSQL via Prisma ORM |
| **AI** | OpenAI API (optional), local fallback |
| **Codeforces API** | Official Codeforces API integration |

---

## Getting Started

### Prerequisites

- **Node.js 18+** (includes npm)
- **PostgreSQL** database (local or cloud — Neon, Supabase, Railway)
- **GitHub OAuth App** (for authentication)
- **OpenAI API key** (optional, for AI coach)

### 1. Quick Setup

```bash
# Clone and enter the project
cd jiangly

# Install dependencies
npm install --legacy-peer-deps

# Generate Prisma client
npx prisma generate

# Set up environment
cp .env.example .env
```

### 2. Environment Variables

Edit `.env` with your settings:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@localhost:5432/codeforces_coach?schema=public"

# NextAuth
NEXTAUTH_SECRET="generate-a-random-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth (create at https://github.com/settings/developers)
GITHUB_ID="your-github-oauth-app-id"
GITHUB_SECRET="your-github-oauth-app-secret"

# OpenAI (optional)
OPENAI_API_KEY="sk-your-openai-api-key"
```

#### Setting up GitHub OAuth

1. Go to GitHub Settings → Developer Settings → OAuth Apps → New OAuth App
2. Set Homepage URL to `http://localhost:3000`
3. Set Authorization callback URL to `http://localhost:3000/api/auth/callback/github`
4. Copy the Client ID and Client Secret into `.env`

### 3. Database Setup

```bash
# Push the schema to your database
npx prisma db push

# (Optional) Open Prisma Studio to inspect data
npx prisma studio
```

### 4. Start Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
jiangly/
├── prisma/
│   └── schema.prisma         # Database schema (14 models)
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Landing page
│   │   ├── providers.tsx     # Auth + theme providers
│   │   ├── globals.css        # Global styles + component classes
│   │   ├── api/
│   │   │   ├── auth/         # NextAuth authentication
│   │   │   ├── cf/           # Codeforces API proxy
│   │   │   │   ├── sync/     # Sync profile + submissions
│   │   │   │   ├── analysis/ # Weakness analysis
│   │   │   │   ├── jiangly/  # Jiangly solution finder
│   │   │   │   └── problems/ # Problem fetching
│   │   │   ├── journal/      # Journal CRUD
│   │   │   ├── daily-plan/   # Daily plan CRUD
│   │   │   ├── review/       # Review schedule CRUD
│   │   │   ├── contest/      # Contest simulation CRUD
│   │   │   ├── ai/           # AI coach chat
│   │   │   └── roadmap/      # Roadmap data
│   │   ├── dashboard/        # Main dashboard
│   │   ├── daily-plan/       # Daily training plan
│   │   ├── journal/          # Problem journal
│   │   ├── review/           # Mistake review queue
│   │   ├── contest/          # Contest simulation
│   │   ├── weakness/         # Weakness analytics
│   │   ├── roadmap/          # Milestone roadmap
│   │   ├── ai-coach/         # AI coaching chat
│   │   ├── settings/         # App settings
│   │   └── problems/         # Jiangly solution finder
│   ├── components/
│   │   └── layout/
│   │       └── navbar.tsx    # Navigation bar
│   └── lib/
│       ├── auth.ts           # NextAuth configuration
│       ├── cf-api.ts         # Codeforces API + analysis
│       ├── db.ts             # Prisma client singleton
│       ├── daily-plan-generator.ts  # Plan generation logic
│       ├── roadmap.ts        # Milestone definitions
│       └── utils.ts          # Shared utilities + constants
├── .env.example
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

---

## Database Models

| Model | Purpose |
|-------|---------|
| `User` | User accounts (NextAuth) |
| `Account` | OAuth provider accounts |
| `Session` | User sessions |
| `CfProfile` | Codeforces profile data |
| `CfSubmission` | Submission history |
| `CfContest` | Contest rating changes |
| `CfTagStat` | Per-tag accuracy stats |
| `Problem` | Cached problem data |
| `JournalEntry` | Problem solving journal |
| `ReviewSchedule` | Spaced repetition queue |
| `DailyPlan` | Daily training plans |
| `DailyPlanItem` | Problems in a plan |
| `ContestSimulation` | Contest practice sessions |
| `ContestProblem` | Problems in a contest sim |
| `AIConversation` | AI coach chat history |
| `MistakePattern` | Detected mistake patterns |

---

## Development Philosophy

This app is **not just a stats tracker**. It's designed to be a serious competitive programming coach:

- **Diagnose first** — Understand why you fail before prescribing practice
- **Spaced repetition** — Review failures at optimal intervals (1d, 3d, 7d, 21d)
- **Journal everything** — Active recall strengthens learning
- **AI as coach, not answer machine** — The AI uses Socratic questioning
- **Progressive overload** — Milestones from 800 to 1600 with clear requirements

---

## License

MIT
