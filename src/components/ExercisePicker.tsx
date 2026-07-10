import { useState, useEffect, useMemo } from 'react';
import { db, type Exercise, type MuscleGroup, type Equipment } from '../gainz-db';

const GROUPS: MuscleGroup[] = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
  'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Abdominals', 'Traps', 'Full body',
];

const EQUIPMENT: Equipment[] = [
  'barbell', 'dumbbell', 'cable', 'machine', 'smith', 'plate', 'bodyweight', 'other',
];

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  /** Exercise IDs already in the current workout — shown as dimmed but still selectable */
  selectedIds?: Set<number>;
}

export default function ExercisePicker({ open, onClose, onSelect, selectedIds }: ExercisePickerProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<MuscleGroup | ''>('');
  const [equipFilter, setEquipFilter] = useState<Equipment | ''>('');

  useEffect(() => {
    if (!open) return;
    db.exercises.toArray().then((all) => {
      setExercises(all.filter((e) => !e.hidden && !e.archived));
    });
  }, [open]);

  const filtered = useMemo(() => {
    let list = exercises;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    if (groupFilter) {
      list = list.filter((e) => e.group === groupFilter);
    }
    if (equipFilter) {
      list = list.filter((e) => e.equipment === equipFilter);
    }
    // Sort: favorites first, then alphabetical
    return [...list].sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [exercises, search, groupFilter, equipFilter]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
        <button onClick={onClose} style={{ fontSize: 24, lineHeight: 1, padding: 4 }}>
          ✕
        </button>
        <input
          type="search"
          placeholder="Search exercises…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          style={{
            flex: 1,
            height: 40,
            padding: '0 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            fontSize: 15,
            outline: 'none',
          }}
        />
      </div>

      {/* Filters */}
      <div style={{ padding: '8px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value as MuscleGroup | '')}
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 13,
          }}
        >
          <option value="">All groups</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          value={equipFilter}
          onChange={(e) => setEquipFilter(e.target.value as Equipment | '')}
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 13,
          }}
        >
          <option value="">All equipment</option>
          {EQUIPMENT.map((eq) => (
            <option key={eq} value={eq}>{eq}</option>
          ))}
        </select>
        {(search || groupFilter || equipFilter) && (
          <button
            onClick={() => { setSearch(''); setGroupFilter(''); setEquipFilter(''); }}
            style={{ fontSize: 12, color: 'var(--accent)', padding: '4px 8px' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {filtered.map((exercise) => {
          const alreadySelected = selectedIds?.has(exercise.id!);
          return (
            <button
              key={exercise.id}
              onClick={() => onSelect(exercise)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '12px 16px',
                textAlign: 'left',
                opacity: alreadySelected ? 0.4 : 1,
                borderBottom: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>
                  {exercise.favorite && '★ '}{exercise.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {exercise.group} · {exercise.equipment}{exercise.perHand ? ' · per hand' : ''}
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {exercise.custom ? 'Custom' : ''}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
            No exercises found
          </div>
        )}
      </div>
    </div>
  );
}
