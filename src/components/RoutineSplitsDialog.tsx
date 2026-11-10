import { useEffect, useId, useRef, useState } from 'react';
import { getRoutineSplits, ROUTINE_DAYS, saveRoutineCell, type RoutineDay, type RoutineFields, type RoutineSplits } from '../routine-splits';
import './RoutineSplitsDialog.css';

type CellEdit = { day: RoutineDay; field: keyof RoutineFields; value: string };
type SaveStatus = 'saved' | 'saving' | 'error';

export default function RoutineSplitsDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [routine, setRoutine] = useState<RoutineSplits | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const pendingEdits = useRef(new Map<string, CellEdit>());
  const pendingWrites = useRef(0);

  const load = async () => {
    setLoadError(false);
    try {
      setRoutine(await getRoutineSplits());
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    void load();
    return () => dialog.close();
  }, []);

  const persist = async (edit: CellEdit) => {
    const key = `${edit.day}:${edit.field}`;
    pendingWrites.current += 1;
    setStatus('saving');
    try {
      await saveRoutineCell(edit.day, edit.field, edit.value);
      if (pendingEdits.current.get(key) === edit) pendingEdits.current.delete(key);
    } catch {
      // Retain the unsaved value in the table and offer a retry.
    } finally {
      pendingWrites.current -= 1;
      if (pendingWrites.current === 0) {
        setStatus(pendingEdits.current.size ? 'error' : 'saved');
      }
    }
  };

  const changeCell = (day: RoutineDay, field: keyof RoutineFields, value: string) => {
    setRoutine(current => current && { ...current, [day]: { ...current[day], [field]: value } });
    const edit = { day, field, value };
    pendingEdits.current.set(`${day}:${field}`, edit);
    void persist(edit);
  };

  const close = () => {
    if (pendingWrites.current === 0 && pendingEdits.current.size === 0) {
      dialogRef.current?.close();
      onClose();
    }
  };

  return (
    <dialog ref={dialogRef} className="routine-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); close(); }}>
      <div className="routine-dialog-content">
        <header className="routine-dialog-header">
          <h3 id={titleId}>Routine - Splits</h3>
          <button type="button" aria-label="Close routine splits" autoFocus
            disabled={status !== 'saved'} onClick={close}>✕</button>
        </header>
        <p id={descriptionId} className="routine-dialog-description">Tap a cell to edit. Changes save automatically.</p>
        {routine ? (
          <div className="routine-table-scroll">
            <table className="routine-table" aria-label="Weekly routine splits">
              <thead>
                <tr><th scope="col">Day</th><th scope="col">Muscle groups</th><th scope="col">Notes</th></tr>
              </thead>
              <tbody>
                {ROUTINE_DAYS.map(day => (
                  <tr key={day}>
                    <th scope="row">{day}</th>
                    <td><textarea aria-label={`${day} muscle groups`} rows={2} value={routine[day].muscleGroups}
                      onChange={event => changeCell(day, 'muscleGroups', event.target.value)} /></td>
                    <td><textarea aria-label={`${day} notes`} rows={2} value={routine[day].notes}
                      onChange={event => changeCell(day, 'notes', event.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : loadError ? (
          <div className="routine-message" role="alert">
            Could not load your routine. <button type="button" onClick={() => void load()}>Retry</button>
          </div>
        ) : <p className="routine-message" role="status">Loading routine…</p>}
        {routine && (
          <footer className="routine-save-status" role="status" aria-live="polite">
            {status === 'saving' ? 'Saving…' : status === 'error' ? (
              <>Could not save. Keep this window open and <button type="button"
                onClick={() => { for (const edit of pendingEdits.current.values()) void persist(edit); }}>retry</button>.</>
            ) : 'All changes saved'}
          </footer>
        )}
      </div>
    </dialog>
  );
}
