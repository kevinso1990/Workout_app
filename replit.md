# WorkoutApp - Workout Planner & Tracker

## Overview

WorkoutApp is a mobile-first web application designed for creating workout plans and tracking workout sessions efficiently. It prioritizes rapid data entry and offers a personalized experience with features like smart progression suggestions, recovery tracking, and comprehensive statistics. The project aims to provide a robust, intuitive, and visually appealing workout management solution for fitness enthusiasts, leveraging a modern tech stack to deliver a high-performance and engaging user experience, similar to the Alpha Progression app.

## User Preferences

- Preferred communication style: Simple, everyday language
- Dark mode first design (with light mode toggle)
- Mobile-first responsive layout
- Speed of data entry is priority (3 taps to log a set)
- Visual design modeled after Alpha Progression app
- Always offer a Skip / Continue without account option on any login or registration UI. Users must be able to use the app without signing in. The trade-off (data may be lost if device/storage changes) is acceptable. The `POST /api/auth/guest` endpoint and `continueAsGuest()` helper in `client/lib/api.ts` back this flow.

## System Architecture

**Core Technologies**:
- **Frontend**: React 19, TailwindCSS v4, Wouter (SPA routing), Vite
- **Backend**: Express.js, TypeScript (tsx)
- **Database**: SQLite (WAL mode)
- **Charts**: Inline SVG
- **Internationalization**: i18next, react-i18next (6 languages)
- **Push Notifications**: web-push

**Server Architecture**:
A single Express.js server handles both API requests and serves the frontend SPA on port 5000.

**Two app codebases live in `client/` — do not confuse them:**
- **Web SPA** (`client/App.tsx` → `client/pages/` + `client/components/Layout.tsx`): Wouter-based React app served by the Express backend at `/`. Uses HTML primitives (`<div>`, `<nav>`), `wouter` routing, and browser-only APIs (`window.location.reload()`). Loaded only in a browser via the backend.
- **Native Expo app** (`client/AppNative.tsx` → `client/navigation/RootStackNavigator.tsx` → `client/screens/`): React Navigation-based app for iOS / Android / Expo web preview. Uses real React Native (`View`, `Text`, native stack/tab navigators).

**Expo entry point (`client/index.js`) MUST import `@/AppNative`, not `@/App`.** Loading the web SPA into the native bundle crashes the iOS app at boot with `[ReferenceError: Property 'location' doesn't exist]` because Wouter's `useLocation` and `window.location` don't exist on native. `AppNative.tsx` is the only correct native root and wires up `ErrorBoundary` → `GestureHandlerRootView` → `SafeAreaProvider` → `ThemeProvider` → `OnboardingProvider` → `NavigationContainer` → `RootStackNavigator`. Do **not** import `client/i18n.ts` from the native tree — it depends on `i18next-browser-languagedetector` which is web-only.

**Workflows (Replit dev)**:
- `Start Backend` — `npx tsx server/index.ts`, listens on port 5000.
- `Start Frontend` — `EXPO_OFFLINE=1 npm run expo:dev`, runs Metro on port 8081 for the Expo mobile preview (canvas iframe + Expo Go QR). `EXPO_OFFLINE=1` is required to skip Expo's interactive "log in / proceed anonymously" prompt that would otherwise hang the workflow on first start. Trade-off: the dev manifest is unsigned (only matters for advanced Expo Go signing flows), and `expo-updates` over-the-air checks are disabled in dev.
- The backend MUST NOT bind 8081 — Replit's EXPO stack reserves that port for Metro. A `.watchmanconfig` excludes `.cache`, `.expo`, `node_modules/.cache`, etc. to keep Metro under the inotify limit.

**Database Design**:
The SQLite database `workout.db` stores all application data, including exercises, workout plans, sessions, sets, user feedback, body weight, and push subscriptions. It utilizes WAL mode and foreign keys. Key features include support for supersets (`superset_group`), drop sets (`is_drop_set`, `parent_set_id`), and muscle fatigue tracking.

