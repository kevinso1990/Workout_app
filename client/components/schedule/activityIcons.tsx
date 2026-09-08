import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { CommitmentSport } from "@shared/weeklySchedule";

/**
 * One source of truth for how an activity is drawn.
 *
 * Feather — used everywhere else in the app — has no dumbbell, no ball and no
 * runner, so these previously fell back to stand-ins that actively misread:
 * a crosshair for basketball, a wind glyph for running, a heart-rate trace for
 * strength training. MaterialCommunityIcons ships the real thing.
 *
 * Kept in one module rather than inlined per screen because the same activity
 * appears in the commitment editor, the week strip and the calendar, and three
 * private copies of this map is exactly how they drift apart.
 */
export type ActivityIconName = React.ComponentProps<
  typeof MaterialCommunityIcons
>["name"];

export const SPORT_ICON: Record<CommitmentSport, ActivityIconName> = {
  running: "run",
  football: "soccer",
  basketball: "basketball",
  tennis: "tennis",
  cycling: "bike",
  swimming: "swim",
  boxing: "boxing-glove",
  custom: "star-four-points-outline",
};

/** Strength training — the gym session itself, not a sport. */
export const STRENGTH_ICON: ActivityIconName = "dumbbell";

export function ActivityIcon({
  sport,
  size = 16,
  color,
}: {
  /** Omit for a strength session. */
  sport?: CommitmentSport;
  size?: number;
  color: string;
}) {
  return (
    <MaterialCommunityIcons
      name={sport ? SPORT_ICON[sport] : STRENGTH_ICON}
      size={size}
      color={color}
    />
  );
}
