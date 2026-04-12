/**
 * Static / local exercise media provider.
 *
 * Images: GitHub CDN via getExerciseImageUrl (returns null → fallback card).
 * Cues:   hardcoded per exercise; safe generic fallback for unknown exercises.
 *
 * Hook-in point for YMove: replace this file's image logic with
 * YMoveProvider (see ymoveProvider.stub.ts) via ACTIVE_MEDIA_PROVIDER config.
 */

import { ExerciseMedia, ExerciseMediaProvider } from "../types";
import { getExerciseImageUrl } from "../../exerciseImages";

// ── Per-exercise cues and category ─────────────────────────────────────────

const EXERCISE_INFO: Record<string, { category: string; cues: string[] }> = {
  // ── CHEST ────────────────────────────────────────────────────────────────
  "Bench Press": {
    category: "Compound",
    cues: [
      "Lie flat, feet planted, slight arch in lower back",
      "Grip slightly wider than shoulder-width",
      "Lower bar to mid-chest, 2–3 sec descent",
      "Drive bar up and slightly back toward the rack",
      "Keep shoulder blades retracted throughout",
    ],
  },
  "Barbell Bench Press": {
    category: "Compound",
    cues: [
      "Lie flat, feet planted, slight arch in lower back",
      "Grip slightly wider than shoulder-width",
      "Lower bar to mid-chest, 2–3 sec descent",
      "Drive bar up and slightly back toward the rack",
      "Keep shoulder blades retracted throughout",
    ],
  },
  "Dumbbell Bench Press": {
    category: "Compound",
    cues: [
      "Neutral or pronated grip, dumbbells at chest level",
      "Press in a slight inward arc — not straight up",
      "Keep wrists stacked over elbows",
      "Control the descent — no bouncing off chest",
    ],
  },
  "Incline Dumbbell Press": {
    category: "Compound",
    cues: [
      "Set bench to 30–45°",
      "Lower dumbbells to upper-chest, not shoulders",
      "Press in a slight inward arc at the top",
      "Keep core braced throughout",
    ],
  },
  "Cable Flyes": {
    category: "Isolation",
    cues: [
      "Set cables at shoulder height, step forward",
      "Slight bend in elbows, maintained throughout",
      "Draw hands together in a hugging arc",
      "Squeeze chest at full contraction",
      "Slow 2-sec return to start",
    ],
  },
  "Dumbbell Flyes": {
    category: "Isolation",
    cues: [
      "Slight bend in elbows throughout",
      "Lower until you feel a strong chest stretch",
      "Squeeze chest to bring dumbbells together",
      "Don't let elbows drop below shoulder level",
    ],
  },
  "Push-Ups": {
    category: "Compound",
    cues: [
      "Hands just outside shoulder-width",
      "Keep body in a straight plank line — no hip sag",
      "Lower chest to within 2 cm of floor",
      "Full lockout at top without shrugging shoulders",
    ],
  },
  "Chest Dips": {
    category: "Compound",
    cues: [
      "Lean forward 30–45° to target chest",
      "Lower until upper arms are parallel to floor",
      "Keep elbows slightly flared",
      "Press up to full lockout",
    ],
  },
  "Diamond Push-Ups": {
    category: "Compound",
    cues: [
      "Hands in diamond shape directly under chest",
      "Keep elbows close to body",
      "Full range — chest nearly touching hands",
      "Maintain straight body line",
    ],
  },
  "KB Floor Press": {
    category: "Compound",
    cues: [
      "Lie flat, knees bent, feet flat on floor",
      "Press KB straight up; lower until tricep touches floor",
      "Keep wrist straight and stacked over elbow",
      "Pause briefly at bottom, press explosively",
    ],
  },
  "KB Squeeze Press": {
    category: "Compound",
    cues: [
      "Press both KBs together as you press up",
      "Squeeze KBs toward each other throughout the set",
      "Full lockout at top",
      "Lower slowly, maintaining tension",
    ],
  },

  // ── BACK ─────────────────────────────────────────────────────────────────
  "Deadlift": {
    category: "Compound",
    cues: [
      "Bar over mid-foot, hip-width stance",
      "Hinge at hips, grip just outside legs",
      "Push the floor away — don't think 'pull'",
      "Bar stays against shins and thighs",
      "Lock out hips and knees simultaneously at top",
    ],
  },
  "Barbell Row": {
    category: "Compound",
    cues: [
      "Hip-hinge until torso is ~45°",
      "Pull bar to lower sternum / upper abdomen",
      "Lead with elbows, not hands",
      "Squeeze shoulder blades together at top",
      "Lower under full control — 2 sec descent",
    ],
  },
  "Barbell Rows": {
    category: "Compound",
    cues: [
      "Hip-hinge until torso is ~45°",
      "Pull bar to lower sternum / upper abdomen",
      "Lead with elbows, not hands",
      "Squeeze shoulder blades together at top",
      "Lower under full control — 2 sec descent",
    ],
  },
  "Dumbbell Row": {
    category: "Compound",
    cues: [
      "Brace free hand and knee on bench",
      "Pull dumbbell to hip, elbow close to body",
      "Let shoulder blade fully retract at top",
      "Slow 2-sec lowering",
    ],
  },
  "Chest Supported Row": {
    category: "Compound",
    cues: [
      "Chest on incline bench, elbows track at sides",
      "Pull dumbbells to hips, squeeze shoulder blades",
      "Lower fully to a stretch",
      "No swinging — support eliminates cheating",
    ],
  },
  "KB Row": {
    category: "Compound",
    cues: [
      "Plant free hand on sturdy surface",
      "Pull KB to hip — elbow travels past torso",
      "Pause at top, shoulder blade fully retracted",
      "Lower in 2 seconds",
    ],
  },
  "KB Renegade Row": {
    category: "Compound",
    cues: [
      "Start in plank, both hands on KB handles",
      "Keep hips square — no rotation",
      "Row one KB to hip, then switch",
      "Squeeze core to prevent rocking",
    ],
  },
  "KB High Pull": {
    category: "Compound",
    cues: [
      "Start with KB between feet, slight squat",
      "Drive through hips and pull elbows high",
      "Keep KB close to body throughout",
      "Control the descent back to start",
    ],
  },
  "KB Clean": {
    category: "Compound",
    cues: [
      "Hike KB back then drive hips forward",
      "Pull KB close to body on the way up",
      "Catch in rack position — wrist straight",
      "Absorb with a slight squat at the catch",
    ],
  },
  "KB Snatch": {
    category: "Compound",
    cues: [
      "Drive through hips explosively",
      "Pull KB close, punch through at the top",
      "Lockout arm overhead, bicep by ear",
      "Hike back under control for next rep",
    ],
  },
  "Pull-Ups": {
    category: "Compound",
    cues: [
      "Dead hang start, overhand grip, shoulder-width",
      "Pull chest toward bar — not just chin over bar",
      "Drive elbows down and back",
      "Full dead hang at bottom before next rep",
    ],
  },
  "Chin-Ups": {
    category: "Compound",
    cues: [
      "Underhand grip, hands shoulder-width",
      "Lead with chest, not chin",
      "Full extension at the bottom",
      "Controlled descent",
    ],
  },
  "Lat Pulldown": {
    category: "Compound",
    cues: [
      "Lean back 10–15° from vertical",
      "Pull bar to upper chest, leading with elbows",
      "Squeeze lats at full contraction",
      "Return under control — don't let stack crash",
    ],
  },
  "Lat Pulldowns": {
    category: "Compound",
    cues: [
      "Lean back 10–15° from vertical",
      "Pull bar to upper chest, leading with elbows",
      "Squeeze lats at full contraction",
      "Return under control — don't let stack crash",
    ],
  },
  "Seated Cable Row": {
    category: "Compound",
    cues: [
      "Maintain upright torso — minimal swinging",
      "Pull handle to lower abs, elbows close to body",
      "Retract shoulder blades fully at the end",
      "Stretch forward with control on return",
    ],
  },
  "Seated Cable Rows": {
    category: "Compound",
    cues: [
      "Maintain upright torso — minimal swinging",
      "Pull handle to lower abs, elbows close to body",
      "Retract shoulder blades fully at the end",
      "Stretch forward with control on return",
    ],
  },
  "Hyperextension": {
    category: "Compound",
    cues: [
      "Hips at pad edge, arms crossed or behind head",
      "Hinge forward until torso is 45° to floor",
      "Drive hips forward to return to neutral",
      "Don't hyperextend — stop at neutral spine",
    ],
  },

  // ── SHOULDERS ────────────────────────────────────────────────────────────
  "Overhead Press": {
    category: "Compound",
    cues: [
      "Grip just outside shoulder-width",
      "Press straight up, let head drift slightly back",
      "Lock out overhead — biceps by ears",
      "Lower to chin level under control",
    ],
  },
  "Dumbbell Shoulder Press": {
    category: "Compound",
    cues: [
      "Start with dumbbells at ear level",
      "Press in a slight inward arc",
      "Full lockout at top without shrugging",
      "Lower to shoulder level — not behind head",
    ],
  },
  "KB Press": {
    category: "Compound",
    cues: [
      "Clean KB to rack position first",
      "Press straight up, palm turns forward at top",
      "Engage core — don't side-lean",
      "Lower slowly back to rack position",
    ],
  },
  "KB Push Press": {
    category: "Compound",
    cues: [
      "Dip knees slightly, drive with legs",
      "Use leg drive to initiate the press",
      "Press to full lockout overhead",
      "Lower under control — don't drop",
    ],
  },
  "KB Halo": {
    category: "Isolation",
    cues: [
      "Hold KB bell at chest level, horns up",
      "Circle KB around head slowly",
      "Keep core tight — resist torso rotation",
      "Alternate directions each set",
    ],
  },
  "Lateral Raise": {
    category: "Isolation",
    cues: [
      "Slight bend in elbows throughout",
      "Raise to shoulder height — no higher",
      "Lead with pinkies, not thumbs",
      "2-second lowering phase",
    ],
  },
  "Lateral Raises": {
    category: "Isolation",
    cues: [
      "Slight bend in elbows throughout",
      "Raise to shoulder height — no higher",
      "Lead with pinkies, not thumbs",
      "2-second lowering phase",
    ],
  },
  "KB Lateral Raise": {
    category: "Isolation",
    cues: [
      "Hold KB by handle, slight elbow bend",
      "Raise to shoulder height, pinky slightly up",
      "Don't shrug — keep traps relaxed",
      "Lower in 2 seconds",
    ],
  },
  "Face Pull": {
    category: "Isolation",
    cues: [
      "Set cable at forehead height",
      "Pull to face, elbows flared high",
      "Externally rotate at end of movement",
      "Squeeze rear delts, hold 1 second",
    ],
  },
  "Face Pulls": {
    category: "Isolation",
    cues: [
      "Set cable at forehead height",
      "Pull to face, elbows flared high",
      "Externally rotate at end of movement",
      "Squeeze rear delts, hold 1 second",
    ],
  },
  "Rear Delt Fly": {
    category: "Isolation",
    cues: [
      "Hinge forward until torso is ~45°",
      "Slight bend in elbows, raise to shoulder height",
      "Lead with elbows, not hands",
      "Squeeze rear delts at the top",
    ],
  },
  "Rear Delt Flyes": {
    category: "Isolation",
    cues: [
      "Hinge forward until torso is ~45°",
      "Slight bend in elbows, raise to shoulder height",
      "Lead with elbows, not hands",
      "Squeeze rear delts at the top",
    ],
  },
  "Front Raise": {
    category: "Isolation",
    cues: [
      "Hold dumbbells with pronated grip",
      "Raise one or both arms to shoulder height",
      "Slight elbow bend throughout",
      "Lower slowly — 3-sec descent",
    ],
  },
  "Front Raises": {
    category: "Isolation",
    cues: [
      "Hold dumbbells with pronated grip",
      "Raise one or both arms to shoulder height",
      "Slight elbow bend throughout",
      "Lower slowly — 3-sec descent",
    ],
  },

  // ── BICEPS ───────────────────────────────────────────────────────────────
  "Barbell Curl": {
    category: "Isolation",
    cues: [
      "Elbows pinned at sides",
      "Curl all the way to full contraction",
      "Supinate wrists at top",
      "3-second lowering — never drop it",
    ],
  },
  "Bicep Curls": {
    category: "Isolation",
    cues: [
      "Elbows pinned at sides",
      "Curl all the way to full contraction",
      "Supinate wrists at top",
      "3-second lowering — never drop it",
    ],
  },
  "Dumbbell Curl": {
    category: "Isolation",
    cues: [
      "Supinate wrist on the way up",
      "Full range — full extension at bottom",
      "Keep shoulders still",
      "Alternate or simultaneous reps",
    ],
  },
  "Hammer Curl": {
    category: "Isolation",
    cues: [
      "Neutral grip — thumbs up throughout",
      "Keep elbows pinned to sides",
      "Curl to shoulder height",
      "Lower slowly in 2–3 seconds",
    ],
  },
  "Hammer Curls": {
    category: "Isolation",
    cues: [
      "Neutral grip — thumbs up throughout",
      "Keep elbows pinned to sides",
      "Curl to shoulder height",
      "Lower slowly in 2–3 seconds",
    ],
  },
  "Preacher Curl": {
    category: "Isolation",
    cues: [
      "Upper arms flat on pad",
      "Full stretch at bottom without hyperextending",
      "Curl to full contraction",
      "Slow eccentric — 3 sec down",
    ],
  },
  "Incline Dumbbell Curl": {
    category: "Isolation",
    cues: [
      "Set bench to 45–60°, arms hang straight down",
      "Curl without swinging elbows forward",
      "Full stretch at bottom is the goal",
      "Slow controlled movement",
    ],
  },
  "KB Curl": {
    category: "Isolation",
    cues: [
      "Hold KB by horns or handle",
      "Curl with full range of motion",
      "Don't swing elbows forward",
      "Lower all the way before next rep",
    ],
  },
  "KB Hammer Curl": {
    category: "Isolation",
    cues: [
      "Hold KB handle, neutral grip",
      "Curl up while keeping elbow fixed",
      "Lower in 2 seconds",
    ],
  },

  // ── TRICEPS ──────────────────────────────────────────────────────────────
  "Tricep Pushdown": {
    category: "Isolation",
    cues: [
      "Elbows pinned to sides",
      "Push down until arms fully extended",
      "Squeeze triceps at the bottom",
      "Controlled return — no letting the stack crash",
    ],
  },
  "Tricep Pushdowns": {
    category: "Isolation",
    cues: [
      "Elbows pinned to sides",
      "Push down until arms fully extended",
      "Squeeze triceps at the bottom",
      "Controlled return — no letting the stack crash",
    ],
  },
  "Overhead Tricep Extension": {
    category: "Isolation",
    cues: [
      "Hold dumbbell overhead with both hands",
      "Lower behind head, elbows pointing up",
      "Don't flare elbows out",
      "Press to full extension",
    ],
  },
  "KB Overhead Tricep Extension": {
    category: "Isolation",
    cues: [
      "Hold KB bell (not handle) overhead",
      "Lower behind head, elbows tight",
      "Press to full lockout",
      "Keep core engaged to avoid lower-back arch",
    ],
  },
  "Skull Crushers": {
    category: "Isolation",
    cues: [
      "Lower bar/dumbbell to forehead level",
      "Keep upper arms perpendicular to floor",
      "Press to full lockout",
      "Control the negative — never drop",
    ],
  },
  "KB Skull Crusher": {
    category: "Isolation",
    cues: [
      "Hold KB above chest, then lower behind head",
      "Keep upper arms still — only forearms move",
      "Press to lockout",
      "Slow and controlled",
    ],
  },
  "Tricep Dips": {
    category: "Compound",
    cues: [
      "Hands behind on bench/chair, elbows tracking back",
      "Lower until arms are ~90°",
      "Keep back close to the surface",
      "Press to full lockout",
    ],
  },
  "Tricep Kickback": {
    category: "Isolation",
    cues: [
      "Hinge forward, upper arm parallel to floor",
      "Extend arm back to full lockout",
      "Keep upper arm still — only forearm moves",
      "Squeeze tricep at lockout",
    ],
  },
  "Dips": {
    category: "Compound",
    cues: [
      "Lean forward slightly for chest focus",
      "Lower until upper arms are parallel to floor",
      "Keep elbows slightly flared",
      "Press to full lockout at top",
    ],
  },

  // ── LEGS ─────────────────────────────────────────────────────────────────
  "Squats": {
    category: "Compound",
    cues: [
      "Feet shoulder-width, slight toe-out",
      "Squat below parallel — hip crease below knee",
      "Knees tracking over toes",
      "Drive through full foot — chest up throughout",
    ],
  },
  "Barbell Squat": {
    category: "Compound",
    cues: [
      "Bar on mid-traps, not neck",
      "Squat below parallel — hip crease below knee",
      "Knees tracking over toes",
      "Drive through full foot — not just heels",
      "Chest up throughout",
    ],
  },
  "Goblet Squat": {
    category: "Compound",
    cues: [
      "Hold dumbbell/KB at chest with both hands",
      "Squat to parallel or below",
      "Elbows track inside knees at the bottom",
      "Drive through heels to stand",
    ],
  },
  "KB Goblet Squat": {
    category: "Compound",
    cues: [
      "Hold KB bell against chest",
      "Feet shoulder-width, slight toe-out",
      "Deep squat — hips below knees",
      "Elbows press knees open at bottom",
    ],
  },
  "Romanian Deadlift": {
    category: "Compound",
    cues: [
      "Soft bend in knees, maintained throughout",
      "Push hips back — not down",
      "Bar/dumbbells stay close to legs",
      "Stop when you feel a strong hamstring stretch",
      "Drive hips forward to stand",
    ],
  },
  "KB Romanian Deadlift": {
    category: "Compound",
    cues: [
      "Hold KB in front of thighs",
      "Hinge at hips, push them back",
      "Keep back flat — avoid rounding",
      "Lower until strong hamstring stretch",
      "Squeeze glutes to return",
    ],
  },
  "KB Swing": {
    category: "Compound",
    cues: [
      "Hinge — don't squat",
      "Hike KB between legs, snap hips forward",
      "Swing to chest height, arms straight",
      "Let KB fall back and hike again",
      "Power comes from hips, not arms",
    ],
  },
  "Bulgarian Split Squat": {
    category: "Compound",
    cues: [
      "Rear foot elevated on bench",
      "Front foot far enough forward for vertical shin",
      "Lower until rear knee nearly touches floor",
      "Drive through front heel to return",
    ],
  },
  "KB Bulgarian Split Squat": {
    category: "Compound",
    cues: [
      "Hold KBs at sides or in goblet position",
      "Rear foot on bench",
      "Lower until rear knee nearly touches floor",
      "Keep front shin vertical",
    ],
  },
  "Leg Press": {
    category: "Compound",
    cues: [
      "Place feet shoulder-width at mid-plate",
      "Lower until knees reach ~90°",
      "Don't let knees cave inward",
      "Press without fully locking knees at top",
    ],
  },
  "Leg Curl": {
    category: "Isolation",
    cues: [
      "Lie face down, pad just above heels",
      "Curl heels toward glutes",
      "Squeeze hamstrings at full contraction",
      "3-second lowering phase",
    ],
  },
  "Leg Curls": {
    category: "Isolation",
    cues: [
      "Lie face down, pad just above heels",
      "Curl heels toward glutes",
      "Squeeze hamstrings at full contraction",
      "3-second lowering phase",
    ],
  },
  "Leg Extension": {
    category: "Isolation",
    cues: [
      "Sit upright, pad just above ankle",
      "Extend to full lockout, squeeze quads",
      "Slow 3-second lowering",
      "Don't swing or use momentum",
    ],
  },
  "Walking Lunges": {
    category: "Compound",
    cues: [
      "Step forward into a deep lunge",
      "Back knee nearly touches floor",
      "Front shin vertical",
      "Drive through front foot to stand",
      "Alternate legs with each step",
    ],
  },
  "Reverse Lunges": {
    category: "Compound",
    cues: [
      "Step backward, lower back knee to floor",
      "Keep front shin vertical",
      "Drive through front heel to return",
      "Keep torso upright",
    ],
  },
  "KB Lunges": {
    category: "Compound",
    cues: [
      "Hold KB at sides or in goblet position",
      "Step forward, lower back knee to floor",
      "Front shin stays vertical",
      "Drive through front heel to return",
    ],
  },
  "Glute Bridge": {
    category: "Compound",
    cues: [
      "Lie on back, feet flat, knees bent",
      "Drive hips up until body is straight",
      "Squeeze glutes hard at the top",
      "Hold 1 second, then lower slowly",
    ],
  },
  "Hip Thrust": {
    category: "Compound",
    cues: [
      "Upper back on bench, bar across hips",
      "Drive hips up to full extension",
      "Squeeze glutes hard at the top",
      "Lower until hips are just above floor",
    ],
  },
  "Standing Calf Raise": {
    category: "Isolation",
    cues: [
      "Ball of foot on edge of step",
      "Lower heel below step for full stretch",
      "Rise as high as possible on toes",
      "Hold 1 second at the top",
    ],
  },
  "Seated Calf Raise": {
    category: "Isolation",
    cues: [
      "Pad rests on lower thighs",
      "Lower heels for full stretch",
      "Rise onto toes as high as possible",
      "Pause at top, lower slowly",
    ],
  },
  "KB Calf Raise": {
    category: "Isolation",
    cues: [
      "Hold KB at sides for load",
      "Rise on toes, pause at top",
      "Lower heel below step level if possible",
      "Slow controlled movement",
    ],
  },
  "Sissy Squat": {
    category: "Isolation",
    cues: [
      "Hold a support lightly for balance",
      "Lean back while bending knees forward",
      "Lower until knees nearly touch floor",
      "Keep hips fully extended throughout",
    ],
  },
  "Step Ups": {
    category: "Compound",
    cues: [
      "Step up fully — don't push off back foot",
      "Drive through heel of leading leg",
      "Stand fully upright at top",
      "Lower the trailing leg with control",
    ],
  },

  // ── CORE ─────────────────────────────────────────────────────────────────
  "Plank": {
    category: "Compound",
    cues: [
      "Squeeze everything: glutes, abs, quads",
      "Body in a straight line — no hip sag or raised hips",
      "Breathe steadily; don't hold your breath",
      "Push floor away with forearms/hands",
    ],
  },
  "Russian Twist": {
    category: "Isolation",
    cues: [
      "Sit with knees bent, feet may be raised",
      "Rotate from shoulders — not just arms",
      "Control the movement — don't rush",
      "Keep lower back straight, not rounded",
    ],
  },
  "KB Russian Twist": {
    category: "Isolation",
    cues: [
      "Hold KB by the horns",
      "Rotate fully side to side",
      "Keep lower back neutral",
      "Slow and controlled movement",
    ],
  },
  "Hanging Leg Raise": {
    category: "Isolation",
    cues: [
      "Dead hang with no swinging",
      "Raise legs to 90° or higher",
      "Control the lowering — no swinging",
      "Posterior pelvic tilt at the top",
    ],
  },
  "Cable Crunch": {
    category: "Isolation",
    cues: [
      "Kneel facing cable, rope beside ears",
      "Crunch down — pull ribs toward hips",
      "Don't pull with arms — abs do the work",
      "Slow 3-sec return to stretch",
    ],
  },
  "Ab Wheel Rollout": {
    category: "Compound",
    cues: [
      "Start kneeling, arms straight",
      "Roll out as far as you can control",
      "Pull back using abs — not momentum",
      "Keep hips in line with torso",
    ],
  },
  "Dead Bug": {
    category: "Compound",
    cues: [
      "Press lower back firmly into floor",
      "Lower opposite arm and leg slowly",
      "Keep lower back touching floor throughout",
      "Exhale as you lower limbs",
    ],
  },
  "Mountain Climbers": {
    category: "Compound",
    cues: [
      "Start in plank position",
      "Drive knees to chest alternately",
      "Keep hips level — no bouncing",
      "Quick tempo for conditioning, slow for core",
    ],
  },
  "Crunches": {
    category: "Isolation",
    cues: [
      "Curl shoulder blades off floor — not a sit-up",
      "Exhale at top contraction",
      "Lower slowly without releasing tension",
      "Hands behind head, elbows wide",
    ],
  },
  "KB Turkish Get-Up": {
    category: "Compound",
    cues: [
      "Keep arm straight, perpendicular to floor",
      "Eyes on KB throughout",
      "Move through each position deliberately",
      "Reverse the movement to return to floor",
    ],
  },
  "KB Windmill": {
    category: "Compound",
    cues: [
      "Hold KB overhead, locked out",
      "Look up at KB throughout",
      "Bend sideways at waist, lower hand toward floor",
      "Keep KB arm fully locked out",
    ],
  },
  "Side Plank": {
    category: "Compound",
    cues: [
      "Stack feet or stagger for balance",
      "Drive hip up — no sagging",
      "Keep body in a straight line",
      "Breathe steadily",
    ],
  },
  "Sit-Ups": {
    category: "Isolation",
    cues: [
      "Feet anchored or free",
      "Curl all the way up to vertical",
      "Lower slowly with control",
      "Keep chin off chest — look ahead",
    ],
  },

  // ── TRAPS / FOREARMS ─────────────────────────────────────────────────────
  "Barbell Shrug": {
    category: "Isolation",
    cues: [
      "Hold bar in front, shoulder-width grip",
      "Shrug straight up — no rolling",
      "Hold at top for 1 second",
      "Lower slowly to full stretch",
    ],
  },
  "Dumbbell Shrug": {
    category: "Isolation",
    cues: [
      "Dumbbells at sides, arms straight",
      "Shrug toward ears — no rolling",
      "Hold 1 second at top",
      "Full stretch at bottom",
    ],
  },
  "KB Farmer's Walk": {
    category: "Compound",
    cues: [
      "Hold heavy KBs at sides",
      "Walk with upright posture",
      "Small, controlled steps",
      "Keep shoulders packed — not shrugged",
    ],
  },
};

const GENERIC_CUES = [
  "Focus on controlled movement throughout",
  "Breathe out on the exertion phase",
  "Full range of motion for best results",
  "Stop if you feel sharp or joint pain",
];

export class StaticExerciseProvider implements ExerciseMediaProvider {
  readonly providerName = "static";

  getMedia(exerciseName: string): ExerciseMedia {
    const info = EXERCISE_INFO[exerciseName];
    return {
      imageUrl: getExerciseImageUrl(exerciseName),
      cues: info?.cues ?? GENERIC_CUES,
      category: info?.category ?? "Exercise",
    };
  }
}
