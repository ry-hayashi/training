'use client';

import { useEffect, useState } from 'react';
import { getAll, put } from '@/lib/db';
import type { Template, Exercise, BodyPart } from '@/types';
import Link from 'next/link';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editExIds, setEditExIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [t, e, bp] = await Promise.all([
      getAll('templates'),
      getAll('exercises'),
      getAll('bodyParts'),
    ]);
    // Ensure 6 slots
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

  if (loading) {
    return <div className="flex items-center justify-center h-60 text-textMuted">読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">テンプレート</h1>

      {editing !== null ? (
        <div className="bg-surface border border-border rounded-2xl p-4 space-y-4 slide-up">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">スロット {editing} 編集</h2>
            <button onClick={() => setEditing(null)} className="text-textMuted hover:text-textSecondary">
              ✕
            </button>
          </div>
          <input
            type="text"
            placeholder="テンプレート名"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
          />
          <div className="text-xs text-textMuted">種目を選択:</div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {bodyParts.map((bp) => {
              const bpExercises = exercises.filter((e) => e.bodyPartId === bp.id);
              if (bpExercises.length === 0) return null;
              return (
                <div key={bp.id}>
                  <div className="text-[10px] text-textMuted uppercase tracking-widest mt-2 mb-1">
                    {bp.name}
                  </div>
                  {bpExercises.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => toggleExercise(ex.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        editExIds.includes(ex.id)
                          ? 'bg-accent/20 text-accent border border-accent/30'
                          : 'bg-bg hover:bg-surfaceHover border border-transparent'
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
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {templates.map((tpl) => (
            <div
              key={tpl.slot}
              className="bg-surface border border-border rounded-2xl p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-textMuted font-mono">#{tpl.slot}</span>
                <button
                  onClick={() => startEdit(tpl)}
                  className="text-xs text-accent hover:text-accentHover"
                >
                  編集
                </button>
              </div>
              <div className="font-semibold text-sm truncate">
                {tpl.name || '(未設定)'}
              </div>
              {tpl.exerciseIds.length > 0 ? (
                <div className="space-y-1">
                  {tpl.exerciseIds.map((eid) => {
                    const ex = exMap.get(eid);
                    if (!ex) return null;
                    return (
                      <Link
                        key={eid}
                        href={`/exercises/detail?id=${eid}`}
                        className="block text-xs text-textSecondary hover:text-accent truncate"
                      >
                        → {ex.name}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-textMuted">種目なし</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
