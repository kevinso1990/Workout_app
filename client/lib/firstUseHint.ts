import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * One-time explanatory hints for icon-only controls that have no visible
 * label (swap, reorder, PR badge). Shown once per install via the existing
 * toast system, then never again — avoids a separate anchored-tooltip UI
 * (positioning/measure logic) for what's fundamentally a single sentence.
 */
const SEEN_KEY_PREFIX = "firstUseHint.seen.";

const seenCache = new Set<string>();

/** True the first time this hint id is checked; false on every call after. */
export async function consumeFirstUseHint(id: string): Promise<boolean> {
  if (seenCache.has(id)) return false;
  const key = SEEN_KEY_PREFIX + id;
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored === "true") {
      seenCache.add(id);
      return false;
    }
    seenCache.add(id);
    await AsyncStorage.setItem(key, "true");
    return true;
  } catch {
    // Storage unavailable — default to not showing rather than risking a
    // hint on every launch.
    return false;
  }
}
