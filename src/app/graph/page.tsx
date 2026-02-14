'use client';

import { useEffect, useState } from 'react';
import { getAll } from '@/lib/db';
import { bodyPartVolumeByWeek } from '@/lib/aggregations';
import type { PeriodVolume, BodyPart, Exercise, WorkoutLog, WorkoutSet } from '@/types';

// Simple SVG bar chart (no external lib dependency at runtime)
function BarChart({ data, bodyParts }: { data: PeriodVolume[]; bodyParts: BodyPart[] }) {
  if (data.length === 0) {
    return <div className="text-center text-textMuted py-12">データなし</div>;
  }

  const colors = ['#6366f1', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#38bdf8'];
  const bpColorMap = new Map(bodyParts.map((bp, i) => [bp.id, colors[i % colors.length]]));

  // Last 8 periods max for readability
  const recent = data.slice(-8);
  const maxVol = Math.max(
    ...recent.map((p) => p.bodyParts.reduce((sum, bp) => sum + bp.volume, 0)),
    1
  );

  const barWidth = 100 / recent.length;
  const chartHeight = 220;

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {bodyParts.map((bp) => (
          <div key={bp.id} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: bpColorMap.get(bp.id) }}
            />
            <span className="text-[10px] text-textSecondary">{bp.name}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-surface border border-border rounded-2xl p-4">
        <svg viewBox={`0 0 ${recent.length * 60} ${chartHeight + 30}`} className="w-full">
          {recent.map((period, pi) => {
            const totalVol = period.bodyParts.reduce((s, bp) => s + bp.volume, 0);
            let yOffset = 0;

            return (
              <g key={period.periodLabel}>
                {period.bodyParts
                  .filter((bp) => bp.volume > 0)
                  .map((bp) => {
                    const h = (bp.volume / maxVol) * chartHeight;
                    const y = chartHeight - yOffset - h;
                    yOffset += h;
                    return (
                      <rect
                        key={bp.bodyPartId}
                        x={pi * 60 + 10}
                        y={y}
                        width={38}
                        height={h}
                        rx={4}
                        fill={bpColorMap.get(bp.bodyPartId)}
                        opacity={0.85}
                      />
                    );
                  })}
                {/* Total label */}
                {totalVol > 0 && (
                  <text
                    x={pi * 60 + 29}
                    y={chartHeight - yOffset - 6}
                    textAnchor="middle"
                    className="text-[9px]"
                    fill="#9898b0"
                  >
                    {(totalVol / 1000).toFixed(0)}k
                  </text>
                )}
                {/* Period label */}
                <text
                  x={pi * 60 + 29}
                  y={chartHeight + 18}
                  textAnchor="middle"
                  className="text-[9px]"
                  fill="#68688a"
                >
                  {period.periodLabel.replace(/^\d{4}-/, '')}
                </text>
              </g>
            );
          })}
          {/* Zero line */}
          <line
            x1={0}
            y1={chartHeight}
            x2={recent.length * 60}
            y2={chartHeight}
            stroke="#2a2a3e"
            strokeWidth={1}
          />
        </svg>
      </div>
    </div>
  );
}

export default function GraphPage() {
  const [data, setData] = useState<PeriodVolume[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [logs, sets, exercises, bps] = await Promise.all([
        getAll('workoutLogs') as Promise<WorkoutLog[]>,
        getAll('sets') as Promise<WorkoutSet[]>,
        getAll('exercises') as Promise<Exercise[]>,
        getAll('bodyParts') as Promise<BodyPart[]>,
      ]);
      setBodyParts(bps);
      setData(bodyPartVolumeByWeek(logs, sets, exercises, bps));
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-60 text-textMuted">読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">部位別ボリューム</h1>
      <p className="text-xs text-textMuted">週ごとの総ボリューム（重量×回数）</p>
      <BarChart data={data} bodyParts={bodyParts} />
    </div>
  );
}
