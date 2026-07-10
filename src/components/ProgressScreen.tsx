import { useState, useEffect, useMemo } from 'react';
import { db, chartRowsForExercise, type Exercise } from '../gainz-db';
import CandlestickChart from './CandlestickChart';
import { type Period } from '../gainz-candles';

type ProgressTab = 'strength' | 'volume';

const VOL_PERIODS: { key: Period; label: string }[] = [
  { key: 'Day', label: '1D' }, { key: 'Week', label: '1W' }, { key: 'Month', label: '1M' }, { key: 'Year', label: '1Y' },
];

export default function ProgressScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExId, setSelectedExId] = useState<number | null>(null);
  const [tab, setTab] = useState<ProgressTab>('strength');
  const [volPeriod, setVolPeriod] = useState<Period>('Week');
  const [volumeData, setVolumeData] = useState<{ label: string; volume: number }[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(false);

  useEffect(() => {
    db.exercises.toArray().then(all => {
      const filtered = all.filter(e => !e.hidden && !e.archived).sort((a, b) => a.name.localeCompare(b.name));
      setExercises(filtered);
      if (filtered.length > 0 && !selectedExId && filtered[0]?.id) {
        setSelectedExId(filtered[0].id);
      }
    });
  }, []);

  // Load volume data when exercise or period changes
  useEffect(() => {
    if (!selectedExId || tab !== 'volume') return;
    setVolumeLoading(true);
    (async () => {
      const rows = await chartRowsForExercise(selectedExId);
      const buckets = new Map<string, { volume: number; at: number }>();
      for (const r of rows) {
        const d = new Date(r.workoutStartedAt!);
        let key: string;
        if (volPeriod === 'Day') key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        else if (volPeriod === 'Week') {
          const start = new Date(d);
          start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
          key = `${start.getFullYear()}-W${Math.ceil((start.getDate() + 6) / 7)}`;
        }
        else if (volPeriod === 'Year') key = `${d.getFullYear()}`;
        else key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const existing = buckets.get(key);
        buckets.set(key, { volume: (existing?.volume || 0) + r.weightKg * r.reps, at: r.workoutStartedAt! });
      }
      const data = Array.from(buckets.entries())
        .sort((a, b) => a[1].at - b[1].at)
        .map(([label, v]) => ({ label, volume: v.volume }));
      setVolumeData(data);
      setVolumeLoading(false);
    })();
  }, [selectedExId, tab, volPeriod]);

  const selectedExercise = useMemo(
    () => exercises.find(e => e.id === selectedExId),
    [exercises, selectedExId],
  );

  return (
    <div style={{ padding: '12px 16px', paddingBottom: 80 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>Progress</h2>

      {/* Exercise selector — custom dropdown with favorites */}
      <ExerciseSelect exercises={exercises} selectedId={selectedExId} onSelect={setSelectedExId} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 2, marginBottom: 12 }}>
        <button
          onClick={() => setTab('strength')}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 600,
            background: tab === 'strength' ? 'var(--accent)' : 'transparent',
            color: tab === 'strength' ? 'var(--on-accent)' : 'var(--muted)',
          }}
        >
          Strength
        </button>
        <button
          onClick={() => setTab('volume')}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 600,
            background: tab === 'volume' ? 'var(--accent)' : 'transparent',
            color: tab === 'volume' ? 'var(--on-accent)' : 'var(--muted)',
          }}
        >
          Volume
        </button>
      </div>

      {tab === 'strength' && selectedExercise && (
        <CandlestickChart exercise={selectedExercise} />
      )}

      {tab === 'volume' && (
        <>
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 2, marginBottom: 12 }}>
            {VOL_PERIODS.map(p => (
              <button key={p.key} onClick={() => setVolPeriod(p.key)} style={{
                flex: 1, padding: '6px 0', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                background: volPeriod === p.key ? 'var(--accent)' : 'transparent',
                color: volPeriod === p.key ? 'var(--on-accent)' : 'var(--muted)',
              }}>{p.label}</button>
            ))}
          </div>
          <VolumeBarChart data={volumeData} loading={volumeLoading} />
        </>
      )}
    </div>
  );
}

