# FitPlan - Workout Builder App

## Overview

FitPlan is a React Native (Expo) mobile application that helps users create personalized workout routines through a guided experience. The app removes the intimidation of fitness planning by offering an intuitive flow for selecting workout frequency, split preferences, and exercises.

The application follows a client-server architecture with:
- An Expo-based mobile frontend (iOS, Android, Web)
- An Express.js backend API server
- PostgreSQL database with Drizzle ORM
- Local storage (AsyncStorage) for offline-first user data

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (February 2026)

- **Smart Workout Reminders**: Toggle in Profile settings to enable workout reminder notifications. Analyzes training patterns to show insights like "3 days since last workout".
- **Enhanced Onboarding**: New personalized flow with Fitness Level, Equipment Access, Goals, and Focus Muscles screens for tailored workout recommendations.
- **Body Measurements Tracking**: Profile now includes body stats card with weight, body fat %, chest, waist measurements with history.
- **Shareable Workout Cards**: After completing workouts, generate branded summary images with stats and PR badges for social sharing.
- **Target RIR/RPE Badges**: Exercises display target RIR (Reps In Reserve) badges in plan detail view for intensity guidance.
- **Smart Progression Suggestions**: "Today's Target" card shows exactly what weight/reps to aim for based on last session's performance. Explains *why* (e.g., "Last set felt easy - time to progress!").
- **Performance Feedback**: After completing sets, shows badges like "Target hit" or "+2.5kg" if you exceeded the target.
- **First-Time Guidance**: New exercises show helpful hints about starting weight selection.
- **Exercise Swap During Workouts**: Users can now swap exercises mid-workout when equipment is busy. The swap button next to exercise names opens a modal with muscle-group-appropriate alternatives.
- **Duplicate Workout Plans**: Added copy button on plan cards to quickly duplicate an entire workout plan.
- **Set Type Marking**: Users can tag sets as working/warm-up/failure/drop set with color-coded badges.
- **Exercise Illustrations**: Exercise cards now display images from free-exercise-db for 40+ exercises.
- **Personal Best Notifications**: Celebration modal appears when users beat their previous records.
- **Improved Keyboard UX**: "Done Editing" button to dismiss keyboard during weight/reps entry.

## System Architecture

### Frontend Architecture

**Framework**: React Native with Expo SDK 54
- Uses Expo's managed workflow with new architecture enabled
- File-based routing is NOT used; instead uses React Navigation (native-stack + bottom-tabs)
- Path aliases configured: `@/` maps to `./client/`, `@shared/` maps to `./shared/`

**Navigation Structure**:
- Root Stack Navigator handles app-level navigation (Onboarding, Main, CreatePlan, PlanDetail)
- Main Tab Navigator with 4 tabs (My Plans, Exercises, Progress, Profile) plus a floating action button
- Onboarding Stack for first-launch flow (Welcome → FitnessLevel → Equipment → Goals → FocusMuscles → Frequency → SplitPreference → ExercisePreference → SplitSelection)

**State Management**:
- React Context for onboarding flow state (`OnboardingContext`)
- TanStack React Query for server state management
- AsyncStorage for persistent local data (user preferences, workout plans, history)

**UI/Theming**:
- Custom theme system with light/dark mode support (`Colors` in `constants/theme.ts`)
- Montserrat font family (Google Fonts via expo-font)
- Brand color: `#FF4D00` (orange/athletic gradient to `#FF8A00`)
- Reanimated for animations, expo-haptics for feedback
- Design guidelines in `design_guidelines.md`

**Design System**:
- Streamlined, fluid, clean aesthetic with generous whitespace
- Cards use subtle 1px borders (#E8E8E8) instead of heavy shadows
- Border radius: 16px (cards), 24px (modals), full (pills/chips)
- Spacing scale: xs(4), sm(8), md(12), lg(16), xl(24), 2xl(32)
- Gradient used sparingly: FAB, primary CTAs, progress indicators
- Typography: Montserrat for headings, system font for body

### Backend Architecture

**Server**: Express.js (v5) running on Node.js
- TypeScript with tsx for development
- CORS configured for Replit domains and localhost
- Routes registered in `server/routes.ts`
- Static file serving for production builds

**API Pattern**: RESTful endpoints prefixed with `/api`

### Data Storage

**Database**: PostgreSQL with Drizzle ORM
- Schema defined in `shared/schema.ts`
- Currently has a `users` table with id, username, password
- Drizzle-zod for schema validation
- Migrations output to `./migrations` directory

**Local Storage**: AsyncStorage for client-side persistence
- Stores: onboarding state, user preferences, workout plans, workout history
- Enables offline-first functionality

### Build & Deployment

**Development**:
- `expo:dev`: Runs Expo development server
- `server:dev`: Runs Express server with tsx

**Production**:
- `expo:static:build`: Builds static web assets
- `server:build`: Bundles server with esbuild
- `server:prod`: Runs production server

## External Dependencies

### Core Dependencies
- **Expo SDK 54**: Mobile app framework
- **React Navigation 7**: Navigation library (native-stack, bottom-tabs)
- **TanStack React Query 5**: Server state management
- **Drizzle ORM**: Database toolkit with PostgreSQL dialect
- **Express 5**: Backend web framework

### UI Libraries
- **react-native-reanimated**: Animations
- **expo-linear-gradient**: Gradient components
- **expo-blur / expo-glass-effect**: Visual effects
- **expo-haptics**: Haptic feedback
- **@expo/vector-icons (Feather)**: Icon set

### Database & Storage
- **PostgreSQL (pg)**: Database driver
- **@react-native-async-storage/async-storage**: Local persistence
- **drizzle-zod**: Schema validation

### Development Tools
- **tsx**: TypeScript execution
- **esbuild**: Production bundler for server
- **ESLint + Prettier**: Code quality