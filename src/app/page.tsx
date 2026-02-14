'use client';

import { useEffect, useState, useMemo } from 'react';
import { getAll, put } from '@/lib/db';
import type { Exercise, BodyPart } from '@/types';
import { v4 } from 'uuid';
import Link from 'next/link';

export default function HomePage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBp, setNewBp] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [ex, bp] = await Promise.all([getAll('exercises'), getAll('bodyParts')]);
    setExercises(ex);
    setBodyParts(bp);
    if (bp.length > 0 && !newBp) setNewBp(bp[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const bodyPartMap = useMemo(
    () => new Map(bodyParts.map((bp) => [bp.id, bp.name])),
    [bodyParts]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return exercises;
    const q = search.toLowerCase();
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (bodyPartMap.get(e.bodyPartId) || '').toLowerCase().includes(q)
    );
  }, [exercises, search, bodyPartMap]);

  // Group by body part
  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const ex of filtered) {
      const arr = map.get(ex.bodyPartId) || [];
      arr.push(ex);
      map.set(ex.bodyPartId, arr);
    }
    return bodyParts
      .filter((bp) => map.has(bp.id))
      .map((bp) => ({ bodyPart: bp, exercises: map.get(bp.id)! }));
  }, [filtered, bodyParts]);

  const handleAdd = async () => {
    if (!newName.trim() || !newBp) return;
    const ex: Exercise = { id: v4(), name: newName.trim(), bodyPartId: newBp };
    await put('exercises', ex);
    setNewName('');
    setShowAdd(false);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="text-textMuted">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">種目一覧</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-accent hover:bg-accentHover text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          ＋ 追加
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-surface rounded-2xl p-4 border border-border space-y-3 slide-up">
          <input
            type="text"
            placeholder="種目名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
            autoFocus
          />
          <select
            value={newBp}
            onChange={(e) => setNewBp(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-textPrimary focus:outline-none focus:border-accent"
          >
            {bodyParts.map((bp) => (
              <option key={bp.id} value={bp.id}>
                {bp.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="w-full bg-accent hover:bg-accentHover disabled:bg-accentMuted disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors"
          >
            保存
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="種目・部位を検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 pl-10 text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
        />
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted text-sm">🔍</span>
      </div>

      {/* Grouped list */}
      {grouped.length === 0 ? (
        <div className="text-center py-12 text-textMuted">
          {exercises.length === 0 ? '種目を追加してください' : '該当なし'}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ bodyPart, exercises: exs }) => (
            <div key={bodyPart.id}>
              <h2 className="text-xs font-semibold text-textMuted uppercase tracking-widest mb-2 px-1">
                {bodyPart.name}
              </h2>
              <div className="space-y-1.5">
                {exs.map((ex) => (
                  <Link
                    key={ex.id}
                    href={`/exercises/detail?id=${ex.id}`}
                    className="block bg-surface hover:bg-surfaceHover border border-border rounded-xl px-4 py-3.5 transition-colors"
                  >
                    <span className="font-medium">{ex.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
