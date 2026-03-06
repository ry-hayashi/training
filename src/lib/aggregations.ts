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

/** Get date string "YYYY-MM-DD" from ISO */
function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Get Sunday-based week start date string "YYYY-MM-DD" */
function getSundayWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  return getDateKey(sunday.toISOString());
}

/** Get month string "YYYY-MM" */
function getMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Common aggregation logic */
function aggregateByKey(
  logs: WorkoutLog[],
  sets: WorkoutSet[],
  exercises: Exercise[],
  bodyParts: BodyPart[],
  keyFn: (iso: string) => string
): PeriodVolume[] {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  const periodMap = new Map<string, Map<string, number>>();

  for (const log of logs) {
    const key = keyFn(log.performedAtISO);
    const ex = exerciseMap.get(log.exerciseId);
    if (!ex) continue;

    const logSets = sets.filter((s) => s.logId === log.id);
    const vol = logSets.reduce((sum, s) => sum + s.weight * s.reps, 0);

    if (!periodMap.has(key)) periodMap.set(key, new Map());
    const bpMap = periodMap.get(key)!;
    bpMap.set(ex.bodyPartId, (bpMap.get(ex.bodyPartId) || 0) + vol);
  }

  const keys = Array.from(periodMap.keys()).sort();
  return keys.map((key) => {
    const bpMap = periodMap.get(key)!;
    const bodyPartVolumes: BodyPartVolume[] = bodyParts.map((bp) => ({
      bodyPartId: bp.id,
      bodyPartName: bp.name,
      volume: bpMap.get(bp.id) || 0,
    }));
    return { periodLabel: key, bodyParts: bodyPartVolumes };
  });
}

/** Compute body part volumes grouped by day */
export function bodyPartVolumeByDay(
  logs: WorkoutLog[],
  sets: WorkoutSet[],
  exercises: Exercise[],
  bodyParts: BodyPart[]
): PeriodVolume[] {
  return aggregateByKey(logs, sets, exercises, bodyParts, getDateKey);
}

/** Compute body part volumes grouped by Sunday-based week */
export function bodyPartVolumeByWeek(
  logs: WorkoutLog[],
  sets: WorkoutSet[],
  exercises: Exercise[],
  bodyParts: BodyPart[]
): PeriodVolume[] {
  return aggregateByKey(logs, sets, exercises, bodyParts, getSundayWeekKey);
}

/** Compute body part volumes grouped by month */
export function bodyPartVolumeByMonth(
  logs: WorkoutLog[],
  sets: WorkoutSet[],
  exercises: Exercise[],
  bodyParts: BodyPart[]
): PeriodVolume[] {
  return aggregateByKey(logs, sets, exercises, bodyParts, getMonth);
}

/** Format period label for display on chart axis */
export function formatPeriodLabel(label: string, mode: 'day' | 'week' | 'month'): string {
  if (mode === 'day') {
    // "YYYY-MM-DD" → "M/D"
    const [, m, d] = label.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  }
  if (mode === 'week') {
    // Sunday date "YYYY-MM-DD" → "M/D〜"
    const [, m, d] = label.split('-');
    return `${parseInt(m)}/${parseInt(d)}〜`;
  }
  if (mode === 'month') {
    // "YYYY-MM" → "YYYY/MM"
    const [y, m] = label.split('-');
    return `${y}/${m}`;
  }
  return label;
}

/** Format volume for display (always kg with comma) */
export function formatVolume(v: number): string {
  return `${v.toLocaleString('ja-JP')}kg`;
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
