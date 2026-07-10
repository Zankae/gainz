import { useState, useEffect, useMemo } from 'react';
import { db, type Exercise, type BodyweightEntry } from '../gainz-db';
import CandlestickChart from './CandlestickChart';
import { useTheme } from '../theme';

type ProgressTab = 'strength' | 'bodyweight' | 'volume';

export default function ProgressScreen() {
  const { theme } = useTheme();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExId, setSelectedExId] = useState<number | null>(null);
  const [tab, setTab] = useState<ProgressTab>('strength');
  const [bodyweightData, setBodyweightData] = useState<BodyweightEntry[]>([]);

  useEffect(() => {
    db.exercises.toArray().then(all => {
      setExercises(all.filter(e => !e.hidden && !e.archived).sort((a, b) => a.name.localeCompare(b.name)));
      if (all.length > 0 && !selectedExId && all[0]?.id) {
        setSelectedExId(all[0].id);
      }
    });
    db.bodyweight.orderBy('at').toArray().then(setBodyweightData);
  }, []);

  const selectedExercise = useMemo(
    () => exercises.find(e => e.id === selectedExId),
    [exercises, selectedExId],
  );

  return (
    <div style={{ padding: '12px 16px', paddingBottom: 80 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>Progress</h2>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 2, marginBottom: 16 }}>
        {([
          { key: 'strength' as const, label: 'Strength' },
          { key: 'bodyweight' as const, label: 'Bodyweight' },
          { key: 'volume' as const, label: 'Volume' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 600,
              background: tab === t.key ? 'var(--accent)' : 'transparent',
              color: tab === t.key ? 'var(--on-accent)' : 'var(--muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Strength tab — exercise selector + candlestick chart */}
      {tab === 'strength' && (
        <>
          <select
            value={selectedExId ?? ''}
            onChange={e => setSelectedExId(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
              marginBottom: 12,
            }}
          >
            {exercises.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
          {selectedExercise && <CandlestickChart exercise={selectedExercise} />}
        </>
      )}

      {/* Bodyweight tab — simple SVG line chart */}
      {tab === 'bodyweight' && (
        <BodyweightLineChart data={bodyweightData} theme={theme} />
      )}

      {/* Volume tab */}
      {tab === 'volume' && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          Volume chart — select an exercise in the Strength tab first
        </div>
      )}
    </div>
  );
}

/* ---- Simple SVG line chart for bodyweight ---- */

function BodyweightLineChart({ data, theme }: { data: BodyweightEntry[]; theme: string }) {
  const W = 320;
  const H = 200;
  const PAD = { top: 20, right: 20, bottom: 30, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const colors = useMemo(() => {
    if (typeof document === 'undefined') return { accent: '#5BB8F5', grid: '#232B36', muted: '#8A94A3' };
    const cs = getComputedStyle(document.documentElement);
    return {
      accent: cs.getPropertyValue('--accent').trim() || '#5BB8F5',
      grid: cs.getPropertyValue('--grid').trim() || '#232B36',
      muted: cs.getPropertyValue('--muted').trim() || '#8A94A3',
    };
  }, [theme]);

  if (data.length < 2) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Log at least 2 bodyweight entries to see a chart.
      </div>
    );
  }

  const vals = data.map(d => d.kg);
  const min = Math.min(...vals) - 1;
  const max = Math.max(...vals) + 1;
  const range = max - min;

  const x = (i: number) => PAD.left + (i / (data.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - min) / range) * plotH;

  // Build path
  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.kg)}`).join(' ');

  // Gridlines
  const gridLines = 4;
  const step = range / gridLines;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 8 }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
        {/* Gridlines */}
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const v = min + i * step;
          const gy = y(v);
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={gy} y2={gy} stroke={colors.grid} strokeWidth="0.5" />
              <text x={PAD.left - 4} y={gy + 4} textAnchor="end" fill={colors.muted} fontSize="9">
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {data.length <= 10
          ? data.map((d, i) => (
              <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fill={colors.muted} fontSize="8">
                {new Date(d.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            ))
          : [0, Math.floor(data.length / 2), data.length - 1].map(i => (
              <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fill={colors.muted} fontSize="8">
                {new Date(data[i].at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            ))
        }

        {/* Area fill */}
        <path
          d={`${pathD} L ${x(data.length - 1)} ${y(min)} L ${x(0)} ${y(min)} Z`}
          fill={colors.accent}
          opacity="0.1"
        />

        {/* Line */}
        <path d={pathD} fill="none" stroke={colors.accent} strokeWidth="2" strokeLinejoin="round" />

        {/* Dots */}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.kg)} r="3" fill={colors.accent} />
        ))}
      </svg>
    </div>
  );
}
