import db from "../db";

export function upsertVote(deviceId: string, exerciseId: number, vote: number): void {
  if (vote === 0) {
    db.prepare("DELETE FROM exercise_votes WHERE device_id = ? AND exercise_id = ?").run(deviceId, exerciseId);
  } else {
    db.prepare(
      `INSERT INTO exercise_votes (device_id, exercise_id, vote)
       VALUES (?, ?, ?)
       ON CONFLICT(device_id, exercise_id) DO UPDATE SET vote = excluded.vote`,
    ).run(deviceId, exerciseId, vote);
  }
}

export function getVote(deviceId: string, exerciseId: number): number {
  const row = db
    .prepare("SELECT vote FROM exercise_votes WHERE device_id = ? AND exercise_id = ?")
    .get(deviceId, exerciseId) as { vote: number } | undefined;
  return row?.vote ?? 0;
}

export function getVotesForDevice(deviceId: string): Record<number, number> {
  const rows = db
    .prepare("SELECT exercise_id, vote FROM exercise_votes WHERE device_id = ?")
    .all(deviceId) as { exercise_id: number; vote: number }[];
  return Object.fromEntries(rows.map((r) => [r.exercise_id, r.vote]));
}

export function getDislikedExerciseIds(deviceId: string): number[] {
  return (
    db
      .prepare("SELECT exercise_id FROM exercise_votes WHERE device_id = ? AND vote = -1")
      .all(deviceId) as { exercise_id: number }[]
  ).map((r) => r.exercise_id);
}
