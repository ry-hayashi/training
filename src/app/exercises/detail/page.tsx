'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getById, getLogsByExercise, getSetsByLog, put, deleteRecord, getAll } from '@/lib/db';
import { maxWeight, recentLogs, enrichLog } from '@/lib/aggregations';
import type { Exercise, BodyPart, WorkoutLog, WorkoutSet, LogWithSets } from '@/types';
import { v4 } from 'uuid';

interface SetInput {
  weight: string;
  reps: string;
}

function formatDatetime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Edit modal ───────────────────────────────────────────────
interface EditModalProps {
  log: LogWithSets;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ log, onClose, onSaved }: EditModalProps) {
  const [inputs, setInputs] = useState<SetInput[]>(
    log.sets.map((s) => ({ weight: String(s.weight), reps: String(s.reps) }))
  );
  const [saving, setSaving] = useState(false);

  const update = (i: number, field: keyof SetInput, val: string) => {
    const next = [...inputs];
    next[i] = { ...next[i], [field]: val };
    setInputs(next);
  };

  const addRow = () => {
    if (inputs.length < 5) setInputs([...inputs, { weight: '', reps: '' }]);
  };

  const removeRow = (i: number) => {
    if (inputs.length > 1) setInputs(inputs.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    const valid = inputs.filter(
      (s) => (parseFloat(s.weight) || 0) > 0 && (parseInt(s.reps) || 0) > 0
    );
    if (valid.length === 0) return;
    setSaving(true);

    // Delete old sets
    for (const s of log.sets) {
      await deleteRecord('sets', s.id);
    }
    // Write new sets
    for (let i = 0; i < valid.length; i++) {
      await put('sets', {
        id: v4(),
        logId: log.id,
        setIndex: i + 1,
        weight: parseFloat(valid[i].weight),
        reps: parseInt(valid[i].reps),
      });
    }
    setSaving(false);
    onSaved();
  };

  const volumes = inputs.map((s) => (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0));
  const total = volumes.reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border-t border-border rounded-t-2xl p-5 space-y-4 slide-up">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">記録を編集</h3>
          <button onClick={onClose} className="text-textMuted hover:text-textSecondary text-xl">✕</button>
        </div>
        <div className="text-xs text-textMuted font-mono">{formatDatetime(log.performedAtISO)}</div>

        <div className="flex items-center gap-2 text-[10px] text-textMuted px-1">
          <span className="w-5" />
          <span className="flex-1 text-center">kg</span>
          <span className="w-4" />
          <span className="flex-1 text-center">回</span>
          <span className="w-16 text-right">Vol</span>
          <span className="w-5" />
        </div>

        {inputs.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-textMuted w-5 text-right font-mono shrink-0">{i + 1}</span>
            <input
              type="number" inputMode="decimal" placeholder="0" value={s.weight}
              onChange={(e) => update(i, 'weight', e.target.value)}
              className="flex-1 min-w-0 bg-bg border border-border rounded-xl px-2 py-3 text-center font-mono text-base focus:outline-none focus:border-accent"
            />
            <span className="text-textMuted shrink-0">×</span>
            <input
              type="number" inputMode="numeric" placeholder="0" value={s.reps}
              onChange={(e) => update(i, 'reps', e.target.value)}
              className="flex-1 min-w-0 bg-bg border border-border rounded-xl px-2 py-3 text-center font-mono text-base focus:outline-none focus:border-accent"
            />
            <span className="w-16 shrink-0 text-right text-sm font-mono text-textSecondary">
              {volumes[i] > 0 ? volumes[i].toLocaleString() : '—'}
            </span>
            <span className="w-5 shrink-0">
              {inputs.length > 1 && (
                <button onClick={() => removeRow(i)} className="text-textMuted hover:text-danger text-base">×</button>
              )}
            </span>
          </div>
        ))}

        <div className="flex items-center justify-between">
          {inputs.length < 5 && (
            <button onClick={addRow} className="text-accent text-sm font-medium hover:text-accentHover">＋ セット追加</button>
          )}
          <div className="text-right flex-1 text-sm font-mono text-textSecondary">
            合計: <span className="font-bold text-textPrimary">{total > 0 ? total.toLocaleString() : '—'}</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || total === 0}
          className="w-full bg-accent hover:bg-accentHover disabled:opacity-40 text-white py-3.5 rounded-xl font-bold transition-colors"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
function ExerciseDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const exerciseId = searchParams.get('id') || '';
  // テンプレートフロー用パラメータ
  const templateSlot = searchParams.get('tpl');      // テンプレスロット番号
  const templateIds = searchParams.get('ids');        // カンマ区切り種目IDリスト
  const currentIndex = parseInt(searchParams.get('idx') || '0');

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [allSets, setAllSets] = useState<WorkoutSet[]>([]);
  const [allLogs, setAllLogs] = useState<LogWithSets[]>([]);
  const [max, setMax] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // New log
  const [sets, setSets] = useState<SetInput[]>([
    { weight: '', reps: '' },
    { weight: '', reps: '' },
    { weight: '', reps: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [savedThisSession, setSavedThisSession] = useState(false);

  // Edit / delete
  const [editingLog, setEditingLog] = useState<LogWithSets | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  const exerciseIds = templateIds ? templateIds.split(',') : [];
  const isTemplateFlow = exerciseIds.length > 0;
  const isLastExercise = isTemplateFlow && currentIndex >= exerciseIds.length - 1;

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

    const sorted = [...logs].sort((a, b) => b.performedAtISO.localeCompare(a.performedAtISO));
    setAllLogs(sorted.map((log) => enrichLog(log, setsArr)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [exerciseId]);

  const setVolumes = useMemo(
    () => sets.map((s) => (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0)),
    [sets]
  );
  const totalVolume = useMemo(() => setVolumes.reduce((a, b) => a + b, 0), [setVolumes]);

  const updateSet = (i: number, field: keyof SetInput, val: string) => {
    const next = [...sets];
    next[i] = { ...next[i], [field]: val };
    setSets(next);
  };

  const handleSave = async () => {
    const validSets = sets.filter(
      (s) => (parseFloat(s.weight) || 0) > 0 && (parseInt(s.reps) || 0) > 0
    );
    if (validSets.length === 0) return;
    setSaving(true);

    const logId = v4();
    await put('workoutLogs', { id: logId, exerciseId, performedAtISO: new Date().toISOString() });
    for (let i = 0; i < validSets.length; i++) {
      await put('sets', {
        id: v4(), logId, setIndex: i + 1,
        weight: parseFloat(validSets[i].weight),
        reps: parseInt(validSets[i].reps),
      });
    }

    setSets([{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }]);
    setSaving(false);
    setSavedThisSession(true);
    await load();
  };

  const handleDelete = async (logId: string) => {
    // Delete sets first, then log
    const setsToDelete = allSets.filter(() => true); // will re-fetch
    const logSets = await getSetsByLog(logId);
    for (const s of logSets) await deleteRecord('sets', s.id);
    await deleteRecord('workoutLogs', logId);
    setDeletingLogId(null);
    await load();
  };

  const goNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < exerciseIds.length) {
      const nextId = exerciseIds[nextIndex];
      router.push(
        `/exercises/detail?id=${nextId}&tpl=${templateSlot}&ids=${templateIds}&idx=${nextIndex}`
      );
    } else {
      router.push('/templates');
    }
  };

  const displayedLogs = showAll ? allLogs : allLogs.slice(0, 3);

  if (loading) {
    return <div className="flex items-center justify-center h-60 text-textMuted">読み込み中...</div>;
  }
  if (!exercise) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        {isTemplateFlow ? (
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => router.push('/templates')} className="text-textMuted hover:text-textSecondary text-sm">
              ← テンプレート
            </button>
            <span className="text-xs text-textMuted font-mono">
              {currentIndex + 1} / {exerciseIds.length}
            </span>
          </div>
        ) : (
          <button onClick={() => router.push('/')} className="text-textMuted hover:text-textSecondary text-sm mb-2 inline-block">
            ← 種目一覧
          </button>
        )}
        <h1 className="text-2xl font-bold tracking-tight">{exercise.name}</h1>
        {bodyPart && (
          <span className="text-xs font-medium text-accent bg-accent/10 px-2.5 py-1 rounded-full mt-1 inline-block">
            {bodyPart.name}
          </span>
        )}
      </div>

      {/* テンプレートの進捗バー */}
      {isTemplateFlow && (
        <div className="flex gap-1">
          {exerciseIds.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < currentIndex ? 'bg-success' : i === currentIndex ? 'bg-accent' : 'bg-border'
              }`}
            />
          ))}
        </div>
      )}

      {/* Max weight */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <div className="text-xs text-textMuted uppercase tracking-widest mb-1">過去Max重量</div>
        <div className="text-4xl font-bold font-mono text-accent">
          {max > 0 ? `${max} kg` : '—'}
        </div>
      </div>

      {/* New log form */}
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold text-sm text-textSecondary">新規ログ</h2>

        <div className="flex items-center gap-2 text-[10px] text-textMuted px-1">
          <span className="w-5" />
          <span className="flex-1 text-center">kg</span>
          <span className="w-4" />
          <span className="flex-1 text-center">回</span>
          <span className="w-16 text-right">Vol</span>
          <span className="w-5" />
        </div>

        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-textMuted w-5 text-right font-mono shrink-0">{i + 1}</span>
            <input
              type="number" inputMode="decimal" placeholder="0" value={s.weight}
              onChange={(e) => updateSet(i, 'weight', e.target.value)}
              className="flex-1 min-w-0 bg-bg border border-border rounded-xl px-2 py-3 text-center font-mono text-base focus:outline-none focus:border-accent"
            />
            <span className="text-textMuted shrink-0">×</span>
            <input
              type="number" inputMode="numeric" placeholder="0" value={s.reps}
              onChange={(e) => updateSet(i, 'reps', e.target.value)}
              className="flex-1 min-w-0 bg-bg border border-border rounded-xl px-2 py-3 text-center font-mono text-base focus:outline-none focus:border-accent"
            />
            <span className="w-16 shrink-0 text-right text-sm font-mono text-textSecondary">
              {setVolumes[i] > 0 ? setVolumes[i].toLocaleString() : '—'}
            </span>
            <span className="w-5 shrink-0">
              {sets.length > 1 && (
                <button onClick={() => setSets(sets.filter((_, idx) => idx !== i))} className="text-textMuted hover:text-danger text-base leading-none">×</button>
              )}
            </span>
          </div>
        ))}

        <div className="flex items-center justify-between pt-1">
          {sets.length < 5 ? (
            <button onClick={() => setSets([...sets, { weight: '', reps: '' }])} className="text-accent text-sm font-medium hover:text-accentHover">
              ＋ セット追加
            </button>
          ) : <span />}
          <div className="text-right">
            <span className="text-xs text-textMuted">総Volume: </span>
            <span className="font-mono font-bold text-lg">{totalVolume > 0 ? totalVolume.toLocaleString() : '—'}</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || totalVolume === 0}
          className="w-full bg-accent hover:bg-accentHover disabled:opacity-40 text-white py-3.5 rounded-xl font-bold text-base transition-colors"
        >
          {saving ? '保存中...' : '記録する'}
        </button>

        {/* テンプレートフロー: 次へ / 完了ボタン */}
        {isTemplateFlow && (
          <button
            onClick={goNext}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-colors border ${
              isLastExercise
                ? 'bg-success/10 border-success/30 text-success hover:bg-success/20'
                : 'bg-surfaceHover border-border text-textSecondary hover:text-textPrimary'
            }`}
          >
            {isLastExercise ? '✅ トレーニング完了' : `次へ → ${exerciseIds[currentIndex + 1] ? '' : ''}`}
          </button>
        )}
      </div>

      {/* Log history */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-textSecondary">
            履歴 {allLogs.length > 0 && <span className="text-textMuted font-normal">({allLogs.length}件)</span>}
          </h2>
        </div>

        {allLogs.length === 0 ? (
          <div className="text-textMuted text-sm py-4 text-center">記録なし</div>
        ) : (
          <>
            {displayedLogs.map((log) => (
              <div key={log.id} className="bg-surface border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-textMuted font-mono">{formatDatetime(log.performedAtISO)}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm">Vol: {log.totalVolume.toLocaleString()}</span>
                    <button
                      onClick={() => setEditingLog(log)}
                      className="text-xs text-accent hover:text-accentHover"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => setDeletingLogId(log.id)}
                      className="text-xs text-danger hover:opacity-70"
                    >
                      削除
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {log.sets.map((s) => (
                    <span key={s.id} className="bg-bg rounded-lg px-2.5 py-1 text-xs font-mono">
                      {s.weight}kg × {s.reps}回
                      <span className="text-textMuted ml-1">({s.volume})</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {allLogs.length > 3 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full text-xs text-textMuted hover:text-textSecondary py-2 text-center"
              >
                {showAll ? '▲ 折りたたむ' : `▼ もっと見る（残り ${allLogs.length - 3} 件）`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Edit modal */}
      {editingLog && (
        <EditModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onSaved={async () => { setEditingLog(null); await load(); }}
        />
      )}

      {/* Delete confirm */}
      {deletingLogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 space-y-4 slide-up">
            <h3 className="font-semibold text-center">この記録を削除しますか？</h3>
            <p className="text-xs text-textMuted text-center">この操作は元に戻せません。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingLogId(null)}
                className="flex-1 py-3 rounded-xl border border-border text-textSecondary hover:text-textPrimary text-sm font-semibold"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(deletingLogId)}
                className="flex-1 py-3 rounded-xl bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 text-sm font-semibold"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
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
