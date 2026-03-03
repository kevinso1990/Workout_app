# WorkoutApp - Workout Planner & Tracker

## Overview

WorkoutApp is a mobile-first web application for creating workout plans and tracking workouts. Dark-mode-first design with light mode toggle. Optimized for speed of data entry (3 taps to log a set). Visual design modeled after Alpha Progression app.

## Tech Stack

- **Frontend**: React 19 + TailwindCSS v4 + Wouter (SPA routing)
- **Backend**: Express.js + TypeScript (tsx)
- **Database**: SQLite via better-sqlite3 (WAL mode)
- **Build**: Vite with @tailwindcss/vite plugin
- **Charts**: Inline SVG (ExerciseChart component with gradient fills)
- **Exercise Data**: MuscleWiki API (proxied through backend, cached in SQLite)

## Architecture

### Single Server
Express runs on port 5000 (primary) and port 8081 (Replit proxy compatibility), serving both the API (`/api/*`) and Vite dev middleware (SPA). In production, serves static files from `dist/public`.

### Database (server/db.ts)
- SQLite file: `workout.db` in project root
- Tables: exercises, plans, plan_exercises, sessions, sets, exercise_feedback, body_weight, exercise_media_cache
- 100+ seeded exercises across 10 muscle groups (Chest, Back, Shoulders, Legs, Biceps, Triceps, Core, Traps, Forearms)
- WAL mode + foreign keys enabled

### API Routes (server/routes.ts)
- `GET/POST /api/exercises` - Exercise library CRUD
- `GET/POST/PUT/DELETE /api/plans` - Plan management
- `POST /api/plans/auto-generate` - Auto-generate plans from onboarding (frequency/experience/goal)
- `POST /api/sessions` - Start workout session
- `PUT /api/sessions/:id` - Finish session (with RPE, notes)
- `GET /api/sessions` - List sessions with computed volume/duration
- `GET /api/sessions/:id` - Session detail with sets
- `POST /api/sets` - Log a set
- `DELETE /api/sets/:id` - Undo a set
- `POST /api/exercise-feedback` - Per-exercise difficulty rating
- `GET /api/recommendations/:planId` - Smart progression suggestions
- `POST /api/recommendations/:planId/accept` - Apply recommendations
- `GET /api/stats/weekly-volume` - Weekly volume by muscle group
- `GET /api/stats/prs` - Personal records
- `GET /api/stats/exercise-history/:id` - Exercise progression data
- `GET /api/stats/last-sets/:id` - Last session's sets for pre-fill
- `GET /api/stats/rest-average/:id` - Historical rest time average
- `GET /api/stats/totals` - Total workouts, volume, streaks
- `GET /api/stats/weekly-history` - 8-week volume history
- `GET /api/stats/consistency` - Workout dates for calendar (last 6 months)
- `GET /api/stats/exercise-progress/:id` - 1RM, best weight, volume progression
- `GET /api/stats/muscle-volume-7d` - Muscle group volume (7 days)
- `GET /api/stats/logged-exercises` - All exercises user has logged
- `GET /api/musclewiki/search?name=...` - MuscleWiki proxy with caching
- `GET/POST /api/body-weight` - Body weight logging

### Frontend Pages
- **Dashboard** (`/`) - Hero card for next workout, weekly schedule strip (Mon-Sun), volume by muscle, recent activity
- **Plans** (`/plans`) - List/delete plans with muscle group tag pills
- **PlanBuilder** (`/plans/new`, `/plans/:id/edit`) - Create/edit plans with exercise library modal, up/down reorder, custom exercise creation, MuscleWiki exercise thumbnails
- **ActiveWorkout** (`/workout/:sessionId`) - Full-screen workout tracker with table-like set rows (Set | Previous | Weight | Reps | Done), pill-shaped inputs, circular SVG rest timer, plate calculator, localStorage backup, kg/lbs toggle, auto-highlight next exercise
- **PostWorkout** (`/workout/:sessionId/finish`) - Full-screen summary card (duration, volume, sets), confetti animation, RPE slider, per-exercise feedback
- **Progress** (`/progress`) - Stats dashboard (4 stat cards), weekly volume bar chart (8 weeks), per-exercise progress (1RM/weight/volume charts), muscle group heatmap, consistency calendar (GitHub-style), body weight tracking
- **History** (`/history`) - Workout log with PR badges (star icons)
- **SessionDetail** (`/session/:id`) - Sets breakdown with gradient-fill progress charts, recommendation badges
- **Profile** (`/profile`) - Stats overview, theme toggle (dark/light)

