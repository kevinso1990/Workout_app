-- TrackYourLift Datenbank-Export
-- Erstellt: 2026-05-03T06:25:38.990Z
-- SQLite-Dump: kompatibel mit SQLite 3.x

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- Tabelle: body_weight
DROP TABLE IF EXISTS body_weight;
CREATE TABLE body_weight (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_kg REAL NOT NULL,
      logged_date TEXT NOT NULL DEFAULT (date('now')),
      notes TEXT
    , user_id INTEGER REFERENCES users(id) ON DELETE CASCADE);

-- Daten für: body_weight (1 Zeilen)
INSERT INTO "body_weight" ("id", "weight_kg", "logged_date", "notes", "user_id") VALUES (1, 80.5, '2026-03-03', NULL, NULL);

-- Tabelle: exercise_feedback
DROP TABLE IF EXISTS exercise_feedback;
CREATE TABLE exercise_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      rating TEXT CHECK(rating IN ('easy', 'right', 'hard')), user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

-- Tabelle: exercise_media_cache
DROP TABLE IF EXISTS exercise_media_cache;
CREATE TABLE exercise_media_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_name TEXT NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now'))
    );

-- Tabelle: exercise_votes
DROP TABLE IF EXISTS exercise_votes;
CREATE TABLE exercise_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      exercise_id INTEGER NOT NULL,
      vote INTEGER NOT NULL CHECK(vote IN (-1, 1)),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(device_id, exercise_id),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

-- Tabelle: exercises
DROP TABLE IF EXISTS exercises;
CREATE TABLE exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      muscle_group TEXT NOT NULL,
      is_custom INTEGER DEFAULT 0
    , equipment TEXT DEFAULT 'barbell', gif_url TEXT);

