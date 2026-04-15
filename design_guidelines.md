# TrackYourLift - Design Guidelines

## Brand Identity

**Purpose**: Empower users to create personalized workout routines through an effortless, guided experience that removes fitness planning intimidation.

**Aesthetic Direction**: Luxurious/refined meets athletic minimalism. Premium whitespace, restrained elegance, and surgical precision in layout. The app breathes - every element has room to exist. Think Calm meets Nike - serene confidence, not aggressive energy. The gradient appears only in meaningful moments (progress completion, active workout), making those moments feel special.

**Memorable Element**: The gradient "reward system" - vibrant orange-red gradient appears only to celebrate progress, completed workouts, and active states, creating dopamine-triggering moments of achievement against an otherwise calm canvas.

## Navigation Architecture

**Root Navigation**: Tab Bar (4 tabs) + Floating Action Button
- **My Plans** - View saved workout routines
- **Exercises** - Browse exercise library  
- **Progress** - Track history and stats
- **Profile** - Settings and preferences
- **FAB (Create)** - Floating button for new plan (gradient background)

**First Launch**: Stack-only onboarding (3 screens) → My Plans with empty state

## Screen-by-Screen Specifications

### Onboarding Flow (Stack Navigation)

**Welcome Screen**
- Purpose: Introduce app value proposition
- Layout: Full-screen, generous vertical spacing
- No header
- Top inset: insets.top + Spacing.xxl (extra breathing room)
- Bottom inset: insets.bottom + Spacing.xxl
- Components: Hero illustration (top 40% of screen), headline "Build Your Perfect Workout" (Montserrat Bold, ample letter-spacing), minimal subtitle, single gradient CTA button at bottom

**Frequency Question (Progress 1/3)**
- Purpose: "How often do you workout?"
- Custom header: Minimal progress bar (thin line, gradient fill for completed portion)
- Scrollable: No
- Top inset: Spacing.xxl
- Bottom inset: insets.bottom + Spacing.xxl
- Components: Question text (generous top margin), 7 pill buttons (outline style, gradient border when active), "Next" text button (bottom right)

**Split & Exercise Preferences (2/3, 3/3)**
- Same layout structure as Frequency
- Large option cards: Outlined, not filled. Gradient border when selected
- Minimal "Back" and "Next" text buttons (no heavy button chrome)

### My Plans Screen (Tab 1)

- Purpose: Access and manage workout plans
- Transparent header: "My Plans" title, filter icon (right)
- Scrollable list with generous spacing between cards
- Top inset: headerHeight + Spacing.xxl
- Bottom inset: tabBarHeight + Spacing.xxl + FAB_HEIGHT
- Components: Plan cards (white surface, 1px border, 16px radius, minimal shadow), empty state illustration centered
- Press feedback: Subtle opacity change (0.7), no scale

### Plan Detail Screen (Modal)

- Purpose: View plan structure and start workout
- Default header: "Back" left, "Edit" right text button
- Scrollable
- Top inset: Spacing.xl
- Bottom inset: tabBarHeight + Spacing.xl
- Components: Plan title (large Montserrat), day grid (minimal outlined boxes), exercise list (clean typography, ample line-height), "Start Workout" gradient button (full-width, bottom of scroll)

### Exercises Screen (Tab 2)

- Transparent header: "Exercises" title, search bar (borderless, background surface color)
- Scrollable 2-column grid with equal gaps
- Top inset: headerHeight + Spacing.xxl
- Bottom inset: tabBarHeight + Spacing.xl
- Components: Exercise cards (square aspect, subtle border, no heavy shadow), filter chips (outlined, minimal)

### Create/Edit Plan Screen

- Default header: "Cancel" left text button, "Save" right (gradient text when form valid)
- Scrollable form with generous vertical rhythm
- Top inset: Spacing.xl
- Bottom inset: tabBarHeight + Spacing.xxl
- Components: Clean text inputs (bottom border only), day selector (outlined circles), exercise picker per day
- Form validation: Subtle error text, no red borders

### Progress Screen (Tab 3)

- Transparent header: "Progress" title
- Scrollable
- Top inset: headerHeight + Spacing.xxl
- Bottom inset: tabBarHeight + Spacing.xl
- Components: Stats cards (minimal outline, generous padding), calendar heatmap (gradient for workout days), activity list
- Empty state: Centered illustration with supportive message

### Profile Screen (Tab 4)

- Transparent header: "Profile" title
- Scrollable list
- Top inset: headerHeight + Spacing.xxl
- Bottom inset: tabBarHeight + Spacing.xl
- Components: Avatar (circular, subtle border), editable name field, settings sections with chevron navigation

## Color Palette

- **Primary Gradient**: #FF4D00 → #FF8A00 (use ONLY for FAB, progress fills, active workout state)
- **Primary Text**: #FF4D00 (sparingly for active labels)
- **Background**: #FFFFFF (pure white for maximum calm)
- **Surface**: #FAFAFA (cards, subtle differentiation)
- **Text Primary**: #0F0F0F
- **Text Secondary**: #8A8A8A
- **Border**: #E8E8E8 (1px, subtle)
- **Success**: #00C853
- **Error**: #D32F2F

## Typography

**Font**: Montserrat for headings, SF Pro (system) for body
- **Display**: Montserrat Bold, 28px, letter-spacing: -0.5px
- **H1**: Montserrat SemiBold, 20px
- **H2**: Montserrat Medium, 16px
- **Body**: SF Pro Regular, 16px, line-height: 24px
- **Caption**: SF Pro Regular, 13px, Text Secondary

## Visual Design

- Cards: 16px radius, border 1px #E8E8E8, shadow (offset: 0,1 / opacity: 0.04 / radius: 4)
- Buttons: Outlined by default, gradient only for primary CTA
- Text buttons: No background, just color
- FAB: Gradient, 56x56px, bottom-right (24px margins), shadow (offset: 0,2 / opacity: 0.08 / radius: 8)
- Icons: Feather, 22px, stroke-width: 1.5 (delicate)
- Spacing scale: xs:4, sm:8, md:12, lg:16, xl:24, xxl:32
- Touch targets: Minimum 44x44px

## Assets to Generate

1. **icon.png** - Minimalist dumbbell icon, gradient accent. Used: Device home screen
2. **splash-icon.png** - Same as icon. Used: App launch
3. **onboarding-welcome.png** - Abstract illustration of workout routine visualization, clean line art. Used: Welcome screen
4. **empty-plans.png** - Serene illustration of blank canvas/clipboard with subtle energy. Used: My Plans empty state
5. **empty-progress.png** - Minimalist "day one" starting illustration. Used: Progress empty state
6. **avatar-default.png** - Simple circular athletic silhouette. Used: Profile default avatar