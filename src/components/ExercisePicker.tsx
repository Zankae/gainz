import { useState, useEffect, useMemo } from 'react';
import { db, type Exercise, type MuscleGroup, type Equipment } from '../gainz-db';
import { EQUIPMENT, GROUPS } from '../exercise-options';
import ExerciseButton from './ExerciseButton';
import ExerciseEditor from './ExerciseEditor';

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  selectedIds?: Set<number>;
  onExerciseUpdated: (exercise: Exercise) => void;
}

export default function ExercisePicker({ open, onClose, onSelect, selectedIds, onExerciseUpdated }: ExercisePickerProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<MuscleGroup | ''>('');
  const [equipFilter, setEquipFilter] = useState<Equipment | ''>('');

  // undefined = list, null = create, Exercise = edit.
  const [editor, setEditor] = useState<Exercise | null | undefined>(undefined);

  const loadExercises = () => {
    db.exercises.toArray().then((all) => {
      setExercises(all.filter((e) => !e.hidden && !e.archived));
    });
  };

  useEffect(() => {
    if (!open) return;
    loadExercises();
    setEditor(undefined);
    setSearch('');
    setGroupFilter('');
    setEquipFilter('');
  }, [open]);

  const toggleFavorite = async (e: React.MouseEvent, exercise: Exercise) => {
    e.stopPropagation();
    await db.exercises.update(exercise.id!, { favorite: !exercise.favorite });
    loadExercises();
  };

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
    return [...list].sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [exercises, search, groupFilter, equipFilter]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
        <button aria-label="Close exercise picker" onClick={onClose} style={{ fontSize: 24, lineHeight: 1, padding: 4 }}>✕</button>
        <input type="search" placeholder="Search exercises…" value={search}
          onChange={(e) => setSearch(e.target.value)} style={{
            flex: 1, height: 40, padding: '0 12px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, outline: 'none',
          }} />
      </div>

      {/* Filters */}
      <div style={{ padding: '8px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value as MuscleGroup | '')}
          style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}>
          <option value="">All groups</option>
          {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={equipFilter} onChange={(e) => setEquipFilter(e.target.value as Equipment | '')}
          style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}>
          <option value="">All equipment</option>
          {EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
        </select>
        {(search || groupFilter || equipFilter) && (
          <button onClick={() => { setSearch(''); setGroupFilter(''); setEquipFilter(''); }}
            style={{ fontSize: 12, color: 'var(--accent)', padding: '4px 8px' }}>Clear</button>
        )}
      </div>

      <p style={{ padding: '8px 16px 0', fontSize: 12, color: 'var(--muted)' }}>Hold an exercise to edit it.</p>

      {/* Exercise list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {filtered.map((exercise) => {
          const alreadySelected = selectedIds?.has(exercise.id!);
          return (
            <div key={exercise.id} style={{
              display: 'flex', alignItems: 'center',
              borderBottom: '1px solid var(--border)',
            }}>
              <ExerciseButton onEdit={() => setEditor(exercise)} onClick={() => alreadySelected ? undefined : onSelect(exercise)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', textAlign: 'left',
                opacity: alreadySelected ? 0.35 : 1, color: 'var(--text)',
                cursor: alreadySelected ? 'default' : 'pointer',
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>
                    {exercise.name}
                    {exercise.custom && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>custom</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {exercise.group} · {exercise.equipment}{exercise.perHand ? ' · per hand' : ''}
                  </div>
                </div>
              </ExerciseButton>
              {/* Favorite heart */}
              <button onClick={(e) => toggleFavorite(e, exercise)} style={{
                padding: '10px 10px', fontSize: 20,
                color: exercise.favorite ? 'var(--accent)' : 'var(--muted)',
                marginRight: 16,
              }}>
                {exercise.favorite ? '♥' : '♡'}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>No exercises found</div>
        )}
      </div>

      {/* Create exercise button */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        <button onClick={() => setEditor(null)} style={{
          width: '100%', padding: '12px 0', borderRadius: 'var(--radius-sm)',
          border: '2px dashed var(--border)', color: 'var(--accent)', fontSize: 14, fontWeight: 600,
        }}>
          + Create Exercise
        </button>
      </div>
      {editor !== undefined && (
        <ExerciseEditor
          exercise={editor ?? undefined}
          onClose={() => setEditor(undefined)}
          onSaved={saved => {
            if (editor) onExerciseUpdated(saved);
            setEditor(undefined);
            loadExercises();
          }}
        />
      )}
    </div>
  );
}
