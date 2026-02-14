// ===== Data Models =====

export interface BodyPart {
  id: string;
  name: string;
}

export interface Exercise {
  id: string;
  name: string;
  bodyPartId: string;
}

export interface WorkoutLog {
  id: string;
  exerciseId: string;
  performedAtISO: string; // ISO datetime
}

export interface WorkoutSet {
  id: string;
  logId: string;
  setIndex: number; // 1..5
  weight: number;
  reps: number;
}

export interface Template {
  slot: number; // 1..6 fixed
  name: string;
  exerciseIds: string[];
}

export interface Meta {
  key: string;
  value: unknown;
}

// ===== Computed / View types =====

export interface SetWithVolume extends WorkoutSet {
  volume: number;
}

export interface LogWithSets extends WorkoutLog {
  sets: SetWithVolume[];
  totalVolume: number;
}

export interface ExerciseWithDetails extends Exercise {
  bodyPartName: string;
  maxWeight: number;
  recentLogs: LogWithSets[];
}

export interface BodyPartVolume {
  bodyPartId: string;
  bodyPartName: string;
  volume: number;
}

export interface PeriodVolume {
  periodLabel: string; // e.g. "2025-W03" or "2025-01"
  bodyParts: BodyPartVolume[];
}

// ===== Backup =====

export interface BackupData {
  schemaVersion: number;
  exportedAt: string;
  data: {
    bodyParts: BodyPart[];
    exercises: Exercise[];
    workoutLogs: WorkoutLog[];
    sets: WorkoutSet[];
    templates: Template[];
    meta: Meta[];
  };
}

export interface ImportResult {
  added: Record<string, number>;
  skipped: Record<string, number>;
}
