import type {
  WorkoutSet,
  WorkoutLog,
  Exercise,
  BodyPart,
  SetWithVolume,
  LogWithSets,
  BodyPartVolume,
  PeriodVolume,
} from '@/types';

/** Compute volume for a single set */
export function setVolume(s: WorkoutSet): number {
  return s.weight * s.reps;
}

/** Attach volume to sets and compute log total */
export function enrichLog(log: WorkoutLog, sets: WorkoutSet[]): LogWithSets {
  const logSets = sets
    .filter((s) => s.logId === log.id)
    .sort((a, b) => a.setIndex - b.setIndex);

  const setsWithVolume: SetWithVolume[] = logSets.map((s) => ({
    ...s,
    volume: setVolume(s),
  }));

  return {
    ...log,
    sets: setsWithVolume,
    totalVolume: setsWithVolume.reduce((sum, s) => sum + s.volume, 0),
  };
}

/** Max weight across all sets for an exercise */
export function maxWeight(sets: WorkoutSet[]): number {
  if (sets.length === 0) return 0;
  return Math.max(...sets.map((s) => s.weight));
}

/** Recent N logs (sorted desc by performedAtISO) */
export function recentLogs(
  logs: WorkoutLog[],
  allSets: WorkoutSet[],
  n: number = 3
): LogWithSets[] {
  const sorted = [...logs].sort(
    (a, b) => b.performedAtISO.localeCompare(a.performedAtISO)
  );
  return sorted.slice(0, n).map((log) => enrichLog(log, allSets));
}

/** Get ISO week string "YYYY-Www" */
function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const dayOfYear = Math.floor(
    (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000
  );
  const weekNum = Math.ceil((dayOfYear + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Get month string "YYYY-MM" */
function getMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Compute body part volumes grouped by week */
export function bodyPartVolumeByWeek(
  logs: WorkoutLog[],
  sets: WorkoutSet[],
  exercises: Exercise[],
  bodyParts: BodyPart[]
): PeriodVolume[] {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const bodyPartMap = new Map(bodyParts.map((bp) => [bp.id, bp]));

  // Group logs by week
  const weekMap = new Map<string, Map<string, number>>();

  for (const log of logs) {
    const week = getISOWeek(log.performedAtISO);
    const ex = exerciseMap.get(log.exerciseId);
    if (!ex) continue;

    const logSets = sets.filter((s) => s.logId === log.id);
    const vol = logSets.reduce((sum, s) => sum + s.weight * s.reps, 0);

    if (!weekMap.has(week)) weekMap.set(week, new Map());
    const bpMap = weekMap.get(week)!;
    bpMap.set(ex.bodyPartId, (bpMap.get(ex.bodyPartId) || 0) + vol);
  }

  // Convert to array, sorted
  const weeks = Array.from(weekMap.keys()).sort();
  return weeks.map((week) => {
    const bpMap = weekMap.get(week)!;
    const bodyPartVolumes: BodyPartVolume[] = bodyParts.map((bp) => ({
      bodyPartId: bp.id,
      bodyPartName: bp.name,
      volume: bpMap.get(bp.id) || 0,
    }));
    return { periodLabel: week, bodyParts: bodyPartVolumes };
  });
}

/** Same as above but by month */
export function bodyPartVolumeByMonth(
  logs: WorkoutLog[],
  sets: WorkoutSet[],
  exercises: Exercise[],
  bodyParts: BodyPart[]
): PeriodVolume[] {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  const monthMap = new Map<string, Map<string, number>>();

  for (const log of logs) {
    const month = getMonth(log.performedAtISO);
    const ex = exerciseMap.get(log.exerciseId);
    if (!ex) continue;

    const logSets = sets.filter((s) => s.logId === log.id);
    const vol = logSets.reduce((sum, s) => sum + s.weight * s.reps, 0);

    if (!monthMap.has(month)) monthMap.set(month, new Map());
    const bpMap = monthMap.get(month)!;
    bpMap.set(ex.bodyPartId, (bpMap.get(ex.bodyPartId) || 0) + vol);
  }

  const months = Array.from(monthMap.keys()).sort();
  return months.map((month) => {
    const bpMap = monthMap.get(month)!;
    const bodyPartVolumes: BodyPartVolume[] = bodyParts.map((bp) => ({
      bodyPartId: bp.id,
      bodyPartName: bp.name,
      volume: bpMap.get(bp.id) || 0,
    }));
    return { periodLabel: month, bodyParts: bodyPartVolumes };
  });
}

/** Format date string for display */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Days since last backup */
export function daysSinceBackup(lastBackupISO: string | null | undefined): number | null {
  if (!lastBackupISO) return null;
  const diff = Date.now() - new Date(lastBackupISO as string).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
