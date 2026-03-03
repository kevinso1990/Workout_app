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
- **i18n**: i18next + react-i18next (6 languages)
- **Push**: web-push (VAPID keys in env secrets)

## Architecture

### Single Server
Express runs on port 5000 (primary) and port 8081 (Replit proxy compatibility), serving both the API (`/api/*`) and Vite dev middleware (SPA). In production, serves static files from `dist/public`.

### Database (server/db.ts)
- SQLite file: `workout.db` in project root
- Tables: exercises, plans, plan_exercises, sessions, sets, exercise_feedback, body_weight, exercise_media_cache, muscle_fatigue, push_subscriptions
- 100+ seeded exercises across 10 muscle groups (Chest, Back, Shoulders, Legs, Biceps, Triceps, Core, Traps, Forearms)
- WAL mode + foreign keys enabled
- plan_exercises has `superset_group` INTEGER (NULL = no superset, same number = grouped)
- sets has `is_drop_set` INTEGER DEFAULT 0, `parent_set_id` INTEGER (FK to sets.id)
- muscle_fatigue has muscle_group, fatigue_score REAL, last_trained_at TEXT, session_id INTEGER
- push_subscriptions has endpoint, keys_p256dh, keys_auth, created_at

### API Routes (server/routes.ts)
- `GET/POST /api/exercises` - Exercise library CRUD
- `GET/POST/PUT/DELETE /api/plans` - Plan management (superset_group on plan_exercises)
- `POST /api/plans/auto-generate` - Auto-generate plans from onboarding (frequency/experience/goal/equipment)
- `POST /api/sessions` - Start workout session
- `PUT /api/sessions/:id` - Finish session (with RPE, notes, triggers fatigue recording)
- `GET /api/sessions` - List sessions with computed volume/duration
- `GET /api/sessions/:id` - Session detail with sets (includes drop set data)
- `POST /api/sets` - Log a set (accepts is_drop_set + parent_set_id)
- `DELETE /api/sets/:id` - Undo a set
- `POST /api/exercise-feedback` - Per-exercise difficulty rating
- `GET /api/recommendations/:planId` - Smart progression suggestions (excludes drop sets)
- `POST /api/recommendations/:planId/accept` - Apply recommendations
- `GET /api/recovery` - Current muscle recovery % (fatigue decays 1pt/24h)
- `GET /api/push/vapid-public` - Returns public VAPID key
- `POST /api/push/subscribe` - Store push subscription
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
- **Dashboard** (`/`) - Hero card for next workout, weekly schedule strip (Mon-Sun), volume by muscle, recent activity, recovery status panel
- **Plans** (`/plans`) - List/delete plans with muscle group tag pills
- **PlanBuilder** (`/plans/new`, `/plans/:id/edit`) - Create/edit plans with exercise library modal, up/down reorder, custom exercise creation, MuscleWiki exercise thumbnails, superset grouping with colored borders
- **ActiveWorkout** (`/workout/:sessionId`) - Full-screen workout tracker with table-like set rows (Set | Previous | Weight | Reps | Done), pill-shaped inputs, circular SVG rest timer, plate calculator, localStorage backup, kg/lbs toggle, auto-highlight next exercise, drop set button (+10% weight reduction), superset rest timer skip
- **PostWorkout** (`/workout/:sessionId/finish`) - Full-screen summary card (duration, volume, sets), confetti animation, RPE slider, per-exercise feedback
- **Progress** (`/progress`) - Stats dashboard (4 stat cards), weekly volume bar chart (8 weeks), per-exercise progress (1RM/weight/volume charts), muscle group heatmap, consistency calendar (GitHub-style), body weight tracking
- **History** (`/history`) - Workout log with PR badges (star icons)
- **SessionDetail** (`/session/:id`) - Sets breakdown with gradient-fill progress charts, recommendation badges
- **Profile** (`/profile`) - Stats overview, theme toggle (dark/light), language selector, notification toggle

### Components
- **ExerciseMedia** (`client/components/ExerciseMedia.tsx`) - Fetches and displays MuscleWiki exercise data (video thumbnail, muscle tags, body map images, step-by-step instructions). Supports compact and full modes. Client-side memory cache.
- **MuscleHeatmap** (`client/components/MuscleHeatmap.tsx`) - SVG body outline with muscles color-coded by 7-day training frequency. Accent gradient for trained muscles, muted for untrained.
- **ConsistencyCalendar** (`client/components/ConsistencyCalendar.tsx`) - GitHub-style contribution grid showing last 6 months of workouts. Color-coded: empty = no workout, accent = workout, purple = PR day.
- **RecoveryPanel** (`client/components/RecoveryPanel.tsx`) - Recovery status bars for each muscle group (red 0-40%, orange 40-70%, green 70-100%). Uses `useRecoveryWarning` hook for pre-workout fatigue warnings.
- **Onboarding** (`client/components/Onboarding.tsx`) - 5-step guided overlay with notification permission request.

### Multi-Language Support (client/i18n.ts)
- 6 languages: English, German, French, Spanish, Italian, Portuguese
- Translation files in `client/locales/{en,de,fr,es,it,pt}/translation.json`
- Browser language auto-detection via i18next-browser-languagedetector
- Language persisted to localStorage (`app_language`)
- HTML lang attribute updated on language change
- Language selector modal on Profile page

### Superset & Drop Set System
- PlanBuilder: Multi-select mode → "Link as Superset" → colored left border grouping with "Superset" label, "Unlink" option
- ActiveWorkout: Superset exercises shown with colored left borders; rest timer skipped between exercises in same superset group; rest only starts after last exercise in group
- Drop sets: "+ Drop Set" button appears after logging 1+ sets; pre-fills weight at -10% (rounded to 2.5kg); purple "Drop" label; counted separately from normal sets for progression

### Recovery & Fatigue Tracking
- muscle_fatigue table with decay logic (1 pt/24h)
- Primary muscles get fatigue_score 3, secondary muscles get 1
- GET /api/recovery returns current recovery % per muscle
- RecoveryPanel on Dashboard with colored progress bars
- useRecoveryWarning hook warns if primary muscles <50% recovered before workout

### Push Notifications (PWA)
- VAPID keys stored as env secrets (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
- Service worker handles push events + notificationclick
- Subscription stored in push_subscriptions table
- Permission request in Onboarding + toggle in Profile
- Server-side cron: inactivity nudge (3 days), weekly summary (Sunday)

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
- Includes notification permission request
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
- Equipment parameter: barbell → kettlebell swap mapping available

### Key Config (client/config.ts)
- APP_NAME, DEFAULT_REST_SECONDS (90), WEIGHT_STEP (2.5), REP_STEP (1), DEFAULT_SETS (3), DEFAULT_REPS (10)

### Progression Logic
- easy → +2.5kg
- right + all reps hit → +1 rep
- right + incomplete reps → same weight/reps
- hard or RPE 9+ → -2.5kg or -1 rep
- Drop sets excluded from progression calculations

### PWA Support
- Service worker: `client/sw.js` (cache-first for static, network-first for API, push event handler)
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
- localStorage language key: `app_language`
- Old React Native files in `client/screens/` and `client/navigation/` exist but are not imported
- MuscleWiki API responses cached in exercise_media_cache table (7-day TTL)
- Equipment values: barbell, dumbbell, kettlebell, cable, machine, bodyweight
- VAPID keys stored as env secrets (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
