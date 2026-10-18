type TFunction = (key: string, opts?: Record<string, unknown>) => string;

const DAY_NAME_KEYS: Record<string, string> = {
  Push: "push",
  Pull: "pull",
  Legs: "legs",
  Upper: "upper",
  Lower: "lower",
  "Full Body": "fullBody",
  Chest: "chest",
  Back: "back",
  Shoulders: "shoulders",
  Arms: "arms",
};

/**
 * Display label for a plan day. Template days are stored under English split
 * names ("Full Body A", "Push", "Upper B") because `dayName` doubles as an
 * exercise-selection key elsewhere — only the rendered label is translated.
 * A single trailing variant letter is kept. Anything else (a user's own day
 * name, "Tag 1", an imported plan's day) is returned untouched.
 */
export function translateDayName(t: TFunction, dayName: string): string {
  const match = dayName.trim().match(/^(.+?)(?: ([A-Z]))?$/);
  if (!match) return dayName;
  const [, base, variant] = match;
  const key = DAY_NAME_KEYS[base];
  if (!key) return dayName;
  const label = t(`onboarding.dayNames.${key}`, { defaultValue: base });
  return variant ? `${label} ${variant}` : label;
}
