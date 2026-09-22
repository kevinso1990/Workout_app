import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

/**
 * Per-exercise images the athlete supplies themselves.
 *
 * The catalog covers most movements, but anything added by hand — and the
 * modern accessory work free-exercise-db never had — has no demo image at all,
 * which leaves a placeholder exactly where you need to see the movement.
 *
 * DELIBERATELY DEVICE-LOCAL. These images are typically screenshots from
 * social media or a coach's PDF, i.e. someone else's work. Keeping a copy on
 * your own device as a personal reference is like saving a photo; pushing it to
 * our server, syncing it across devices or serving it to anyone else would be
 * redistributing material we have no licence to. So this never touches the API
 * and is not part of cloud sync — it is a local override on top of the catalog
 * image lookup, nothing more.
 *
 * The picked file is COPIED into app storage rather than referenced in place:
 * a URI handed over by the image picker points into a cache the OS is free to
 * purge, so a referenced image would silently vanish later.
 */

const INDEX_KEY = "customExerciseImages.v1";
/** Document storage, not cache: the OS may purge the cache directory. */
const DIR_NAME = "exercise-images";

/** exercise name (as stored on the plan) → local file URI */
type ImageIndex = Record<string, string>;

let cache: ImageIndex | null = null;

async function readIndex(): Promise<ImageIndex> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    cache = raw ? (JSON.parse(raw) as ImageIndex) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function writeIndex(next: ImageIndex): Promise<void> {
  cache = next;
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
  } catch {
    // A failed write leaves the in-memory cache correct for this session; the
    // image itself is already on disk, so nothing is lost beyond persistence.
  }
}

function imageDir(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Loads the whole index once so screens can look up synchronously. */
export async function loadCustomExerciseImages(): Promise<ImageIndex> {
  return readIndex();
}

/** Synchronous read for render paths; returns null until the index is loaded. */
export function getCustomExerciseImageSync(exerciseName: string): string | null {
  return cache?.[exerciseName] ?? null;
}

export async function getCustomExerciseImage(
  exerciseName: string,
): Promise<string | null> {
  const index = await readIndex();
  return index[exerciseName] ?? null;
}

/**
 * Copies `sourceUri` into app storage and records it for this exercise.
 * Returns the stored URI, or null if the copy failed.
 */
export async function setCustomExerciseImage(
  exerciseName: string,
  sourceUri: string,
): Promise<string | null> {
  try {
    const dir = imageDir();
    const ext = (sourceUri.split(".").pop() ?? "jpg").split("?")[0].slice(0, 5);
    // Timestamped name so a re-pick writes a new file and the old one can be
    // removed afterwards, rather than fighting over the same path.
    const safe = exerciseName.replace(/[^a-z0-9]/gi, "_").slice(0, 60);
    const target = new File(dir, `${safe}_${Date.now()}.${ext || "jpg"}`);

    const index = await readIndex();
    const previous = index[exerciseName];

    new File(sourceUri).copy(target);
    await writeIndex({ ...index, [exerciseName]: target.uri });

    if (previous) {
      // Best-effort cleanup of the replaced file.
      try {
        const old = new File(previous);
        if (old.exists) old.delete();
      } catch {
        /* the index no longer points at it either way */
      }
    }
    return target.uri;
  } catch {
    return null;
  }
}

/** Removes the custom image, falling the exercise back to the catalog image. */
export async function removeCustomExerciseImage(
  exerciseName: string,
): Promise<void> {
  const index = await readIndex();
  const uri = index[exerciseName];
  if (!uri) return;
  const next = { ...index };
  delete next[exerciseName];
  await writeIndex(next);
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* already gone */
  }
}
