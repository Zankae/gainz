import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTheme } from '../theme';
import type { Preference } from '../theme';
import {
  db,
  normalizeQuarterKg,
  exportBackup,
  restoreBackup,
  type BodyweightEntry,
  type Exercise,
  type MuscleGroup,
} from '../gainz-db';

const GROUPS: MuscleGroup[] = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
  'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Abdominals', 'Traps', 'Full body',
];
import StepperInput from './StepperInput';
import ConfirmDialog from './ConfirmDialog';

export default function ProfileScreen() {
  const { theme, preference, setPreference } = useTheme();
  const [bodyweightEntries, setBodyweightEntries] = useState<BodyweightEntry[]>([]);
  const [bwValue, setBwValue] = useState(70);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void; destructive?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const entries = await db.bodyweight.orderBy('at').reverse().toArray();
    setBodyweightEntries(entries);
    const setting = await db.settings.get('lastBackupAt');
    setLastBackup(setting ? (setting.value as number) : null);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // --- Bodyweight ---
  const logBodyweight = async () => {
    const kg = normalizeQuarterKg(bwValue);
    await db.bodyweight.add({ at: Date.now(), kg });
    showToast(`Bodyweight logged: ${kg.toFixed(2)} kg`);
    await loadData(); // Refresh immediately for live chart update
  };

  const deleteBodyweight = (entry: BodyweightEntry) => {
    setConfirm({
      title: 'Delete Entry',
      message: `Delete bodyweight entry from ${new Date(entry.at).toLocaleDateString()}?`,
      destructive: true,
      onConfirm: async () => {
        if (entry.id) await db.bodyweight.delete(entry.id);
        setConfirm(null);
        await loadData();
      },
    });
  };

  // --- Export ---
  const handleExport = async () => {
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gainz-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup downloaded');
      await loadData();
    } catch {
      showToast('Export failed');
    }
  };

  // --- Restore ---
  const handleRestoreClick = () => fileRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setConfirm({
        title: 'Restore Backup',
        message: `This will replace ALL your data. Export a safety copy first.\n\nBackup date: ${new Date(data.exportedAt).toLocaleString()}`,
        destructive: true,
        onConfirm: async () => {
          try {
            await restoreBackup(data);
            setConfirm(null);
            showToast('Backup restored successfully');
            await loadData();
          } catch (err) {
            setConfirm(null);
            showToast(err instanceof Error ? err.message : 'Restore failed');
          }
        },
      });
    } catch {
      showToast('Invalid backup file');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const options: { value: Preference; label: string }[] = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'System' },
  ];

  return (
    <div style={{ padding: '16px', paddingBottom: 80 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>Profile</h2>

      {/* Bodyweight Chart — always visible at top */}
      <BodyweightLineChart data={bodyweightEntries} theme={theme} />

      {/* Log Bodyweight */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 12,
        marginTop: 12,
      }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
          Log Bodyweight
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <StepperInput mode="weight" value={bwValue} onChange={setBwValue} />
          </div>
          <button
            onClick={logBodyweight}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontSize: 14,
              fontWeight: 600,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            LOG
          </button>
        </div>

        {/* Recent entries */}
        {bodyweightEntries.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Recent entries
            </div>
            {bodyweightEntries.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div>
                  <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>
                    {entry.kg.toFixed(2)} kg
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
                    {new Date(entry.at).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => deleteBodyweight(entry)}
                  style={{ fontSize: 14, color: 'var(--loss)', padding: '2px 4px' }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exercise Library */}
      <ExerciseManager />

      {/* Theme — moved down */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
          Theme
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPreference(opt.value)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 'var(--radius-sm)',
                background: preference === opt.value ? 'var(--accent-dim)' : 'var(--surface-2)',
                color: preference === opt.value ? 'var(--accent)' : 'var(--muted)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Backup & Restore */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
          Backup & Restore
        </div>

        {lastBackup && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            Last backup: {new Date(lastBackup).toLocaleString()}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExport} style={{
            flex: 1, padding: '12px 0', borderRadius: 'var(--radius-sm)',
            background: 'var(--gain-dim)', color: 'var(--gain)', fontSize: 14, fontWeight: 600,
          }}>Export Backup</button>
          <button onClick={handleRestoreClick} style={{
            flex: 1, padding: '12px 0', borderRadius: 'var(--radius-sm)',
            background: 'var(--loss-dim)', color: 'var(--loss)', fontSize: 14, fontWeight: 600,
          }}>Restore Backup</button>
        </div>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
          Export saves all your data as a JSON file. Restore replaces everything — make sure to export a safety copy first.
        </div>
      </div>

      {/* Reset App */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          Danger Zone
        </div>
        <button
          onClick={() => setConfirm({
            title: 'Reset App',
            message: 'This will permanently delete ALL your data — workouts, bodyweight entries, templates, everything. This cannot be undone.',
            destructive: true,
            onConfirm: async () => {
              await db.delete();
              await db.open();
              // Re-seed exercises
              const { seedIfEmpty } = await import('../gainz-db');
              await seedIfEmpty();
              setConfirm(null);
              setToast('App reset complete');
              await loadData();
            },
          })}
          style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--loss-dim)',
            color: 'var(--loss)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Reset App
        </button>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
          Deletes all data and restores the default exercise library.
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 20px', borderRadius: 'var(--radius)', background: 'var(--accent)',
          color: 'var(--on-accent)', fontSize: 13, fontWeight: 600, zIndex: 500,
          boxShadow: '0 4px 16px var(--shadow)', whiteSpace: 'nowrap',
        }}>{toast}</div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmLabel={confirm?.destructive ? 'Delete' : 'OK'}
        destructive={confirm?.destructive}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

/* ---- Bodyweight line chart ---- */

function BodyweightLineChart({ data, theme }: { data: BodyweightEntry[]; theme: string }) {
  const W = 320;
  const H = 180;
  const PAD = { top: 16, right: 16, bottom: 28, left: 40 };
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
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16,
        textAlign: 'center', color: 'var(--muted)', fontSize: 13,
      }}>
        Log at least 2 bodyweight entries to see a chart.
      </div>
    );
  }

  // Sort chronologically ascending
  const sorted = [...data].sort((a, b) => a.at - b.at);
  const vals = sorted.map(d => d.kg);
  const min = Math.min(...vals) - 1;
  const max = Math.max(...vals) + 1;
  const range = max - min || 1;

  const x = (i: number) => PAD.left + (i / (sorted.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - min) / range) * plotH;

  const pathD = sorted.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.kg)}`).join(' ');

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '8px 4px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '4px 12px 0' }}>
        Bodyweight
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
        {/* Gridlines */}
        {Array.from({ length: 4 }, (_, i) => {
          const v = min + (range / 4) * i;
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

        {/* X labels — show only first, middle, last for many points */}
        {(sorted.length <= 8 ? sorted : [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]]).map((d, i) => {
          const idx = sorted.indexOf(d);
          return (
            <text key={i} x={x(idx)} y={H - 6} textAnchor="middle" fill={colors.muted} fontSize="8">
              {new Date(d.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </text>
          );
        })}

        {/* Area fill */}
        <path d={`${pathD} L ${x(sorted.length - 1)} ${y(min)} L ${x(0)} ${y(min)} Z`}
          fill={colors.accent} opacity="0.1" />

        {/* Line */}
        <path d={pathD} fill="none" stroke={colors.accent} strokeWidth="2" strokeLinejoin="round" />

        {/* Dots */}
        {sorted.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.kg)} r="3" fill={colors.accent} />
        ))}
      </svg>
    </div>
  );
}

/* ---- Exercise management ---- */

function ExerciseManager() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<MuscleGroup | ''>('');
  const [deleteConfirm, setDeleteConfirm] = useState<Exercise | null>(null);

  useEffect(() => {
    db.exercises.toArray().then(all => setExercises(all.sort((a, b) => a.name.localeCompare(b.name))));
  }, []);

  const refresh = () => {
    db.exercises.toArray().then(all => setExercises(all.sort((a, b) => a.name.localeCompare(b.name))));
  };

  const toggleFavorite = async (ex: Exercise) => {
    await db.exercises.update(ex.id!, { favorite: !ex.favorite });
    refresh();
  };

  const handleDelete = async (ex: Exercise) => {
    const setCount = await db.sets.where('exerciseId').equals(ex.id!).count();
    if (setCount > 0) {
      await db.exercises.update(ex.id!, { archived: true, hidden: true });
    } else {
      await db.exercises.delete(ex.id!);
    }
    setDeleteConfirm(null);
    refresh();
  };

  const filtered = exercises.filter(ex => {
    if (ex.archived) return false;
    if (search.trim() && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (groupFilter && ex.group !== groupFilter) return false;
    return true;
  });

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
        Exercise Library
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input type="search" placeholder="Search…" value={search}
          onChange={e => setSearch(e.target.value)} style={{
            flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'var(--surface-2)',
            color: 'var(--text)', fontSize: 13, outline: 'none',
          }} />
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value as MuscleGroup | '')} style={{
          padding: '8px 8px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13,
        }}>
          <option value="">All</option>
          {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {filtered.slice(0, 100).map(ex => (
          <div key={ex.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ex.name}
                {ex.custom && <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 4 }}>custom</span>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{ex.group} · {ex.equipment}</div>
            </div>
            <button onClick={() => toggleFavorite(ex)} style={{
              padding: '6px 8px', fontSize: 18,
              color: ex.favorite ? 'var(--accent)' : 'var(--muted)',
            }}>{ex.favorite ? '♥' : '♡'}</button>
            <button onClick={() => setDeleteConfirm(ex)} style={{
              padding: '6px 8px', fontSize: 14, color: 'var(--loss)',
            }}>🗑</button>
          </div>
        ))}
      </div>
      {deleteConfirm && (
        <ConfirmDialog
          open={true}
          title="Remove Exercise"
          message={`Remove "${deleteConfirm.name}"? Historical data will be preserved.`}
          confirmLabel="Remove"
          destructive={true}
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
