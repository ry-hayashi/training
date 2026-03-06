'use client';

import { useEffect, useState } from 'react';
import { getAll, put } from '@/lib/db';
import type { Template, Exercise, BodyPart } from '@/types';
import { useRouter } from 'next/navigation';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editExIds, setEditExIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // 選択中テンプレ（フロー開始前のプレビュー）
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const load = async () => {
    const [t, e, bp] = await Promise.all([
      getAll('templates'),
      getAll('exercises'),
      getAll('bodyParts'),
    ]);
    const tplMap = new Map(t.map((tpl) => [tpl.slot, tpl]));
    const all: Template[] = [];
    for (let i = 1; i <= 6; i++) {
      all.push(tplMap.get(i) || { slot: i, name: '', exerciseIds: [] });
    }
    setTemplates(all);
    setExercises(e);
    setBodyParts(bp);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const bpMap = new Map(bodyParts.map((bp) => [bp.id, bp.name]));
  const exMap = new Map(exercises.map((e) => [e.id, e]));

  const startEdit = (tpl: Template) => {
    setSelectedSlot(null);
    setEditing(tpl.slot);
    setEditName(tpl.name);
    setEditExIds([...tpl.exerciseIds]);
  };

  const toggleExercise = (exId: string) => {
    setEditExIds((prev) =>
      prev.includes(exId) ? prev.filter((id) => id !== exId) : [...prev, exId]
    );
  };

  const saveTemplate = async () => {
    if (editing === null) return;
    await put('templates', { slot: editing, name: editName.trim(), exerciseIds: editExIds });
    setEditing(null);
    await load();
  };

  // テンプレートフロー開始: 最初の種目の記録ページへ
  const startWorkout = (tpl: Template) => {
    if (tpl.exerciseIds.length === 0) return;
    const ids = tpl.exerciseIds.join(',');
    router.push(
      `/exercises/detail?id=${tpl.exerciseIds[0]}&tpl=${tpl.slot}&ids=${ids}&idx=0`
    );
  };

  const selectedTemplate = selectedSlot !== null
    ? templates.find((t) => t.slot === selectedSlot) ?? null
    : null;

  if (loading) {
    return <div className="flex items-center justify-center h-60 text-textMuted">読み込み中...</div>;
  }

  // ── 編集画面 ──────────────────────────────────────────────
  if (editing !== null) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setEditing(null)} className="text-textMuted hover:text-textSecondary text-sm">
            ← 戻る
          </button>
          <h2 className="font-semibold">スロット {editing} 編集</h2>
          <span className="w-12" />
        </div>

        <input
          type="text"
          placeholder="テンプレート名"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
        />

        <div className="text-xs text-textMuted">種目を選択 ({editExIds.length}件選択中)</div>

        <div className="space-y-1 max-h-[55vh] overflow-y-auto">
          {bodyParts.map((bp) => {
            const bpExercises = exercises.filter((e) => e.bodyPartId === bp.id);
            if (bpExercises.length === 0) return null;
            return (
              <div key={bp.id}>
                <div className="text-[10px] text-textMuted uppercase tracking-widest mt-3 mb-1 px-1">
                  {bp.name}
                </div>
                {bpExercises.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => toggleExercise(ex.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors mb-1 ${
                      editExIds.includes(ex.id)
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : 'bg-surface hover:bg-surfaceHover border border-border'
                    }`}
                  >
                    {editExIds.includes(ex.id) ? '✓ ' : ''}{ex.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <button
          onClick={saveTemplate}
          className="w-full bg-accent hover:bg-accentHover text-white py-3 rounded-xl font-semibold transition-colors"
        >
          保存
        </button>
      </div>
    );
  }

  // ── テンプレ詳細プレビュー ─────────────────────────────────
  if (selectedTemplate) {
    const validExs = selectedTemplate.exerciseIds
      .map((id) => exMap.get(id))
      .filter(Boolean) as Exercise[];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelectedSlot(null)} className="text-textMuted hover:text-textSecondary text-sm">
            ← テンプレート
          </button>
          <button
            onClick={() => startEdit(selectedTemplate)}
            className="text-xs text-accent hover:text-accentHover"
          >
            編集
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {selectedTemplate.name || `テンプレート ${selectedTemplate.slot}`}
          </h1>
          <p className="text-xs text-textMuted mt-1">{validExs.length}種目</p>
        </div>

        {/* 種目リスト */}
        <div className="space-y-1.5">
          {validExs.map((ex, i) => (
            <div
              key={ex.id}
              className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3"
            >
              <span className="text-xs text-textMuted font-mono w-5 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{ex.name}</div>
                <div className="text-[10px] text-textMuted">{bpMap.get(ex.bodyPartId)}</div>
              </div>
            </div>
          ))}
        </div>

        {validExs.length > 0 ? (
          <button
            onClick={() => startWorkout(selectedTemplate)}
            className="w-full bg-accent hover:bg-accentHover text-white py-4 rounded-xl font-bold text-base transition-colors"
          >
            🏋️ トレーニング開始
          </button>
        ) : (
          <div className="text-center text-textMuted text-sm py-4">
            種目を追加してください
          </div>
        )}
      </div>
    );
  }

  // ── テンプレート一覧 ──────────────────────────────────────
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">テンプレート</h1>

      <div className="grid grid-cols-2 gap-3">
        {templates.map((tpl) => {
          const hasContent = tpl.exerciseIds.length > 0;
          return (
            <button
              key={tpl.slot}
              onClick={() => hasContent ? setSelectedSlot(tpl.slot) : startEdit(tpl)}
              className={`bg-surface border rounded-2xl p-4 text-left space-y-2 transition-colors ${
                hasContent
                  ? 'border-border hover:border-accent/40 hover:bg-surfaceHover'
                  : 'border-dashed border-border hover:border-accent/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-textMuted font-mono">#{tpl.slot}</span>
                {hasContent && (
                  <span className="text-[10px] text-textMuted">{tpl.exerciseIds.length}種目</span>
                )}
              </div>

              {hasContent ? (
                <>
                  <div className="font-semibold text-sm truncate">
                    {tpl.name || `テンプレート ${tpl.slot}`}
                  </div>
                  <div className="space-y-0.5">
                    {tpl.exerciseIds.slice(0, 3).map((eid) => {
                      const ex = exMap.get(eid);
                      return ex ? (
                        <div key={eid} className="text-xs text-textMuted truncate">
                          · {ex.name}
                        </div>
                      ) : null;
                    })}
                    {tpl.exerciseIds.length > 3 && (
                      <div className="text-xs text-textMuted">
                        +{tpl.exerciseIds.length - 3}件
                      </div>
                    )}
                  </div>
                  <div className="pt-1 text-xs text-accent font-medium">タップして開始 →</div>
                </>
              ) : (
                <div className="text-sm text-textMuted">
                  ＋ テンプレートを作成
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
