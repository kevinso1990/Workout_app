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

## System Architecture

### Frontend Architecture

**Framework**: React Native with Expo SDK 54
- Uses Expo's managed workflow with new architecture enabled
- File-based routing is NOT used; instead uses React Navigation (native-stack + bottom-tabs)
- Path aliases configured: `@/` maps to `./client/`, `@shared/` maps to `./shared/`

**Navigation Structure**:
- Root Stack Navigator handles app-level navigation (Onboarding, Main, CreatePlan, PlanDetail)
- Main Tab Navigator with 4 tabs (My Plans, Exercises, Progress, Profile) plus a floating action button
- Onboarding Stack for first-launch flow (Welcome → Frequency → SplitPreference → ExercisePreference → SplitSelection)

**State Management**:
- React Context for onboarding flow state (`OnboardingContext`)
- TanStack React Query for server state management
- AsyncStorage for persistent local data (user preferences, workout plans, history)

**UI/Theming**:
- Custom theme system with light/dark mode support (`Colors` in `constants/theme.ts`)
- Montserrat font family (Google Fonts via expo-font)
- Brand color: `#FF4D00` (orange/athletic)
- Reanimated for animations, expo-haptics for feedback

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