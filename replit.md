# WorkoutApp - Workout Planner & Tracker

## Overview

WorkoutApp is a mobile-first web application for creating workout plans and tracking workouts. Dark-mode-first design optimized for speed of data entry (3 taps to log a set).

## Tech Stack

- **Frontend**: React 19 + TailwindCSS v4 + Wouter (SPA routing)
- **Backend**: Express.js + TypeScript (tsx)
- **Database**: SQLite via better-sqlite3 (WAL mode)
- **Build**: Vite with @tailwindcss/vite plugin
- **Charts**: Recharts (available, not yet used in UI)

## Architecture

### Single Server
Express runs on port 5000, serving both the API (`/api/*`) and Vite dev middleware (SPA). In production, serves static files from `dist/public`.

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
- **ActiveWorkout** (`/workout/:sessionId`) - Full-screen workout tracker with weight/reps steppers, rest timer, localStorage backup, kg/lbs toggle
- **PostWorkout** (`/workout/:sessionId/finish`) - RPE slider + per-exercise feedback (Too Hard/Just Right/Too Easy)
- **History** (`/history`) - Workout log with PR badges
- **SessionDetail** (`/session/:id`) - Sets breakdown with smart progression recommendations

### Design System (client/index.css)
- Dark-mode-first: neutral-950 background, neutral-100 text
- Brand color: #f97316 (orange)
- Custom CSS classes: .btn, .btn-primary, .btn-ghost, .btn-outline, .card, .input, .stepper-btn
- All written as plain CSS (no @apply) for Tailwind v4 compatibility

### Key Config (client/config.ts)
- APP_NAME, DEFAULT_REST_SECONDS (90), WEIGHT_STEP (2.5), REP_STEP (1), DEFAULT_SETS (3), DEFAULT_REPS (10)

### Progression Logic
- easy → +2.5kg
- right + all reps hit → +1 rep
- right + incomplete reps → same weight/reps
- hard or RPE 9+ → -2.5kg or -1 rep

### Workflow
- Single workflow: "Start application" → `npx tsx server/index.ts` on port 5000

## User Preferences
- Preferred communication style: Simple, everyday language
- Dark mode first design
- Mobile-first responsive layout
- Speed of data entry is priority (3 taps to log a set)

## Not Yet Implemented
- PWA service worker for offline support
- Per-exercise progress charts (API exists, UI not built)
- Drag-and-drop reordering (up/down arrows used instead)
- Light mode toggle
- Onboarding tooltips
