import type { Equipment } from "@/lib/storage";

/** Maps native onboarding equipment ids to POST /api/plans/auto-generate values. */
export const NATIVE_EQUIPMENT_TO_API: Record<Equipment, string> = {
  full_gym: "barbell",
  dumbbells_only: "dumbbells_only",
  home_minimal: "home_minimal",
  bodyweight: "bodyweight",
  kettlebell: "kettlebell",
};

export function mapNativeEquipmentToApi(equipment: Equipment | null): string {
  if (!equipment) return "barbell";
  return NATIVE_EQUIPMENT_TO_API[equipment] ?? "barbell";
}
