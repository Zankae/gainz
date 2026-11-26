import { useState, useEffect, useMemo } from 'react';
import { db, chartRowsForAllExercises, chartRowsForExercise, setVolumeKg, type ChartSetRow, type Exercise } from '../gainz-db';
import CandlestickChart from './CandlestickChart';
import { getTrainingPeriodKey, type Period } from '../gainz-candles';

const PROGRESS_TABS = [
  { key: 'strength', label: 'Strength' },
  { key: 'volume', label: 'Volume' },
  { key: 'total-volume', label: 'Total Volume' },
] as const;

type ProgressTab = typeof PROGRESS_TABS[number]['key'];

const VOL_PERIODS: { key: Period; label: string }[] = [
  { key: 'Day', label: '1D' }, { key: 'Week', label: '1W' }, { key: 'Month', label: '1M' }, { key: 'Year', label: '1Y' },
];

export default function ProgressScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExId, setSelectedExId] = useState<number | null>(null);
  const [tab, setTab] = useState<ProgressTab>('strength');
  const [volPeriod, setVolPeriod] = useState<Period>('Week');

  useEffect(() => {
    db.exercises.toArray().then(all => {
      const filtered = all.filter(e => !e.hidden && !e.archived).sort((a, b) => a.name.localeCompare(b.name));
      setExercises(filtered);
      if (filtered.length > 0 && !selectedExId && filtered[0]?.id) {
        setSelectedExId(filtered[0].id);
      }
    });
  }, []);

  const selectedExercise = useMemo(
    () => exercises.find(e => e.id === selectedExId),
    [exercises, selectedExId],
  );
  const volumeScope = tab === 'total-volume' ? 'all' : selectedExId;

  return (
    <div style={{ padding: '12px 16px', paddingBottom: 80, overflow: 'hidden' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>Progress</h2>

      {/* Exercise selector — custom dropdown with favorites */}
      {tab !== 'total-volume' && (
        <ExerciseSelect exercises={exercises} selectedId={selectedExId} onSelect={setSelectedExId} />
      )}

      {/* Tabs */}
      <div role="group" aria-label="Progress charts" style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 2, marginBottom: 12 }}>
        {PROGRESS_TABS.map(({ key, label }) => (
          <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600,
            background: tab === key ? 'var(--accent)' : 'transparent',
            color: tab === key ? 'var(--on-accent)' : 'var(--muted)',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'strength' && selectedExercise && (
        <CandlestickChart exercise={selectedExercise} />
      )}

      {tab !== 'strength' && (
        <>
          <div role="group" aria-label="Volume period" style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 2, marginBottom: 12 }}>
            {VOL_PERIODS.map(p => (
              <button key={p.key} aria-label={p.key} aria-pressed={volPeriod === p.key} onClick={() => setVolPeriod(p.key)} style={{
                flex: 1, padding: '6px 0', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                background: volPeriod === p.key ? 'var(--accent)' : 'transparent',
                color: volPeriod === p.key ? 'var(--on-accent)' : 'var(--muted)',
              }}>{p.label}</button>
            ))}
          </div>
          <VolumeChart key={volumeScope ?? 'none'} scope={volumeScope} period={volPeriod} />
        </>
      )}
    </div>
  );
}

/* ---- Volume bar chart ---- */

function VolumeChart({ scope, period }: { scope: 'all' | number | null; period: Period }) {
  const [rows, setRows] = useState<ChartSetRow[] | 'error'>();

  useEffect(() => {
    if (scope === null) return;
    let current = true;
    const request = scope === 'all' ? chartRowsForAllExercises() : chartRowsForExercise(scope);
    request.then(
      result => { if (current) setRows(result); },
      () => { if (current) setRows('error'); },
    );
    return () => { current = false; };
  }, [scope]);

  const data = useMemo(() => {
    if (!rows || rows === 'error') return [];
    const workoutPeriods = new Map<number, string>();
    const totals = new Map<string, number>();
    for (const row of rows) {
      let label = workoutPeriods.get(row.workoutId);
      if (label === undefined) {
        label = getTrainingPeriodKey(row.workoutStartedAt, period);
        workoutPeriods.set(row.workoutId, label);
      }
      totals.set(label, (totals.get(label) ?? 0) + setVolumeKg(row.weightKg, row.reps));
    }
    return Array.from(totals, ([label, volume]) => ({ label, volume }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, period]);

  if (rows === 'error') {
    return <div role="alert" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Could not load workout volume.</div>;
  }
  return <VolumeBarChart data={data} loading={scope !== null && rows === undefined} />;
}

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
  const maxV = data.reduce((max, d) => Math.max(max, d.volume), 0);

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

  const gap = plotW / data.length;
  const barW = gap * 0.7;
  const labelStep = Math.ceil((data[0].label.length * 5 + 4) / gap);

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
            >
              <title>{`${d.label} · ${d.volume} kg`}</title>
            </rect>
          );
        })}

        {/* X labels */}
        {data.map((d, i) => i % labelStep === 0 && (
          <text key={d.label} x={PAD.left + i * gap + gap / 2} y={H - 6} textAnchor="middle" fill={colors.muted} fontSize="8">
            {d.label}
          </text>
        ))}
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