-- Daten für: exercises (129 Zeilen)
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (1, 'Barbell Bench Press', 'Chest', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (2, 'Incline Barbell Bench Press', 'Chest', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Incline_Bench_Press_-_Medium_Grip/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (3, 'Decline Barbell Bench Press', 'Chest', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (4, 'Dumbbell Bench Press', 'Chest', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bench_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (5, 'Incline Dumbbell Press', 'Chest', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (6, 'Dumbbell Flyes', 'Chest', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Flyes/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (7, 'Cable Flyes', 'Chest', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crossover/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (8, 'Machine Chest Press', 'Chest', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bench_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (9, 'Pec Deck', 'Chest', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bench_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (10, 'Push-Ups', 'Chest', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Decline_Push-Up/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (11, 'Chest Dips', 'Chest', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dips_-_Chest_Version/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (12, 'Landmine Press', 'Chest', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shoulder_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (13, 'Barbell Row', 'Back', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Barbell_Row/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (14, 'Dumbbell Row', 'Back', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Two-Dumbbell_Row/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (15, 'Pendlay Row', 'Back', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Barbell_Row/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (16, 'T-Bar Row', 'Back', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_T-Bar_Row/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (17, 'Seated Cable Row', 'Back', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Elevated_Cable_Rows/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (18, 'Lat Pulldown', 'Back', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Front_Lat_Pulldown/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (19, 'Wide Grip Lat Pulldown', 'Back', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Full_Range-Of-Motion_Lat_Pulldown/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (20, 'Pull-Ups', 'Back', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Band_Assisted_Pull-Up/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (21, 'Chin-Ups', 'Back', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Band_Assisted_Pull-Up/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (22, 'Cable Pullover', 'Back', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (23, 'Straight Arm Pulldown', 'Back', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (24, 'Machine Row', 'Back', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Elevated_Cable_Rows/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (25, 'Meadows Row', 'Back', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Barbell_Row/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (26, 'Chest Supported Row', 'Back', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Incline_Row/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (27, 'Overhead Press', 'Shoulders', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shoulder_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (28, 'Dumbbell Shoulder Press', 'Shoulders', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Shoulder_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (29, 'Arnold Press', 'Shoulders', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Arnold_Dumbbell_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (30, 'Lateral Raise', 'Shoulders', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (31, 'Cable Lateral Raise', 'Shoulders', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (32, 'Machine Lateral Raise', 'Shoulders', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (33, 'Front Raise', 'Shoulders', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Front_Dumbbell_Raise/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (34, 'Rear Delt Fly', 'Shoulders', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (35, 'Face Pull', 'Shoulders', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (36, 'Upright Row', 'Shoulders', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Rear_Delt_Row/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (37, 'Behind The Neck Press', 'Shoulders', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shoulder_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (38, 'Machine Shoulder Press', 'Shoulders', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Shoulder_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (39, 'Barbell Squat', 'Legs', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Full_Squat/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (40, 'Front Squat', 'Legs', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Full_Squat/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (41, 'Goblet Squat', 'Legs', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Goblet_Squat/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (42, 'Hack Squat', 'Legs', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hack_Squat/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (43, 'Leg Press', 'Legs', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (44, 'Leg Extension', 'Legs', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Extensions/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (45, 'Leg Curl', 'Legs', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Leg_Curls/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (46, 'Seated Leg Curl', 'Legs', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Leg_Curls/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (47, 'Romanian Deadlift', 'Legs', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (48, 'Stiff Leg Deadlift', 'Legs', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (49, 'Sumo Deadlift', 'Legs', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (50, 'Bulgarian Split Squat', 'Legs', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Side_Split_Squat/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (51, 'Walking Lunges', 'Legs', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Lunges/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (52, 'Reverse Lunges', 'Legs', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Lunges/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (53, 'Hip Thrust', 'Legs', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Hip_Thrust/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (54, 'Glute Bridge', 'Legs', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Glute_Bridge/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (55, 'Step Ups', 'Legs', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Step_Ups/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (56, 'Sissy Squat', 'Legs', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Full_Squat/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (57, 'Leg Press Calf Raise', 'Legs', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Calf_Press_On_The_Leg_Press_Machine/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (58, 'Standing Calf Raise', 'Legs', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Donkey_Calf_Raises/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (59, 'Seated Calf Raise', 'Legs', 0, 'machine', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Seated_Calf_Raise/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (60, 'Deadlift', 'Back', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (61, 'Trap Bar Deadlift', 'Back', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (62, 'Rack Pull', 'Back', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (63, 'Good Morning', 'Back', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (64, 'Hyperextension', 'Back', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hyperextensions_With_No_Hyperextension_Bench/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (65, 'Barbell Curl', 'Biceps', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (66, 'Dumbbell Curl', 'Biceps', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bicep_Curl/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (67, 'Hammer Curl', 'Biceps', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hammer_Curls/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (68, 'Preacher Curl', 'Biceps', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Machine_Preacher_Curls/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (69, 'Incline Dumbbell Curl', 'Biceps', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Curl/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (70, 'Cable Curl', 'Biceps', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/High_Cable_Curls/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (71, 'Concentration Curl', 'Biceps', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Concentration_Curls/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (72, 'EZ-Bar Curl', 'Biceps', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/EZ-Bar_Curl/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (73, 'Spider Curl', 'Biceps', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Cable_Curl/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (74, 'Bayesian Curl', 'Biceps', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/High_Cable_Curls/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (75, 'Reverse Curl', 'Biceps', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (76, 'Tricep Pushdown', 'Triceps', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Incline_Pushdown/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (77, 'Overhead Tricep Extension', 'Triceps', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_One-Arm_Triceps_Extension/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (78, 'Skull Crushers', 'Triceps', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/EZ-Bar_Skullcrusher/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (79, 'Close Grip Bench Press', 'Triceps', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Barbell_Bench_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (80, 'Tricep Dips', 'Triceps', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dips_-_Triceps_Version/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (81, 'Tricep Kickback', 'Triceps', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_One-Arm_Triceps_Extension/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (82, 'Cable Overhead Extension', 'Triceps', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_One-Arm_Triceps_Extension/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (83, 'Diamond Push-Ups', 'Triceps', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Push-Up_off_of_a_Dumbbell/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (84, 'JM Press', 'Triceps', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Barbell_Bench_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (85, 'Plank', 'Core', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dead_Bug/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (86, 'Side Plank', 'Core', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dead_Bug/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (87, 'Crunches', 'Core', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Crunches/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (88, 'Russian Twist', 'Core', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Russian_Twists/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (89, 'Hanging Leg Raise', 'Core', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (90, 'Cable Crunch', 'Core', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crunch/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (91, 'Ab Wheel Rollout', 'Core', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Ab_Roller/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (92, 'Mountain Climbers', 'Core', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Mountain_Climbers/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (93, 'Dead Bug', 'Core', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dead_Bug/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (94, 'Sit-Ups', 'Core', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/3_4_Sit-Up/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (95, 'Pallof Press', 'Core', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crunch/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (96, 'Woodchoppers', 'Core', 0, 'cable', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crunch/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (97, 'Decline Sit-Ups', 'Core', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/3_4_Sit-Up/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (98, 'Dragon Flag', 'Core', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (99, 'Barbell Shrug', 'Traps', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shrug/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (100, 'Dumbbell Shrug', 'Traps', 0, 'dumbbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Shrug/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (101, 'Farmer''s Walk', 'Traps', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shrug/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (102, 'Wrist Curl', 'Forearms', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (103, 'Reverse Wrist Curl', 'Forearms', 0, 'barbell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (104, 'Plate Pinch', 'Forearms', 0, 'bodyweight', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shrug/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (105, 'KB Goblet Squat', 'Legs', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Goblet_Squat/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (106, 'KB Swing', 'Legs', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (107, 'KB Romanian Deadlift', 'Legs', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (108, 'KB Lunges', 'Legs', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Lunges/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (109, 'KB Bulgarian Split Squat', 'Legs', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Side_Split_Squat/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (110, 'KB Calf Raise', 'Legs', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Donkey_Calf_Raises/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (111, 'KB Press', 'Shoulders', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shoulder_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (112, 'KB Push Press', 'Shoulders', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shoulder_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (113, 'KB Lateral Raise', 'Shoulders', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (114, 'KB Halo', 'Shoulders', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (115, 'KB Floor Press', 'Chest', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bench_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (116, 'KB Squeeze Press', 'Chest', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bench_Press/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (117, 'KB Row', 'Back', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Two-Dumbbell_Row/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (118, 'KB Renegade Row', 'Back', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Two-Dumbbell_Row/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (119, 'KB High Pull', 'Back', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Rear_Delt_Row/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (120, 'KB Clean', 'Back', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (121, 'KB Snatch', 'Back', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (122, 'KB Curl', 'Biceps', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bicep_Curl/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (123, 'KB Hammer Curl', 'Biceps', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hammer_Curls/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (124, 'KB Overhead Tricep Extension', 'Triceps', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_One-Arm_Triceps_Extension/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (125, 'KB Skull Crusher', 'Triceps', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/EZ-Bar_Skullcrusher/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (126, 'KB Turkish Get-Up', 'Core', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dead_Bug/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (127, 'KB Windmill', 'Core', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (128, 'KB Russian Twist', 'Core', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Russian_Twists/0.jpg');
INSERT INTO "exercises" ("id", "name", "muscle_group", "is_custom", "equipment", "gif_url") VALUES (129, 'KB Farmer''s Walk', 'Traps', 0, 'kettlebell', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shrug/0.jpg');

-- Tabelle: muscle_fatigue
DROP TABLE IF EXISTS muscle_fatigue;
CREATE TABLE muscle_fatigue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      muscle_group TEXT NOT NULL,
      fatigue_score REAL NOT NULL,
      last_trained_at TEXT NOT NULL,
      session_id INTEGER NOT NULL, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

-- Tabelle: notification_log
DROP TABLE IF EXISTS notification_log;
CREATE TABLE notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_type TEXT NOT NULL,
      sent_date TEXT NOT NULL,
      UNIQUE(notification_type, sent_date)
    );

-- Daten für: notification_log (1 Zeilen)
INSERT INTO "notification_log" ("id", "notification_type", "sent_date") VALUES (1, 'inactivity', '2026-04-12');

-- Tabelle: plan_exercises
DROP TABLE IF EXISTS plan_exercises;
CREATE TABLE plan_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      default_sets INTEGER DEFAULT 3,
      default_reps INTEGER DEFAULT 10,
      default_weight REAL DEFAULT 0, superset_group INTEGER,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

-- Tabelle: plans
DROP TABLE IF EXISTS plans;
CREATE TABLE plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    , user_id INTEGER REFERENCES users(id) ON DELETE CASCADE);

-- Daten für: plans (2 Zeilen)
INSERT INTO "plans" ("id", "name", "created_at", "user_id") VALUES (10, 'Test Plan', '2026-04-25 11:45:04', 3);
INSERT INTO "plans" ("id", "name", "created_at", "user_id") VALUES (11, 'E2E Test Plan', '2026-04-25 11:46:22', 3);

-- Tabelle: push_subscriptions
DROP TABLE IF EXISTS push_subscriptions;
CREATE TABLE push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      keys_p256dh TEXT NOT NULL,
      keys_auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

-- Tabelle: sessions
DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      finished_at TEXT,
      rpe INTEGER,
      notes TEXT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

-- Tabelle: sets
DROP TABLE IF EXISTS sets;
CREATE TABLE sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      set_number INTEGER NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      logged_at TEXT DEFAULT (datetime('now')), is_drop_set INTEGER DEFAULT 0, parent_set_id INTEGER REFERENCES sets(id) ON DELETE SET NULL, rir INTEGER, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

-- Tabelle: split_refresh_snooze
DROP TABLE IF EXISTS split_refresh_snooze;
CREATE TABLE split_refresh_snooze (
      device_id TEXT PRIMARY KEY,
      snoozed_until TEXT NOT NULL
    );

-- Tabelle: subscription_receipts
DROP TABLE IF EXISTS subscription_receipts;
CREATE TABLE subscription_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('apple', 'google')),
      original_transaction_id TEXT NOT NULL,
      product_id TEXT,
      expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'cancelled', 'refunded')),
      raw_response TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, provider, original_transaction_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

-- Tabelle: users
DROP TABLE IF EXISTS users;
CREATE TABLE "users" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          subscription_tier TEXT NOT NULL DEFAULT 'free',
          subscription_provider TEXT,
          subscription_expires_at TEXT,
          name TEXT,
          avatar_url TEXT,
          provider TEXT,
          provider_id TEXT
        );

-- Daten für: users (19 Zeilen)
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (1, 'deploytester', 'deploy@test.com', '$2b$10$wS5xQ.uiquKq7QEcG6JoYOCnnZkGepTBjPF1WGAVltYwMGGWf1XIi', '2026-03-06 19:19:48', 'free', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (2, 'user2', 'user2@test.com', '$2b$10$1cTmtqa8TUMlNUCIAq/AdOmKotdP1VE3g.AYPPufNmSqFoIREO86a', '2026-03-06 19:20:02', 'free', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (3, NULL, 'dev@local.test', NULL, '2026-04-25 11:40:30', 'free', NULL, NULL, 'Dev User', NULL, 'dev', 'local-dev-user');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (4, NULL, 'guest-test-device-12345@guest.local', NULL, '2026-04-25 11:49:29', 'free', NULL, NULL, 'Guest', NULL, 'guest', 'test-device-12345');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (5, NULL, 'guest-another-device-67890@guest.local', NULL, '2026-04-25 11:49:29', 'free', NULL, NULL, 'Guest', NULL, 'guest', 'another-device-67890');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (6, NULL, 'guest-c68725189090959057ca768b91c5b223@guest.local', NULL, '2026-04-25 11:52:14', 'free', NULL, NULL, 'Guest', NULL, 'guest', 'c68725189090959057ca768b91c5b223');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (7, NULL, 'guest-436426f73f8ef6fe269098c8de597e5a@guest.local', NULL, '2026-04-26 05:04:10', 'free', NULL, NULL, 'Guest', NULL, 'guest', '436426f73f8ef6fe269098c8de597e5a');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (8, NULL, 'guest-cf24c0e2257cd1d376a436ba504a59d5@guest.local', NULL, '2026-04-26 07:04:53', 'free', NULL, NULL, 'Guest', NULL, 'guest', 'cf24c0e2257cd1d376a436ba504a59d5');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (9, NULL, 'guest-7484d85acaf03df46aac8645ac213364@guest.local', NULL, '2026-04-26 10:46:34', 'free', NULL, NULL, 'Guest', NULL, 'guest', '7484d85acaf03df46aac8645ac213364');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (10, NULL, 'guest-7c846850a9f6fcfd1864dfeaaa9b3ae5@guest.local', NULL, '2026-04-26 11:18:58', 'free', NULL, NULL, 'Guest', NULL, 'guest', '7c846850a9f6fcfd1864dfeaaa9b3ae5');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (11, NULL, 'guest-f702fbfc8369e3faa11c2eb13dd9ec22@guest.local', NULL, '2026-04-28 10:03:31', 'free', NULL, NULL, 'Guest', NULL, 'guest', 'f702fbfc8369e3faa11c2eb13dd9ec22');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (12, NULL, 'guest-497779a0fe6259fd6f8c508616af4aa2@guest.local', NULL, '2026-04-28 17:29:19', 'free', NULL, NULL, 'Guest', NULL, 'guest', '497779a0fe6259fd6f8c508616af4aa2');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (13, NULL, 'guest-a9a163e910c4a8d19c2a7db77a1481ea@guest.local', NULL, '2026-04-28 18:04:35', 'free', NULL, NULL, 'Guest', NULL, 'guest', 'a9a163e910c4a8d19c2a7db77a1481ea');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (14, NULL, 'guest-1a9da41d33c0778e03fa75beacb4673a@guest.local', NULL, '2026-05-01 17:36:15', 'free', NULL, NULL, 'Guest', NULL, 'guest', '1a9da41d33c0778e03fa75beacb4673a');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (15, NULL, 'guest-f7852836bdddbc6743211bda5b32d7a6@guest.local', NULL, '2026-05-02 06:44:22', 'free', NULL, NULL, 'Guest', NULL, 'guest', 'f7852836bdddbc6743211bda5b32d7a6');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (16, NULL, 'guest-7c10f963fbe4d7b640b6a529e4fac67c@guest.local', NULL, '2026-05-02 12:17:50', 'free', NULL, NULL, 'Guest', NULL, 'guest', '7c10f963fbe4d7b640b6a529e4fac67c');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (17, NULL, 'guest-a496f1c108dbd5866ea5cf203bf2f819@guest.local', NULL, '2026-05-02 12:38:40', 'free', NULL, NULL, 'Guest', NULL, 'guest', 'a496f1c108dbd5866ea5cf203bf2f819');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (18, NULL, 'guest-87a957d3ff21cae830e06e39d30f59b5@guest.local', NULL, '2026-05-02 13:08:38', 'free', NULL, NULL, 'Guest', NULL, 'guest', '87a957d3ff21cae830e06e39d30f59b5');
INSERT INTO "users" ("id", "username", "email", "password_hash", "created_at", "subscription_tier", "subscription_provider", "subscription_expires_at", "name", "avatar_url", "provider", "provider_id") VALUES (19, NULL, 'guest-3c003ced4fccf58950ac347803d70103@guest.local', NULL, '2026-05-03 06:22:13', 'free', NULL, NULL, 'Guest', NULL, 'guest', '3c003ced4fccf58950ac347803d70103');

COMMIT;
PRAGMA foreign_keys = ON;