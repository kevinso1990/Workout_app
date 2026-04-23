/*
  N8N CLAUDE SYSTEM PROMPT:
  You are a workout plan parser. The user will send you one or more images of a workout plan.
  The plan may be handwritten, a screenshot, a photo of a printed page, or any other format.

  Extract ALL exercises, sets, reps, weights, and day/session structure from the images.
  If something is unclear or partially visible, make your best inference.
  If days are not labeled, name them "Day 1", "Day 2", etc.
  If sets/reps are not specified, use null.

  IMPORTANT: Respond ONLY with valid JSON. No explanation. No markdown. Just the JSON object.

  {
    "planName": "inferred name or 'My Workout Plan'",
    "days": [
      {
        "dayName": "string",
        "exercises": [
          {
            "name": "string",
            "sets": number,
            "reps": number | null,
            "weight": number | null,
            "notes": "string | null"
          }
        ]
      }
    ]
  }
*/

import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveWorkoutPlan } from "@/lib/storage";
import type { WorkoutPlan as StorageWorkoutPlan } from "@/lib/storage";

const BACKEND_URL = "https://workout-builder.replit.app/api/import-workout";
const IMPORTED_PLANS_KEY = "importedPlans";

export interface ImportedExercise {
  name: string;
  sets: number;
  reps: number | null;
  weight: number | null;
  notes: string | null;
}

export interface ImportedWorkoutDay {
  dayName: string;
  exercises: ImportedExercise[];
}

export interface ImportedWorkoutPlan {
  planName: string;
  days: ImportedWorkoutDay[];
}

export interface PickedImage {
  uri: string;
  base64: string;
}

export function useWorkoutImport() {
  async function pickImage(source: "camera" | "library"): Promise<PickedImage | null> {
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return null;
      const result = await ImagePicker.launchCameraAsync({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mediaTypes: ["images"] as any,
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return null;
      const uri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { uri, base64 };
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return null;
      const result = await ImagePicker.launchImageLibraryAsync({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mediaTypes: ["images"] as any,
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return null;
      const uri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { uri, base64 };
    }
  }

  async function analyzeImages(base64: string): Promise<ImportedWorkoutPlan> {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Import failed');
    }

    const plan = await response.json();
    return plan as ImportedWorkoutPlan;
  }

  async function saveImportedPlan(plan: ImportedWorkoutPlan): Promise<string> {
    const existing = await getImportedPlans();
    await AsyncStorage.setItem(IMPORTED_PLANS_KEY, JSON.stringify([plan, ...existing]));

    const planId = Date.now().toString();
    const storagePlan: StorageWorkoutPlan = {
      id: planId,
      name: plan.planName,
      daysPerWeek: plan.days.length,
      days: plan.days.map((day) => ({
        dayName: day.dayName,
        exercises: day.exercises.map((ex, idx) => ({
          id: `imported-${planId}-${idx}`,
          name: ex.name,
          muscleGroup: "",
          sets: ex.sets,
          reps: ex.reps !== null ? String(ex.reps) : "",
        })),
      })),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
    await saveWorkoutPlan(storagePlan);
    return planId;
  }

  async function getImportedPlans(): Promise<ImportedWorkoutPlan[]> {
    try {
      const value = await AsyncStorage.getItem(IMPORTED_PLANS_KEY);
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  }

  return { pickImage, analyzeImages, saveImportedPlan, getImportedPlans };
}