/* ---- Volume bar chart ---- */

function VolumeBarChart({ data, loading }: { data: { label: string; volume: number }[]; loading: boolean }) {
  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  }
  if (data.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        No data yet. Complete workouts to see volume trends.
      </div>
    );
  }

  const W = 320;
  const H = 200;
  const PAD = { top: 20, right: 20, bottom: 30, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const maxV = Math.max(...data.map(d => d.volume));

  // Read CSS tokens
  const colors = (() => {
    if (typeof document === 'undefined') return { accent: '#5BB8F5', grid: '#232B36', muted: '#8A94A3' };
    const cs = getComputedStyle(document.documentElement);
    return {
      accent: cs.getPropertyValue('--accent').trim() || '#5BB8F5',
      grid: cs.getPropertyValue('--grid').trim() || '#232B36',
      muted: cs.getPropertyValue('--muted').trim() || '#8A94A3',
    };
  })();

  const barW = Math.max(4, (plotW / data.length) * 0.7);
  const gap = plotW / data.length;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 8 }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = PAD.top + plotH - ratio * plotH;
          const val = maxV * ratio;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={colors.grid} strokeWidth="0.5" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill={colors.muted} fontSize="9">
                {Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const barH = maxV > 0 ? (d.volume / maxV) * plotH : 0;
          return (
            <rect
              key={d.label}
              x={PAD.left + i * gap + (gap - barW) / 2}
              y={PAD.top + plotH - barH}
              width={barW}
              height={Math.max(1, barH)}
              fill={colors.accent}
              rx={2}
              opacity={0.8}
            />
          );
        })}

        {/* X labels */}
        {data.length <= 12
          ? data.map((d, i) => (
              <text key={i} x={PAD.left + i * gap + gap / 2} y={H - 6} textAnchor="middle" fill={colors.muted} fontSize="8">
                {d.label}
              </text>
            ))
          : data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d, i) => {
              const idx = data.indexOf(d);
              return (
                <text key={i} x={PAD.left + idx * gap + gap / 2} y={H - 6} textAnchor="middle" fill={colors.muted} fontSize="8">
                  {d.label}
                </text>
              );
            })
        }
      </svg>
    </div>
  );
}

/* ---- Exercise selector dropdown ---- */

function ExerciseSelect({ exercises, selectedId, onSelect }: {
  exercises: Exercise[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = exercises.find(e => e.id === selectedId);

  const toggleFavorite = async (e: React.MouseEvent, ex: Exercise) => {
    e.stopPropagation();
    await db.exercises.update(ex.id!, { favorite: !ex.favorite });
  };

  const filtered = exercises.filter(ex => {
    if (ex.hidden || ex.archived) return false;
    if (search.trim() && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)', background: 'var(--surface)',
        color: 'var(--text)', fontSize: 14, textAlign: 'left',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{selected ? (selected.favorite ? '★ ' : '') + selected.name : 'Select exercise…'}</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)', boxShadow: '0 8px 24px var(--shadow)',
          maxHeight: 320, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: 8 }}>
            <input type="search" placeholder="Search…" value={search}
              onChange={e => setSearch(e.target.value)} autoFocus style={{
                width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                border: 'none', background: 'var(--surface-2)', color: 'var(--text)',
                fontSize: 13, outline: 'none',
              }} />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 260 }}>
            {filtered.map(ex => (
              <div key={ex.id} style={{
                display: 'flex', alignItems: 'center',
                borderBottom: '1px solid var(--border)',
              }}>
                <button onClick={() => { onSelect(ex.id!); setOpen(false); setSearch(''); }} style={{
                  flex: 1, padding: '10px 12px', textAlign: 'left', color: 'var(--text)', fontSize: 13,
                }}>
                  {ex.name}
                  <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>{ex.group}</span>
                </button>
                <button onClick={(e) => toggleFavorite(e, ex)} style={{
                  padding: '10px 10px', fontSize: 16,
                  color: ex.favorite ? 'var(--accent)' : 'var(--muted)',
                }}>
                  {ex.favorite ? '♥' : '♡'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setOpen(false)} />}
    </div>
  );
}
