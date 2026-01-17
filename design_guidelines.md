# Workout Builder App - Design Guidelines

## Brand Identity

**Purpose**: Empower users to create personalized workout routines through an effortless, guided experience. Remove the intimidation of fitness planning.

**Aesthetic Direction**: Bold/striking with athletic energy. High contrast, confident typography, and motivational visual language. Think Nike meets Strava - powerful without being aggressive, energetic without being chaotic.

**Memorable Element**: Vibrant gradient accent system that animates progress bars and active states, making the app feel alive and motivational.

## Navigation Architecture

**Root Navigation**: Tab Bar (4 tabs) + Floating Action Button
- **My Plans** (Home) - View and manage workout plans
- **Exercises** - Browse exercise library
- **Progress** - Track workout history and stats
- **Profile** - Settings and preferences
- **FAB (Create)** - Floating button to start new workout plan

**First Launch**: Stack-only onboarding flow (3 screens) → dismisses to Home

## Screen-by-Screen Specifications

### Onboarding Flow (Stack Navigation)

**1. Welcome Screen**
- Purpose: Introduce app and start setup
- Layout: Full-screen with illustration, title, subtitle, CTA button
- No header
- Top inset: insets.top + Spacing.xl
- Bottom inset: insets.bottom + Spacing.xl
- Components: Hero illustration, headline "Build Your Perfect Workout", subtitle, "Get Started" button

**2. Frequency Question**
- Purpose: Ask "How often do you workout?"
- Layout: Question at top, pill-style selection buttons (1-7 days/week), bottom nav buttons
- Custom header with progress indicator (1/3)
- Scrollable: No
- Components: Progress bar, question text, horizontal pill selector, "Next" button (bottom right)

**3. Split Preference**
- Purpose: "Choose your split or get a recommendation?"
- Layout: Same as previous
- Custom header with progress (2/3)
- Components: Two large option cards ("I'll Choose" / "Recommend for Me"), "Back" and "Next" buttons

**4. Exercise Selection**
- Purpose: "Select exercises yourself or use defaults?"
- Layout: Same structure
- Custom header with progress (3/3)
- Components: Two option cards, "Back" and "Finish Setup" buttons
- On complete: Navigate to Home, show empty state with "Create Your First Plan" CTA

### My Plans Screen (Tab 1 - Home)

- Purpose: View and access saved workout plans
- Layout:
  - Transparent header with title "My Plans"
  - Right button: Filter icon
  - Scrollable list
  - Top inset: headerHeight + Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl + FAB_HEIGHT
- Components: 
  - Plan cards (title, days/week, last modified, thumbnail icon)
  - Empty state: Illustration with "No plans yet" message
- Press state: Card scales to 0.98

### Workout Plan Detail Screen (Modal)

- Purpose: View and start a specific plan
- Layout:
  - Default navigation header with "Edit" right button
  - Scrollable content
  - Top inset: Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- Components: Plan name, schedule grid (days of week), exercise list by day, "Start Workout" button (primary, full-width)

### Exercises Screen (Tab 2)

- Purpose: Browse exercise library
- Layout:
  - Transparent header with title "Exercises" and search bar
  - Scrollable grid (2 columns)
  - Top inset: headerHeight + Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- Components: Exercise cards (image, name, muscle group tag), filter chips at top

### Create/Edit Plan Screen (FAB trigger / Edit)

- Purpose: Build or modify workout plan
- Layout:
  - Default header with "Cancel" left button, "Save" right button
  - Scrollable form
  - Top inset: Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- Components:
  - Text input: Plan name
  - Day selector grid
  - Exercise picker (per day)
  - Submit in header (right button)

### Progress Screen (Tab 3)

- Purpose: View workout history and achievements
- Layout:
  - Transparent header with title "Progress"
  - Scrollable content
  - Top inset: headerHeight + Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- Components: Stats cards (total workouts, streak), calendar heatmap, recent activity list
- Empty state: "Complete your first workout to see stats"

### Profile Screen (Tab 4)

- Purpose: App settings and user preferences
- Layout:
  - Transparent header with title "Profile"
  - Scrollable list
  - Top inset: headerHeight + Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- Components:
  - Avatar (generated preset) with name field
  - Settings sections: Preferences (theme, units), About

## Color Palette

- **Primary**: #FF4D00 (energetic orange-red, used for CTA buttons, active states)
- **Primary Gradient**: #FF4D00 → #FF8A00 (for progress bars, FAB)
- **Background**: #FAFAFA (warm off-white)
- **Surface**: #FFFFFF (cards, inputs)
- **Surface Elevated**: #FFFFFF with shadow
- **Text Primary**: #1A1A1A
- **Text Secondary**: #6B6B6B
- **Border**: #E8E8E8
- **Success**: #00C853 (workout completed)
- **Error**: #D32F2F

## Typography

**Font**: Montserrat (Google Font) - bold, athletic feel
- **Display**: Montserrat Bold, 32px
- **H1**: Montserrat Bold, 24px
- **H2**: Montserrat SemiBold, 18px
- **Body**: System Regular, 16px (legibility for lists)
- **Caption**: System Regular, 14px, Text Secondary

## Visual Design

- Cards: 12px border radius, subtle shadow (offset: 0,1 / opacity: 0.08 / radius: 3)
- Buttons: 8px radius, scale to 0.96 on press
- FAB: Gradient background, positioned bottom right (16px from edges), shadow (offset: 0,2 / opacity: 0.10 / radius: 2)
- Icons: Feather icons from @expo/vector-icons, 24px default

## Assets to Generate

1. **icon.png** - App icon showing a stylized dumbbell or workout symbol with gradient
2. **splash-icon.png** - Same as icon, shown during launch
3. **onboarding-welcome.png** - Illustration of person planning workout on phone, energetic style. Used: Welcome screen hero
4. **empty-plans.png** - Illustration of empty workout board/clipboard. Used: My Plans empty state
5. **empty-progress.png** - Illustration of starting line or empty calendar. Used: Progress empty state
6. **avatar-default.png** - Simple athletic silhouette icon. Used: Profile screen default avatar