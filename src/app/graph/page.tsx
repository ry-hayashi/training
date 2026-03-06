'use client';

import { useEffect, useState, useMemo } from 'react';
import { getAll } from '@/lib/db';
import {
  bodyPartVolumeByDay,
  bodyPartVolumeByWeek,
  bodyPartVolumeByMonth,
  formatPeriodLabel,
  formatVolume,
} from '@/lib/aggregations';
import type { WorkoutLog, WorkoutSet, Exercise, BodyPart, PeriodVolume } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts';

type Mode = 'day' | 'week' | 'month';

const BODY_PART_COLORS = [
  '#6366f1', // 胸
  '#34d399', // 背中
  '#fbbf24', // 肩
  '#f87171', // 腕
  '#a78bfa', // 脚
  '#38bdf8', // 腹
  '#fb923c',
  '#e879f9',
];

const TABS: { key: Mode; label: string }[] = [
  { key: 'day', label: '日' },
  { key: 'week', label: '週' },
  { key: 'month', label: '月' },
];

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
  return (
    <div className="bg-surface border border-border rounded-xl p-3 text-xs space-y-1 shadow-lg">
      <div className="font-semibold text-textPrimary mb-1">{label}</div>
      {payload.map((p: any) =>
        p.value > 0 ? (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: p.fill }}
            />
            <span className="text-textSecondary">{p.name}</span>
            <span className="ml-auto font-mono font-bold text-textPrimary">
              {p.value.toLocaleString('ja-JP')}kg
            </span>
          </div>
        ) : null
      )}
      <div className="border-t border-border pt-1 flex justify-between font-bold text-textPrimary">
        <span>合計</span>
        <span className="font-mono">{total.toLocaleString('ja-JP')}kg</span>
      </div>
    </div>
  );
}

export default function GraphPage() {
  const [mode, setMode] = useState<Mode>('week');
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAll('workoutLogs'),
      getAll('sets'),
      getAll('exercises'),
      getAll('bodyParts'),
    ]).then(([l, s, e, bp]) => {
      setLogs(l);
      setSets(s);
      setExercises(e);
      setBodyParts(bp);
      setLoading(false);
    });
  }, []);

  const periods: PeriodVolume[] = useMemo(() => {
    if (mode === 'day') return bodyPartVolumeByDay(logs, sets, exercises, bodyParts);
    if (mode === 'week') return bodyPartVolumeByWeek(logs, sets, exercises, bodyParts);
    return bodyPartVolumeByMonth(logs, sets, exercises, bodyParts);
  }, [mode, logs, sets, exercises, bodyParts]);

  // Build recharts data
  const chartData = useMemo(() => {
    return periods.map((p) => {
      const row: Record<string, string | number> = {
        label: formatPeriodLabel(p.periodLabel, mode),
      };
      for (const bpv of p.bodyParts) {
        if (bpv.volume > 0) row[bpv.bodyPartName] = bpv.volume;
      }
      return row;
    });
  }, [periods, mode]);

  // Active body parts (those with any data)
  const activeBodyParts = useMemo(() => {
    const names = new Set<string>();
    for (const p of periods) {
      for (const bpv of p.bodyParts) {
        if (bpv.volume > 0) names.add(bpv.bodyPartName);
      }
    }
    return bodyParts.filter((bp) => names.has(bp.name));
  }, [periods, bodyParts]);

  // Total volume for current period
  const totalVolume = useMemo(() => {
    return periods.reduce((sum, p) => {
      return sum + p.bodyParts.reduce((s, bpv) => s + bpv.volume, 0);
    }, 0);
  }, [periods]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60 text-textMuted">読み込み中...</div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">ボリューム</h1>
        <div className="text-xs text-textMuted font-mono">
          合計 {totalVolume.toLocaleString('ja-JP')}kg
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === tab.key
                ? 'bg-accent text-white'
                : 'text-textMuted hover:text-textSecondary'
            }`}
          >
            {tab.label}別
          </button>
        ))}
      </div>

      {chartData.length === 0 ? (
        <div className="text-center py-16 text-textMuted">データなし</div>
      ) : (
        <>
          {/* Chart */}
          <div className="bg-surface border border-border rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 8, left: 0, bottom: 8 }}
                barSize={mode === 'month' ? 32 : mode === 'week' ? 24 : 16}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#68688a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#68688a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                {activeBodyParts.map((bp, i) => (
                  <Bar
                    key={bp.id}
                    dataKey={bp.name}
                    stackId="a"
                    fill={BODY_PART_COLORS[i % BODY_PART_COLORS.length]}
                    radius={i === activeBodyParts.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  >
                    {/* Show label only on top bar segment if volume is large enough */}
                    {i === activeBodyParts.length - 1 && (
                      <LabelList
                        dataKey={bp.name}
                        position="top"
                        formatter={(v: number) =>
                          v > 0 ? `${(v / 1000).toFixed(1)}k` : ''
                        }
                        style={{ fill: '#9898b0', fontSize: 10 }}
                      />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2">
            {activeBodyParts.map((bp, i) => (
              <div key={bp.id} className="flex items-center gap-1.5 text-xs text-textSecondary">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ background: BODY_PART_COLORS[i % BODY_PART_COLORS.length] }}
                />
                {bp.name}
              </div>
            ))}
          </div>

          {/* Period breakdown table */}
          <div className="space-y-2">
            {[...periods].reverse().slice(0, 8).map((p) => {
              const total = p.bodyParts.reduce((s, bpv) => s + bpv.volume, 0);
              if (total === 0) return null;
              return (
                <div
                  key={p.periodLabel}
                  className="bg-surface border border-border rounded-xl px-4 py-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold font-mono">
                      {formatPeriodLabel(p.periodLabel, mode)}
                    </span>
                    <span className="text-sm font-mono font-bold text-accent">
                      {formatVolume(total)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {p.bodyParts
                      .filter((bpv) => bpv.volume > 0)
                      .map((bpv, i) => {
                        const colorIdx = activeBodyParts.findIndex(
                          (bp) => bp.name === bpv.bodyPartName
                        );
                        return (
                          <span key={bpv.bodyPartId} className="text-xs flex items-center gap-1">
                            <span
                              className="inline-block w-2 h-2 rounded-sm"
                              style={{
                                background:
                                  BODY_PART_COLORS[colorIdx % BODY_PART_COLORS.length],
                              }}
                            />
                            <span className="text-textMuted">{bpv.bodyPartName}</span>
                            <span className="font-mono text-textSecondary">
                              {formatVolume(bpv.volume)}
                            </span>
                          </span>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
