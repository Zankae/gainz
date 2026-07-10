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
  selectedIds?: Set<number>;
}

export default function ExercisePicker({ open, onClose, onSelect, selectedIds }: ExercisePickerProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<MuscleGroup | ''>('');
  const [equipFilter, setEquipFilter] = useState<Equipment | ''>('');

  // Custom exercise creation
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<MuscleGroup>('Chest');
  const [newEquip, setNewEquip] = useState<Equipment>('barbell');
  const [newPerHand, setNewPerHand] = useState(false);

  const loadExercises = () => {
    db.exercises.toArray().then((all) => {
      setExercises(all.filter((e) => !e.hidden && !e.archived));
    });
  };

  useEffect(() => {
    if (!open) return;
    loadExercises();
    setShowCreate(false);
    setSearch('');
    setGroupFilter('');
    setEquipFilter('');
  }, [open]);

  const toggleFavorite = async (e: React.MouseEvent, exercise: Exercise) => {
    e.stopPropagation();
    await db.exercises.update(exercise.id!, { favorite: !exercise.favorite });
    loadExercises();
  };

  const createExercise = async () => {
    if (!newName.trim()) return;
    await db.exercises.add({
      name: newName.trim(),
      group: newGroup,
      equipment: newEquip,
      perHand: newPerHand,
      custom: true,
      favorite: false,
      hidden: false,
      archived: false,
    });
    setShowCreate(false);
    setNewName('');
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
        <button onClick={onClose} style={{ fontSize: 24, lineHeight: 1, padding: 4 }}>✕</button>
        <input type="search" placeholder="Search exercises…" value={search}
          onChange={(e) => setSearch(e.target.value)} autoFocus style={{
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

      {/* Create form or list */}
      {showCreate ? (
        <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 16 }}>New Exercise</h3>
          <input type="text" placeholder="Exercise name" value={newName}
            onChange={e => setNewName(e.target.value)} autoFocus style={{
              width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
              fontSize: 14, outline: 'none', marginBottom: 12,
            }} />
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Muscle Group</div>
            <select value={newGroup} onChange={e => setNewGroup(e.target.value as MuscleGroup)} style={{
              width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13,
            }}>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Equipment</div>
            <select value={newEquip} onChange={e => setNewEquip(e.target.value as Equipment)} style={{
              width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13,
            }}>
              {EQUIPMENT.map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>
            <input type="checkbox" checked={newPerHand} onChange={e => setNewPerHand(e.target.checked)} />
            Per-hand weight (dumbbell)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowCreate(false)} style={{
              flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontWeight: 500,
            }}>Cancel</button>
            <button onClick={createExercise} disabled={!newName.trim()} style={{
              flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 600,
            }}>Create</button>
          </div>
        </div>
      ) : (
        <>
          {/* Exercise list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {filtered.map((exercise) => {
              const alreadySelected = selectedIds?.has(exercise.id!);
              return (
                <div key={exercise.id} style={{
                  display: 'flex', alignItems: 'center',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <button onClick={() => onSelect(exercise)} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', textAlign: 'left',
                    opacity: alreadySelected ? 0.4 : 1, color: 'var(--text)',
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
                  </button>
                  {/* Favorite heart */}
                  <button onClick={(e) => toggleFavorite(e, exercise)} style={{
                    padding: '12px 14px', fontSize: 18,
                    color: exercise.favorite ? 'var(--accent)' : 'var(--muted)',
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
            <button onClick={() => setShowCreate(true)} style={{
              width: '100%', padding: '12px 0', borderRadius: 'var(--radius-sm)',
              border: '2px dashed var(--border)', color: 'var(--accent)', fontSize: 14, fontWeight: 600,
            }}>
              + Create Exercise
            </button>
          </div>
        </>
      )}
    </div>
  );
}
