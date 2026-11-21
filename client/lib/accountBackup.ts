/**
 * What happens to this phone's data after signing in with Apple. Pure, so it
 * can be tested without the native modules.
 */
export type BackupCounts = { historyCount: number; planCount: number };

/**
 * - "upload":  the account has no backup yet → this phone's data becomes it.
 * - "restore": this phone is empty (e.g. a new iPhone) → take the backup.
 * - "ask":     both hold data → the user picks which side stays.
 */
export function afterSignInAction(
  local: BackupCounts,
  cloud: BackupCounts | null,
): "upload" | "restore" | "ask" {
  const has = (c: BackupCounts | null) => !!c && c.historyCount + c.planCount > 0;
  if (!has(cloud)) return "upload";
  // A phone with only plans (template from onboarding) but no workouts counts
  // as empty when the backup has workouts: nothing logged would be lost.
  if (!has(local) || (local.historyCount === 0 && cloud!.historyCount > 0)) return "restore";
  return "ask";
}
