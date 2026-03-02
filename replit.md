# WorkoutApp - Workout Planner & Tracker

## Overview

WorkoutApp is a mobile-first web application for creating workout plans and tracking workouts. Dark-mode-first design with light mode toggle. Optimized for speed of data entry (3 taps to log a set).

## Tech Stack

- **Frontend**: React 19 + TailwindCSS v4 + Wouter (SPA routing)
- **Backend**: Express.js + TypeScript (tsx)
- **Database**: SQLite via better-sqlite3 (WAL mode)
- **Build**: Vite with @tailwindcss/vite plugin
- **Charts**: Inline SVG (ExerciseChart component)

## Architecture

### Single Server
Express runs on port 5000 (primary) and port 8081 (Replit proxy compatibility), serving both the API (`/api/*`) and Vite dev middleware (SPA). In production, serves static files from `dist/public`.

### Database (server/db.ts)
- SQLite file: `workout.db` in project root
- Tables: exercises, plans, plan_exercises, sessions, sets, exercise_feedback
- 100+ seeded exercises across 10 muscle groups (Chest, Back, Shoulders, Legs, Biceps, Triceps, Core, Traps, Forearms)
- WAL mode + foreign keys enabled

### API Routes (server/routes.ts)
- `GET/POST /api/exercises` - Exercise library CRUD
- `GET/POST/PUT/DELETE /api/plans` - Plan management
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

### Frontend Pages
- **Dashboard** (`/`) - Quick start workout, weekly volume bars, recent sessions
- **Plans** (`/plans`) - List/delete plans with muscle group tags
- **PlanBuilder** (`/plans/new`, `/plans/:id/edit`) - Create/edit plans with exercise library modal, up/down reorder, custom exercise creation
- **ActiveWorkout** (`/workout/:sessionId`) - Full-screen workout tracker with weight/reps steppers, rest timer, localStorage backup, kg/lbs toggle, auto-highlight next exercise
- **PostWorkout** (`/workout/:sessionId/finish`) - RPE slider + per-exercise feedback (Too Hard/Just Right/Too Easy)
- **History** (`/history`) - Workout log with PR badges
- **SessionDetail** (`/session/:id`) - Sets breakdown with progress charts and smart progression recommendations

### Design System (client/index.css)
- CSS variable-based theming: `--color-bg`, `--color-surface`, `--color-text`, etc.
- Dark mode (default) and light mode via `data-theme` attribute on `<html>`
- Brand color: #f97316 (orange)
- Custom CSS classes: .btn, .btn-primary, .btn-ghost, .btn-outline, .card, .input, .stepper-btn, .exercise-highlight
- All written as plain CSS (no @apply) for Tailwind v4 compatibility

### Theme System (client/lib/theme.ts)
- Theme stored in localStorage (`workoutapp_theme`)
- Applied via `data-theme` attribute on `<html>` element
- Toggle in Layout header (sun/moon icon)

### Onboarding (client/components/Onboarding.tsx)
- 3-step guided overlay for first-time users
- Steps: Create a Plan, Start a Workout, Track Your Progress
- Completion stored in localStorage (`workoutapp_onboarding_done`)
- Skip or Next/Get Started buttons

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

## Important Notes
- Tailwind v4: Never use `@apply` to reference custom component classes
- `.replit` file has legacy Expo port mappings (8081→80) that cannot be edited directly — dual-port workaround in server/index.ts
- Weight stored in kg internally; lbs display is frontend-only conversion
- localStorage backup key: `workout_backup`
- Old React Native files in `client/screens/` and `client/navigation/` exist but are not imported