**Authentication**:
The application uses an OAuth-only authentication system supporting Google and Apple sign-in. User data is stored in a `users` table, and stateless JWTs are issued for authenticated sessions. Strict data ownership is enforced. A guest sign-in option is always available, persisting user data locally on the device.

**API Endpoints**:
A comprehensive set of RESTful API endpoints manage CRUD operations for exercises, plans, sessions, sets, and user feedback. Dedicated endpoints provide smart progression recommendations, recovery status, and various statistical data (weekly volume, PRs, exercise history, consistency).

**Frontend Features & UI/UX**:
- **Pages**: Dashboard, Plans, PlanBuilder, ActiveWorkout, PostWorkout, Progress, History, SessionDetail, Profile.
- **Design System**: Dark-mode-first using a custom TailwindCSS v4-compatible design system inspired by Alpha Progression, featuring deep dark backgrounds, accent gradients, rounded cards, and Inter font typography. A light mode toggle is available.
- **Components**: `ExerciseMedia` for rich exercise details, `MuscleHeatmap` for visualizing trained muscles, `ConsistencyCalendar` for workout streaks, `RecoveryPanel` for muscle recovery status, and an interactive `Onboarding` flow.
- **Navigation**: 5-tab bottom navigation with accent-colored active icons.
- **Superset & Drop Set System**: Integrated into PlanBuilder and ActiveWorkout for structured workout tracking and visual representation.
- **Recovery & Fatigue Tracking**: Utilizes a `muscle_fatigue` table with a decay logic to inform users about their recovery status.
- **PWA Support**: Includes a service worker for caching and push notifications, and a manifest file.
- **Auto-Plan Generation**: An onboarding flow allows users to auto-generate workout plans based on frequency, experience, goal, and equipment.

## Testing

**Unit Tests (47 tests)**: `npx vitest run client/__tests__/onboarding.test.ts`
- Tests pure functions in `client/lib/onboardingUtils.ts` including `getRecommendedSplit`, `buildOnboardingPlan`, `getActiveProgressDotIndices`, and `canAdvanceFrom*` guards.

**Component Tests (40 tests)**: `npm run test:component` or `npx vitest run --config vitest.component.config.ts`
- Renders all 7 onboarding screens (WelcomeScreen → EquipmentScreen → GoalsScreen → FrequencyScreen → FitnessLevelScreen → FocusMusclesScreen → SplitSelectionScreen) in jsdom via react-native-web.
- Verifies ProgressBar dot advancement (step 1-5), button presence, interactivity, and that "Create My Plan" writes `onboarding_complete` to AsyncStorage.
- Config in `vitest.component.config.ts`. Mocks in `client/__tests__/components/setup.ts` + `client/__tests__/components/__mocks__/`.

**E2E Tests (8 tests)**: `npm run test:e2e` (requires Playwright browsers: `npx playwright install chromium`)
- Full onboarding flow simulation via Playwright Chromium against the running Expo web app.
- Config in `playwright.config.ts`, tests in `e2e/onboarding.spec.ts`.
- The webServer config auto-starts Expo on port 8081 when running tests.

## External Dependencies

- **MuscleWiki API**: Used for fetching and displaying exercise data (animated GIFs, MP4 videos, instructions), proxied through the backend and cached in SQLite. The backend pre-fetches MuscleWiki animated content for all exercises on startup; the exercise preview modals show MP4 video (expo-video) when available, animated GIF otherwise, with static GitHub CDN images as a final fallback.
- **Google Auth Library**: For server-side verification of Google ID tokens.
- **jwks-rsa & jsonwebtoken**: For server-side verification of Apple ID tokens.
- **i18next & react-i18next**: For multi-language support (English, German, French, Spanish, Italian, Portuguese).
- **web-push**: For handling push notifications, using VAPID keys stored as environment secrets.