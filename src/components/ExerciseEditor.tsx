import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { db, updateExercise, type Equipment, type Exercise, type MuscleGroup } from '../gainz-db';
import { EQUIPMENT, GROUPS } from '../exercise-options';

interface ExerciseEditorProps {
  exercise?: Exercise;
  onClose: () => void;
  onSaved: (exercise: Exercise) => void;
}

export default function ExerciseEditor({ exercise, onClose, onSaved }: ExerciseEditorProps) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [group, setGroup] = useState<MuscleGroup>(exercise?.group ?? 'Chest');
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? 'barbell');
  const [perHand, setPerHand] = useState(exercise?.perHand ?? false);
  const [favorite, setFavorite] = useState(exercise?.favorite ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const details = { name: name.trim(), group, equipment, perHand, favorite };
      let saved: Exercise;
      if (exercise) {
        saved = await updateExercise(exercise.id!, details);
      } else {
        saved = { ...details, custom: true, hidden: false, archived: false };
        saved.id = await db.exercises.add(saved);
      }
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save exercise. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); if (!savingRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, margin: 0, width: '100%', maxWidth: 'none',
        height: '100dvh', maxHeight: 'none', padding: 0, border: 'none',
        background: 'var(--bg)', color: 'var(--text)', overflowY: 'auto',
      }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
          <button type="button" aria-label="Close exercise editor" disabled={saving} onClick={onClose}
            autoFocus style={{ fontSize: 24, lineHeight: 1, padding: 4 }}>✕</button>
          <h3 id={titleId} style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
            {exercise ? 'Edit Exercise' : 'New Exercise'}
          </h3>
        </div>
        <form onSubmit={save} style={{ padding: '16px 16px calc(16px + env(safe-area-inset-bottom))' }}>
          <fieldset disabled={saving} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
            <input type="text" aria-label="Exercise name" placeholder="Exercise name" value={name}
              onChange={event => setName(event.target.value)} required style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
                fontSize: 14, marginBottom: 12,
              }} />
            <div style={{ marginBottom: 12 }}>
              <label htmlFor={`${titleId}-group`} style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Muscle Group</label>
              <select id={`${titleId}-group`} value={group} onChange={event => setGroup(event.target.value as MuscleGroup)} style={{
                width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13,
              }}>
                {GROUPS.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor={`${titleId}-equipment`} style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Equipment</label>
              <select id={`${titleId}-equipment`} value={equipment} onChange={event => setEquipment(event.target.value as Equipment)} style={{
                width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13,
              }}>
                {EQUIPMENT.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
              <input type="checkbox" checked={perHand} onChange={event => setPerHand(event.target.checked)} />
              Per-hand weight
            </label>
            <button type="button" aria-pressed={favorite} onClick={() => setFavorite(!favorite)} style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16, padding: 0,
            }}>
              <span aria-hidden="true" style={{ fontSize: 20, color: favorite ? 'var(--accent)' : 'var(--muted)' }}>
                {favorite ? '♥' : '♡'}
              </span>
              Favorite
            </button>
            {error && <div role="alert" style={{ color: 'var(--loss)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onClose} style={{
                flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-2)', fontSize: 13, fontWeight: 500,
              }}>Cancel</button>
              <button type="submit" disabled={!name.trim() || saving} style={{
                flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)',
                background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 600,
              }}>{saving ? 'Saving…' : exercise ? 'Save Changes' : 'Create'}</button>
            </div>
          </fieldset>
        </form>
      </div>
    </dialog>
  );
}