### New Components
- **ExerciseMedia** (`client/components/ExerciseMedia.tsx`) - Fetches and displays MuscleWiki exercise data (video thumbnail, muscle tags, body map images, step-by-step instructions). Supports compact and full modes. Client-side memory cache.
- **MuscleHeatmap** (`client/components/MuscleHeatmap.tsx`) - SVG body outline with muscles color-coded by 7-day training frequency. Accent gradient for trained muscles, muted for untrained.
- **ConsistencyCalendar** (`client/components/ConsistencyCalendar.tsx`) - GitHub-style contribution grid showing last 6 months of workouts. Color-coded: empty = no workout, accent = workout, purple = PR day.

### Design System — Alpha Progression Style (client/index.css)
- Deep dark background (#0f0f0f), card surfaces (#1c1c1e)
- Accent: Blue/blue-purple gradient (#4f8ef7 → #7c5bf5) — CSS variable `--color-accent` + `--color-accent-gradient`
- Cards have no border, rounded corners (1rem), shadow-only elevation
- Typography: Inter font, large bold numbers for weight/reps (hero numbers), muted gray labels
- CSS variable-based theming with light mode override via `data-theme` attribute
- Custom component classes: .btn-primary (gradient), .card, .input, .stepper-btn (circular), .pill-input, .set-row, .set-row-done, .tag-pill, .rec-badge, .section-label, .exercise-highlight, .log-pulse
- All written as plain CSS (no @apply) for Tailwind v4 compatibility

### Navigation
- 5-tab bottom nav: Home, Plans, Progress, History, Profile
- Active tab uses accent color (blue), inactive uses muted gray
- Filled icons for active state, outlined for inactive

### Theme System (client/lib/theme.ts)
- Theme stored in localStorage (`workoutapp_theme`)
- Applied via `data-theme` attribute on `<html>` element
- Toggle on Profile page

### Plate Calculator (client/components/PlateCalculator.tsx)
- Accessible from active workout header
- Shows colored plate discs for a target weight
- Supports kg/lbs, standard Olympic bar (20kg)

### Onboarding (client/components/Onboarding.tsx)
- 5-step guided overlay for first-time users
- Steps: Welcome → Training Frequency (2-6 days) → Experience Level → Goal → Recommended Split
- Auto-generates workout plans via POST /api/plans/auto-generate
- Generates: Full Body (2-3 days), Upper/Lower (4 days), PPL (5-6 days)
- Sets/reps based on goal: muscle 3x10, strength 4x5, fat/fitness 3x13
- "Use Recommended Split" or "Build My Own" options
- Completion stored in localStorage (`workoutapp_onboarding_done`)

### Auto-Plan Generation Logic
- 2-3 days → Full Body (Squat, RDL, Bench, Row, OHP, Plank)
- 4 days → Upper A/B + Lower A/B with exercise variation
- 5-6 days → Push/Pull/Legs split
- Goal-based rep ranges: muscle 3x10, strength 4x5, fat/fitness 3x13

### Key Config (client/config.ts)
- APP_NAME, DEFAULT_REST_SECONDS (90), WEIGHT_STEP (2.5), REP_STEP (1), DEFAULT_SETS (3), DEFAULT_REPS (10)

### Progression Logic
- easy → +2.5kg
- right + all reps hit → +1 rep
- right + incomplete reps → same weight/reps
- hard or RPE 9+ → -2.5kg or -1 rep

### PWA Support
- Service worker: `client/sw.js` (cache-first for static, network-first for API)
- Manifest: `client/manifest.json`
- Icon: `client/icon.svg`

### Workflow
- Single workflow: "Start application" → `npx tsx server/index.ts` on port 5000

### Port Configuration
- Server listens on port 5000 (workflow/webview) AND port 8081 (Replit proxy routes external port 80 → local 8081 due to legacy Expo config in .replit)
- Both ports serve the same Express app

## User Preferences
- Preferred communication style: Simple, everyday language
- Dark mode first design (with light mode toggle)
- Mobile-first responsive layout
- Speed of data entry is priority (3 taps to log a set)
- Visual design modeled after Alpha Progression app

## Important Notes
- Tailwind v4: Never use `@apply` to reference custom component classes
- `.replit` file has legacy Expo port mappings (8081→80) that cannot be edited directly — dual-port workaround in server/index.ts
- Weight stored in kg internally; lbs display is frontend-only conversion
- localStorage backup key: `workout_backup`
- Old React Native files in `client/screens/` and `client/navigation/` exist but are not imported
- MuscleWiki API responses cached in exercise_media_cache table (7-day TTL)
