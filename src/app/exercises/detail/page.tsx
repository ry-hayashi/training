'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getById, getLogsByExercise, getSetsByLog, put, getAll } from '@/lib/db';
import { maxWeight, recentLogs, formatDate } from '@/lib/aggregations';
import type { Exercise, BodyPart, WorkoutLog, WorkoutSet, LogWithSets } from '@/types';
import { v4 } from 'uuid';

interface SetInput {
  weight: string;
  reps: string;
}

function ExerciseDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const exerciseId = searchParams.get('id') || '';

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [allSets, setAllSets] = useState<WorkoutSet[]>([]);
  const [recent, setRecent] = useState<LogWithSets[]>([]);
  const [max, setMax] = useState(0);
  const [loading, setLoading] = useState(true);

  // New log form
  const [sets, setSets] = useState<SetInput[]>([
    { weight: '', reps: '' },
    { weight: '', reps: '' },
    { weight: '', reps: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!exerciseId) return;
    const ex = await getById('exercises', exerciseId);
    if (!ex) { router.push('/'); return; }
    setExercise(ex);

    const bp = await getById('bodyParts', ex.bodyPartId);
    setBodyPart(bp || null);

    const logs = await getLogsByExercise(exerciseId);
    const setsArr: WorkoutSet[] = [];
    for (const log of logs) {
      const s = await getSetsByLog(log.id);
      setsArr.push(...s);
    }
    setAllSets(setsArr);
    setMax(maxWeight(setsArr));
    setRecent(recentLogs(logs, setsArr, 3));
    setLoading(false);
  };

  useEffect(() => { load(); }, [exerciseId]);

  // Realtime volume computation
  const setVolumes = useMemo(
    () =>
      sets.map((s) => {
        const w = parseFloat(s.weight) || 0;
        const r = parseInt(s.reps) || 0;
        return w * r;
      }),
    [sets]
  );
  const totalVolume = useMemo(() => setVolumes.reduce((a, b) => a + b, 0), [setVolumes]);

  const updateSet = (i: number, field: keyof SetInput, val: string) => {
    const next = [...sets];
    next[i] = { ...next[i], [field]: val };
    setSets(next);
  };

  const addSetRow = () => {
    if (sets.length < 5) setSets([...sets, { weight: '', reps: '' }]);
  };

  const removeSetRow = (i: number) => {
    if (sets.length > 1) setSets(sets.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    const validSets = sets.filter(
      (s) => (parseFloat(s.weight) || 0) > 0 && (parseInt(s.reps) || 0) > 0
    );
    if (validSets.length === 0) return;

    setSaving(true);
    const logId = v4();
    const log: WorkoutLog = {
      id: logId,
      exerciseId,
      performedAtISO: new Date().toISOString(),
    };
    await put('workoutLogs', log);

    for (let i = 0; i < validSets.length; i++) {
      const ws: WorkoutSet = {
        id: v4(),
        logId,
        setIndex: i + 1,
        weight: parseFloat(validSets[i].weight),
        reps: parseInt(validSets[i].reps),
      };
      await put('sets', ws);
    }

    setSets([
      { weight: '', reps: '' },
      { weight: '', reps: '' },
      { weight: '', reps: '' },
    ]);
    setSaving(false);
    await load();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-60 text-textMuted">読み込み中...</div>;
  }

  if (!exercise) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/')}
          className="text-textMuted hover:text-textSecondary text-sm mb-2 inline-block"
        >
          ← 種目一覧
        </button>
        <h1 className="text-2xl font-bold tracking-tight">{exercise.name}</h1>
        {bodyPart && (
          <span className="text-xs font-medium text-accent bg-accent/10 px-2.5 py-1 rounded-full mt-1 inline-block">
            {bodyPart.name}
          </span>
        )}
      </div>

      {/* Max weight card */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <div className="text-xs text-textMuted uppercase tracking-widest mb-1">過去Max重量</div>
        <div className="text-4xl font-bold font-mono text-accent">
          {max > 0 ? `${max} kg` : '—'}
        </div>
      </div>

      {/* New log form */}
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-sm text-textSecondary">新規ログ</h2>

        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-textMuted w-6 text-right font-mono">{i + 1}</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="kg"
              value={s.weight}
              onChange={(e) => updateSet(i, 'weight', e.target.value)}
              className="flex-1 bg-bg border border-border rounded-xl px-3 py-3 text-center font-mono text-lg focus:outline-none focus:border-accent"
            />
            <span className="text-textMuted">×</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="回"
              value={s.reps}
              onChange={(e) => updateSet(i, 'reps', e.target.value)}
              className="flex-1 bg-bg border border-border rounded-xl px-3 py-3 text-center font-mono text-lg focus:outline-none focus:border-accent"
            />
            <div className="w-20 text-right text-sm font-mono text-textSecondary">
              {setVolumes[i] > 0 ? setVolumes[i].toLocaleString() : '—'}
            </div>
            {sets.length > 1 && (
              <button
                onClick={() => removeSetRow(i)}
                className="text-textMuted hover:text-danger text-lg w-6"
              >
                ×
              </button>
            )}
          </div>
        ))}

        <div className="flex items-center justify-between pt-1">
          {sets.length < 5 && (
            <button
              onClick={addSetRow}
              className="text-accent text-sm font-medium hover:text-accentHover"
            >
              ＋ セット追加
            </button>
          )}
          <div className="text-right flex-1">
            <span className="text-xs text-textMuted">総Volume: </span>
            <span className="font-mono font-bold text-lg">
              {totalVolume > 0 ? totalVolume.toLocaleString() : '—'}
            </span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || totalVolume === 0}
          className="w-full bg-accent hover:bg-accentHover disabled:opacity-40 text-white py-3.5 rounded-xl font-bold text-base transition-colors"
        >
          {saving ? '保存中...' : '記録する'}
        </button>
      </div>

      {/* Recent 3 logs */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm text-textSecondary">直近3回</h2>
        {recent.length === 0 ? (
          <div className="text-textMuted text-sm py-4 text-center">記録なし</div>
        ) : (
          recent.map((log) => (
            <div
              key={log.id}
              className="bg-surface border border-border rounded-xl p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-textMuted">{formatDate(log.performedAtISO)}</span>
                <span className="font-mono font-bold text-sm">
                  Vol: {log.totalVolume.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {log.sets.map((s) => (
                  <span
                    key={s.id}
                    className="bg-bg rounded-lg px-2.5 py-1 text-xs font-mono"
                  >
                    {s.weight}kg × {s.reps}回
                    <span className="text-textMuted ml-1">({s.volume})</span>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ExerciseDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-60 text-textMuted">読み込み中...</div>}>
      <ExerciseDetailContent />
    </Suspense>
  );
}
