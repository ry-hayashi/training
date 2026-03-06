'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAll, put } from '@/lib/db';
import { enrichLog } from '@/lib/aggregations';
import type { WorkoutLog, WorkoutSet, Exercise, BodyPart, Template, LogWithSets } from '@/types';
import { v4 } from 'uuid';

// 「YYYY-MM-DD」→「2025年3月6日（木）」
function formatFullDate(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

// ─── テンプレ保存モーダル ──────────────────────────────────────
interface SaveTemplateModalProps {
  exerciseIds: string[];          // この日の種目順
  defaultName: string;
  templates: Template[];
  onClose: () => void;
  onSaved: () => void;
}

function SaveTemplateModal({
  exerciseIds,
  defaultName,
  templates,
  onClose,
  onSaved,
}: SaveTemplateModalProps) {
  const [name, setName] = useState(defaultName);
  const [targetSlot, setTargetSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // 空き枠があれば自動選択、なければnull（上書き選択が必要）
  const emptySlot = templates.find((t) => !t.name && t.exerciseIds.length === 0);
  useEffect(() => {
    if (emptySlot) setTargetSlot(emptySlot.slot);
  }, []);

  const allFull = !emptySlot;

  const handleSave = async () => {
    if (!targetSlot) return;
    setSaving(true);
    await put('templates', {
      slot: targetSlot,
      name: name.trim() || defaultName,
      exerciseIds,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border-t border-border rounded-t-2xl p-5 space-y-4 slide-up">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">テンプレートに保存</h3>
          <button onClick={onClose} className="text-textMuted hover:text-textSecondary text-xl">✕</button>
        </div>

        {/* テンプレ名 */}
        <div className="space-y-1">
          <label className="text-xs text-textMuted">テンプレート名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-accent"
          />
        </div>

        {/* スロット選択 */}
        <div className="space-y-1">
          <label className="text-xs text-textMuted">
            {allFull ? '上書きするスロットを選択（必須）' : '保存先スロット'}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {templates.map((t) => {
              const isEmpty = !t.name && t.exerciseIds.length === 0;
              return (
                <button
                  key={t.slot}
                  onClick={() => setTargetSlot(t.slot)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    targetSlot === t.slot
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-bg text-textSecondary hover:border-accent/40'
                  }`}
                >
                  <div className="text-[10px] font-mono text-textMuted mb-0.5">#{t.slot}</div>
                  <div className="text-xs font-medium truncate">
                    {isEmpty ? '(空き)' : t.name || `テンプレ${t.slot}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !targetSlot}
          className="w-full bg-accent hover:bg-accentHover disabled:opacity-40 text-white py-3.5 rounded-xl font-bold transition-colors"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  );
}

// ─── メインコンテンツ ──────────────────────────────────────────
function DayDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dateKey = searchParams.get('date') || ''; // "YYYY-MM-DD"

  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    Promise.all([
      getAll('workoutLogs'),
      getAll('sets'),
      getAll('exercises'),
      getAll('bodyParts'),
      getAll('templates'),
    ]).then(([l, s, e, bp, t]) => {
      setLogs(l);
      setSets(s);
      setExercises(e);
      setBodyParts(bp);
      // Ensure 6 slots
      const tplMap = new Map((t as Template[]).map((tpl) => [tpl.slot, tpl]));
      const all: Template[] = [];
      for (let i = 1; i <= 6; i++) {
        all.push(tplMap.get(i) || { slot: i, name: '', exerciseIds: [] });
      }
      setTemplates(all);
      setLoading(false);
    });
  }, []);

  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const bpMap = useMemo(() => new Map(bodyParts.map((bp) => [bp.id, bp.name])), [bodyParts]);

  // この日のログだけ抽出（performedAtISO の日付部分で比較）
  const dayLogs = useMemo(() => {
    return logs
      .filter((log) => log.performedAtISO.slice(0, 10) === dateKey)
      .sort((a, b) => a.performedAtISO.localeCompare(b.performedAtISO));
  }, [logs, dateKey]);

  // 種目ごとにグループ化（記録した順番）
  const grouped = useMemo(() => {
    const seen = new Map<string, { exercise: Exercise; logs: LogWithSets[] }>();
    const order: string[] = [];
    for (const log of dayLogs) {
      const ex = exMap.get(log.exerciseId);
      if (!ex) continue;
      if (!seen.has(ex.id)) {
        seen.set(ex.id, { exercise: ex, logs: [] });
        order.push(ex.id);
      }
      seen.get(ex.id)!.logs.push(enrichLog(log, sets));
    }
    return order.map((id) => seen.get(id)!);
  }, [dayLogs, exMap, sets]);

  // この日の種目順（テンプレ用）
  const orderedExerciseIds = useMemo(() => grouped.map((g) => g.exercise.id), [grouped]);

  const totalVolume = useMemo(() => {
    return grouped.reduce((sum, g) => {
      return sum + g.logs.reduce((s, log) => s + log.totalVolume, 0);
    }, 0);
  }, [grouped]);

  if (loading) {
    return <div className="flex items-center justify-center h-60 text-textMuted">読み込み中...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="text-textMuted hover:text-textSecondary text-sm mb-2 inline-block"
        >
          ← グラフ
        </button>
        <h1 className="text-xl font-bold tracking-tight">{formatFullDate(dateKey)}</h1>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-textMuted">{grouped.length}種目</span>
          <span className="text-xs font-mono text-accent font-bold">
            総Vol: {totalVolume.toLocaleString()}kg
          </span>
        </div>
      </div>

      {/* テンプレートとして保存ボタン */}
      {grouped.length > 0 && (
        <button
          onClick={() => setShowSaveModal(true)}
          className="w-full flex items-center justify-center gap-2 border border-accent/30 bg-accent/5 hover:bg-accent/10 text-accent rounded-xl py-3 text-sm font-semibold transition-colors"
        >
          📋 このメニューをテンプレートに保存
        </button>
      )}

      {savedMsg && (
        <div className="text-center text-xs text-success py-1">✅ テンプレートに保存しました</div>
      )}

      {/* 種目ごとの記録 */}
      {grouped.length === 0 ? (
        <div className="text-center py-12 text-textMuted">この日の記録はありません</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ exercise, logs: exLogs }, idx) => {
            const exTotalVol = exLogs.reduce((s, l) => s + l.totalVolume, 0);
            const maxW = Math.max(...exLogs.flatMap((l) => l.sets.map((s) => s.weight)));
            return (
              <div key={exercise.id} className="bg-surface border border-border rounded-2xl overflow-hidden">
                {/* 種目ヘッダー */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                  <span className="text-xs text-textMuted font-mono w-5 shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-semibold text-sm truncate cursor-pointer hover:text-accent transition-colors"
                      onClick={() => router.push(`/exercises/detail?id=${exercise.id}`)}
                    >
                      {exercise.name}
                    </div>
                    <div className="text-[10px] text-textMuted">{bpMap.get(exercise.bodyPartId)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-bold text-accent">{exTotalVol.toLocaleString()}kg</div>
                    <div className="text-[10px] text-textMuted">max {maxW}kg</div>
                  </div>
                </div>

                {/* セッションごと（同日に複数回記録している場合） */}
                <div className="divide-y divide-border">
                  {exLogs.map((log) => (
                    <div key={log.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-textMuted font-mono">{formatTime(log.performedAtISO)}</span>
                        <span className="text-xs font-mono text-textSecondary">Vol: {log.totalVolume.toLocaleString()}</span>
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* テンプレ保存モーダル */}
      {showSaveModal && (
        <SaveTemplateModal
          exerciseIds={orderedExerciseIds}
          defaultName={dateKey.replace(/-/g, '/')}
          templates={templates}
          onClose={() => setShowSaveModal(false)}
          onSaved={() => {
            setShowSaveModal(false);
            setSavedMsg(true);
            setTimeout(() => setSavedMsg(false), 3000);
          }}
        />
      )}
    </div>
  );
}

export default function DayDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-60 text-textMuted">読み込み中...</div>}>
      <DayDetailContent />
    </Suspense>
  );
}
