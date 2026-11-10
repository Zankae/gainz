import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { db, normalizeReps, normalizeWeight, type Exercise, type Template } from '../gainz-db';
import { saveTemplate, templateExercises } from '../templates';
import ExercisePicker from './ExercisePicker';
import './TemplateEditor.css';

interface EditableSet { weight: string; reps: string }
interface EditableExercise { exerciseId: number; exercise?: Exercise; sets: EditableSet[] }

interface TemplateEditorProps {
  template?: Template;
  onClose: () => void;
  onSaved: (template: Template) => void;
}

export default function TemplateEditor({ template, onClose, onSaved }: TemplateEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const pickerWasOpen = useRef(false);
  const savingRef = useRef(false);
  const titleId = useId();
  const nameId = useId();
  const [name, setName] = useState('');
  const [entries, setEntries] = useState<EditableExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const current = template?.id === undefined ? undefined : await db.templates.get(template.id);
      if (template && !current) throw new Error('This template no longer exists.');
      const exercises = current ? templateExercises(current) : [];
      const library = await db.exercises.bulkGet(exercises.map(exercise => exercise.exerciseId));
      setName(current?.name ?? '');
      setEntries(exercises.map((exercise, index) => ({
        exerciseId: exercise.exerciseId, exercise: library[index],
        sets: exercise.sets.map(set => ({ weight: set.weightKg ? String(set.weightKg) : '', reps: set.reps ? String(set.reps) : '' })),
      })));
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not load this template.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    void load();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    if (showPicker) pickerRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close exercise picker"]')?.focus();
    else if (pickerWasOpen.current) addButtonRef.current?.focus({ preventScroll: true });
    pickerWasOpen.current = showPicker;
  }, [showPicker]);

  const close = () => {
    if (savingRef.current) return;
    dialogRef.current?.close();
    onClose();
  };

  const updateSets = (index: number, update: (sets: EditableSet[]) => EditableSet[]) => {
    setEntries(current => current.map((entry, i) => i === index ? { ...entry, sets: update(entry.sets) } : entry));
  };

  const moveExercise = (index: number, offset: number) => {
    setEntries(current => {
      const result = [...current];
      [result[index], result[index + offset]] = [result[index + offset], result[index]];
      return result;
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || loading || loadError) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const exercises = entries.map(entry => ({
        exerciseId: entry.exerciseId,
        sets: entry.sets.map((set, index) => {
          try {
            return { weightKg: normalizeWeight(set.weight.trim() || '0'), reps: normalizeReps(set.reps.trim() || '0') };
          } catch {
            throw new Error(`${entry.exercise?.name ?? 'Exercise'}, set ${index + 1}: enter non-negative numbers or leave the fields blank.`);
          }
        }),
      }));
      const saved = await saveTemplate(template?.id, name, exercises);
      dialogRef.current?.close();
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the template. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const totalSets = entries.reduce((total, entry) => total + entry.sets.length, 0);

  return (
    <dialog ref={dialogRef} className="template-editor" aria-labelledby={titleId}
      onCancel={event => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        if (showPicker) setShowPicker(false); else close();
      }}>
      <form className="template-editor-layout" onSubmit={save} inert={showPicker}>
        <header className="template-editor-header">
          <div>
            <h2 id={titleId}>{template ? 'Edit Template' : 'New Template'}</h2>
            <p>{entries.length} exercise{entries.length === 1 ? '' : 's'} · {totalSets} set{totalSets === 1 ? '' : 's'}</p>
          </div>
          <button type="button" className="template-icon-button" aria-label="Close template editor" autoFocus disabled={saving} onClick={close}>✕</button>
        </header>
        <div className="template-editor-scroll">
          {loading ? <p role="status">Loading template…</p> : loadError ? (
            <div role="alert" className="template-editor-error">{loadError} <button type="button" onClick={() => void load()}>Retry</button></div>
          ) : (
            <fieldset className="template-editor-fields" disabled={saving}>
              <div className="template-name-card">
                <label htmlFor={nameId}>Template name</label>
                <input id={nameId} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Tuesday — Upper Body" required />
                <p>Leave weight or reps blank to fill them in during your workout.</p>
              </div>

              {entries.map((entry, index) => {
                const exerciseName = entry.exercise?.name ?? 'Exercise no longer available';
                return (
                  <section className="template-exercise-card" key={entry.exerciseId} aria-label={exerciseName}>
                    <div className="template-exercise-header">
                      <span className="template-exercise-number num">{index + 1}</span>
                      <div className="template-exercise-title">
                        <h3>{exerciseName}</h3>
                        <p>{entry.exercise ? `${entry.exercise.group} · ${entry.exercise.equipment}` : 'Remove this exercise before saving.'}</p>
                      </div>
                      <button type="button" className="template-icon-button template-remove" aria-label={`Remove ${exerciseName}`}
                        onClick={() => setEntries(current => current.filter((_, i) => i !== index))}>✕</button>
                    </div>
                    <div className="template-exercise-tools">
                      <button type="button" aria-label={`Move ${exerciseName} up`} disabled={index === 0} onClick={() => moveExercise(index, -1)}>↑ Up</button>
                      <button type="button" aria-label={`Move ${exerciseName} down`} disabled={index === entries.length - 1} onClick={() => moveExercise(index, 1)}>↓ Down</button>
                      <button type="button" onClick={() => updateSets(index, sets => sets.map(() => ({ weight: '', reps: '' })))}>Clear values</button>
                    </div>
                    <div className="template-set-grid template-set-headings" aria-hidden="true">
                      <span>Set</span><span>{entry.exercise?.perHand ? 'Kg each' : 'Kg'}</span><span>Reps</span><span />
                    </div>
                    {entry.sets.map((set, setIndex) => (
                      <div className="template-set-grid" key={setIndex}>
                        <span className="template-set-number num">{setIndex + 1}</span>
                        <input type="text" inputMode="decimal" autoComplete="off" aria-label={`${exerciseName} set ${setIndex + 1} weight`}
                          placeholder="—" value={set.weight} onChange={event => updateSets(index, sets => sets.map((value, i) => i === setIndex ? { ...value, weight: event.target.value } : value))} />
                        <input type="text" inputMode="numeric" autoComplete="off" aria-label={`${exerciseName} set ${setIndex + 1} reps`}
                          placeholder="—" value={set.reps} onChange={event => updateSets(index, sets => sets.map((value, i) => i === setIndex ? { ...value, reps: event.target.value } : value))} />
                        <button type="button" className="template-icon-button template-remove" aria-label={`Remove ${exerciseName} set ${setIndex + 1}`}
                          disabled={entry.sets.length === 1} onClick={() => updateSets(index, sets => sets.filter((_, i) => i !== setIndex))}>−</button>
                      </div>
                    ))}
                    <button type="button" className="template-add-set" onClick={() => updateSets(index, sets => [...sets, { ...sets[sets.length - 1] }])}>+ Add Set</button>
                  </section>
                );
              })}

              {entries.length === 0 && <p className="template-empty">Add your first exercise to start building this template.</p>}
              <button ref={addButtonRef} type="button" className="template-add-exercise" onClick={() => setShowPicker(true)}>+ Add Exercise</button>
            </fieldset>
          )}
        </div>
        <footer className="template-editor-footer">
          {error && <p role="alert" className="template-editor-error">{error}</p>}
          <div>
            <button type="button" className="template-cancel" disabled={saving} onClick={close}>Cancel</button>
            <button type="submit" className="template-save" disabled={saving || loading || !!loadError || !name.trim() || !entries.length}>
              {saving ? 'Saving…' : template ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </footer>
      </form>
      {showPicker && (
        <div ref={pickerRef}>
          <ExercisePicker open onClose={() => setShowPicker(false)} selectedIds={new Set(entries.map(entry => entry.exerciseId))}
            onSelect={exercise => {
              setEntries(current => current.some(entry => entry.exerciseId === exercise.id) ? current : [
                ...current, { exerciseId: exercise.id!, exercise, sets: [{ weight: '', reps: '' }] },
              ]);
              setShowPicker(false);
            }}
            onExerciseUpdated={exercise => setEntries(current => current.map(entry => entry.exerciseId === exercise.id ? { ...entry, exercise } : entry))} />
        </div>
      )}
    </dialog>
  );
}
