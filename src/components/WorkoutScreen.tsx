import { useState, useEffect, useCallback, useRef } from 'react';
import {
  db,
  getActiveWorkout,
  getDraftWorkout,
  saveDraftWorkout,
  startWorkout,
  finishWorkout,
  lastPerformance,
  type Exercise,
  type Workout,
  type SetEntry,
  type DraftExercise,
} from '../gainz-db';
import StepperInput from './StepperInput';
import ExercisePicker from './ExercisePicker';
import RestTimer from './RestTimer';
import ConfirmDialog from './ConfirmDialog';

interface LocalSet {
  id?: number;
  weightKg: number;
  reps: number;
}

interface LocalExercise {
  exerciseId: number;
  exercise: Exercise;
  weId?: number;  // workoutExerciseId for direct DB access
  sets: LocalSet[];
  lastTime: SetEntry[] | null;
  lastTimeLoading: boolean;
}

export default function WorkoutScreen() {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<LocalExercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void; destructive?: boolean } | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{ startedAt: number; endedAt: number; setCount: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Load state on mount ---
  useEffect(() => {
    (async () => {
      const active = await getActiveWorkout();
      if (active) {
        setWorkout(active);
        await loadWorkoutExercises(active.id!);
      } else {
        const draft = await getDraftWorkout();
        if (draft) {
          await loadDraft(draft);
        }
      }
    })();
  }, []);

  // --- Timer for active workouts ---
  useEffect(() => {
    if (workout && workout.endedAt === 0) {
      const update = () => setElapsed(Date.now() - workout.startedAt);
      update();
      timerRef.current = setInterval(update, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
  }, [workout]);

  const loadWorkoutExercises = async (workoutId: number) => {
    const wes = await db.workoutExercises.where('workoutId').equals(workoutId).sortBy('order');
    const loaded: LocalExercise[] = [];
    for (const we of wes) {
      const exercise = await db.exercises.get(we.exerciseId);
      if (!exercise) continue;
      const sets = await db.sets.where('workoutExerciseId').equals(we.id!).sortBy('order');
      const last = await lastPerformance(we.exerciseId, workoutId);
      loaded.push({
        exerciseId: we.exerciseId,
        exercise,
        weId: we.id,
        sets: sets.map(s => ({ id: s.id, weightKg: s.weightKg, reps: s.reps })),
        lastTime: last.length ? last : null,
        lastTimeLoading: false,
      });
    }
    setExercises(loaded);
  };

  const loadDraft = async (draft: { exercises: DraftExercise[] }) => {
    const loaded: LocalExercise[] = [];
    for (const de of draft.exercises) {
      const exercise = await db.exercises.get(de.exerciseId);
      if (!exercise) continue;
      const last = await lastPerformance(de.exerciseId);
      loaded.push({
        exerciseId: de.exerciseId,
        exercise,
        sets: de.sets.map(s => ({ weightKg: s.weightKg, reps: s.reps })),
        lastTime: last.length ? last : null,
        lastTimeLoading: false,
      });
    }
    setExercises(loaded);
  };

  // --- Persist draft after every edit (when no active workout) ---
  const persistDraftIfNeeded = useCallback(async (exs: LocalExercise[]) => {
    if (workout) return; // Active workout — sets are written to DB directly
    const draft = {
      exercises: exs.map(e => ({
        exerciseId: e.exerciseId,
        sets: e.sets.map(s => ({ weightKg: s.weightKg, reps: s.reps })),
      })),
    };
    await saveDraftWorkout(draft);
  }, [workout]);

  // --- Exercise operations ---
  const addExercise = async (exercise: Exercise) => {
    const last = await lastPerformance(exercise.id!);
    const newEx: LocalExercise = {
      exerciseId: exercise.id!,
      exercise,
      sets: [{ weightKg: 0, reps: 0 }],
      lastTime: last.length ? last : null,
      lastTimeLoading: false,
    };

    if (workout && workout.endedAt === 0) {
      // Active workout — persist to DB immediately
      const weId = await db.workoutExercises.add({
        workoutId: workout.id!,
        exerciseId: exercise.id!,
        order: exercises.length,
      });
      const setId = await db.sets.add({
        workoutExerciseId: weId,
        workoutId: workout.id!,
        exerciseId: exercise.id!,
        performedAt: Date.now(),
        order: 0,
        weightKg: 0,
        reps: 0,
      });
      newEx.sets[0].id = setId;
      newEx.weId = weId;
    }

    const newExs = [...exercises, newEx];
    setExercises(newExs);
    setShowPicker(false);
    await persistDraftIfNeeded(newExs);
  };

  const removeExercise = (index: number) => {
    setConfirm({
      title: 'Remove Exercise',
      message: `Remove ${exercises[index].exercise.name} from this workout?`,
      destructive: true,
      onConfirm: async () => {
        const removed = exercises[index];
        const newExs = exercises.filter((_, i) => i !== index);
        setExercises(newExs);
        setConfirm(null);

        // If active workout, also delete from DB
        if (workout && removed.weId) {
          await db.sets.where('workoutExerciseId').equals(removed.weId).delete();
          await db.workoutExercises.delete(removed.weId);
        } else {
          await persistDraftIfNeeded(newExs);
        }
      },
    });
  };

  const updateSet = async (exIndex: number, setIndex: number, field: 'weightKg' | 'reps', value: number) => {
    const newExs = [...exercises];
    newExs[exIndex] = { ...newExs[exIndex], sets: [...newExs[exIndex].sets] };
    newExs[exIndex].sets[setIndex] = { ...newExs[exIndex].sets[setIndex], [field]: value };
    setExercises(newExs);

    // If active workout, persist to DB
    if (workout && newExs[exIndex].sets[setIndex].id) {
      await db.sets.update(newExs[exIndex].sets[setIndex].id!, { [field]: value });
    } else {
      await persistDraftIfNeeded(newExs);
    }
  };

  const addSet = async (exIndex: number) => {
    const newExs = [...exercises];
    const prevSets = newExs[exIndex].sets;
    const lastSet = prevSets[prevSets.length - 1];
    const newSet: LocalSet = { weightKg: lastSet.weightKg, reps: lastSet.reps };

    if (workout) {
      // Use stored workoutExerciseId for reliable DB access
      const weId = newExs[exIndex].weId;
      if (weId) {
        const id = await db.sets.add({
          workoutExerciseId: weId,
          workoutId: workout.id!,
          exerciseId: newExs[exIndex].exerciseId,
          performedAt: Date.now(),
          order: prevSets.length,
          weightKg: newSet.weightKg,
          reps: newSet.reps,
        });
        newSet.id = id;
      }
    }

    newExs[exIndex] = { ...newExs[exIndex], sets: [...prevSets, newSet] };
    setExercises(newExs);
    if (!workout) await persistDraftIfNeeded(newExs);
  };

  const deleteSet = async (exIndex: number, setIndex: number) => {
    const ex = exercises[exIndex];
    if (ex.sets.length <= 1) return; // Must keep at least one set
    const newExs = [...exercises];
    const removed = newExs[exIndex].sets[setIndex];
    newExs[exIndex] = { ...ex, sets: ex.sets.filter((_, i) => i !== setIndex) };
    setExercises(newExs);

    if (removed.id && workout) {
      await db.sets.delete(removed.id);
    } else if (!workout) {
      await persistDraftIfNeeded(newExs);
    }
  };

  const useLastTime = async (exIndex: number) => {
    const ex = exercises[exIndex];
    const last = await lastPerformance(ex.exerciseId);
    if (!last.length) return;
    const newExs = [...exercises];
    newExs[exIndex] = {
      ...ex,
      sets: last.map(s => ({ id: undefined, weightKg: s.weightKg, reps: s.reps })),
      lastTime: last,
    };
    setExercises(newExs);
    if (!workout) await persistDraftIfNeeded(newExs);
  };

  // --- Start workout ---
  const handleStart = async () => {
    if (exercises.length === 0) return;
    // Convert current exercises to draft, then start
    const draftExercises = exercises.map(e => ({
      exerciseId: e.exerciseId,
      sets: e.sets.map(s => ({ weightKg: s.weightKg, reps: s.reps })),
    }));
    const draft = { exercises: draftExercises, updatedAt: Date.now() };
    await saveDraftWorkout(draft);
    const workoutId = await startWorkout(draft);
    const w = await db.workouts.get(workoutId);
    if (w) {
      setWorkout(w);
      await loadWorkoutExercises(workoutId);
    }
  };

  // --- Finish workout ---
  const handleFinish = async () => {
    if (!workout) return;
    // Check if there are any real sets
    const allSets = await db.sets.where('workoutId').equals(workout.id!).toArray();
    const hasRealSets = allSets.some(s => s.reps > 0);

    if (!hasRealSets) {
      setConfirm({
        title: 'End Workout',
        message: 'No exercises added & nothing to log. End this workout?',
        destructive: true,
        onConfirm: async () => {
          // Delete all rows for this workout
          await db.sets.where('workoutId').equals(workout.id!).delete();
          await db.workoutExercises.where('workoutId').equals(workout.id!).delete();
          await db.workouts.delete(workout.id!);
          setWorkout(null);
          setExercises([]);
          setConfirm(null);
        },
      });
      return;
    }

    try {
      await finishWorkout(workout.id!);
      const endedAt = Date.now();
      const completedSets = allSets.filter(s => s.reps > 0).length;
      setSummaryData({ startedAt: workout.startedAt, endedAt, setCount: completedSets });
      setShowSummary(true);
      setWorkout(null);
    } catch (err) {
      setConfirm({
        title: 'Cannot Finish',
        message: err instanceof Error ? err.message : 'Something went wrong',
        destructive: false,
        onConfirm: () => setConfirm(null),
      });
    }
  };

  // --- Format duration ---
  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const isRunning = !!workout && workout.endedAt === 0;

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Start / Finish bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>
          {isRunning ? formatDuration(elapsed) : 'Not started'}
        </div>
        {isRunning ? (
          <button
            onClick={handleFinish}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius)',
              background: 'var(--gain)',
              color: 'var(--on-gain)',
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '.02em',
            }}
          >
            FINISH ✓
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={exercises.length === 0}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '.02em',
            }}
          >
            START ▶
          </button>
        )}
      </div>

      <RestTimer />

      {/* Exercises */}
      <div style={{ padding: '8px 0' }}>
        {exercises.map((ex, exIndex) => (
          <div
            key={`${ex.exerciseId}-${exIndex}`}
            style={{
              margin: '0 12px 12px',
              borderRadius: 'var(--radius)',
              background: 'var(--surface)',
              overflow: 'hidden',
            }}
          >
            {/* Exercise header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px 8px',
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{ex.exercise.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                  {ex.exercise.group}
                  {ex.exercise.perHand ? ' · kg each' : ' · kg total'}
                </div>
              </div>
              <button
                onClick={() => removeExercise(exIndex)}
                style={{ fontSize: 18, color: 'var(--loss)', padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* Last Time strip */}
            {ex.lastTime && ex.lastTime.length > 0 && (
              <div style={{
                margin: '0 14px 10px',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-2)',
              }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                  Last time
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ex.lastTime.map((s, i) => (
                    <span key={i} style={{ fontSize: 12, color: 'var(--text)' }}>
                      {s.weightKg.toFixed(2)} × {s.reps}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sets */}
            {ex.sets.map((set, setIndex) => (
              <div
                key={setIndex}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 14px',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 36, fontFamily: 'var(--font-display)' }}>
                  SET {setIndex + 1}
                </span>
                <StepperInput
                  mode="weight"
                  value={set.weightKg}
                  onChange={(v) => updateSet(exIndex, setIndex, 'weightKg', v)}
                />
                <StepperInput
                  mode="reps"
                  value={set.reps}
                  onChange={(v) => updateSet(exIndex, setIndex, 'reps', v)}
                />
                <button
                  onClick={() => deleteSet(exIndex, setIndex)}
                  disabled={ex.sets.length <= 1}
                  style={{
                    fontSize: 16,
                    color: 'var(--loss)',
                    padding: 4,
                    opacity: ex.sets.length <= 1 ? 0.2 : 1,
                  }}
                >
                  🗑
                </button>
              </div>
            ))}

            {/* Set actions */}
            <div style={{
              display: 'flex',
              gap: 8,
              padding: '8px 14px 12px',
              borderTop: '1px solid var(--border)',
            }}>
              <button
                onClick={() => addSet(exIndex)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-dim)',
                  color: 'var(--accent)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                + Add Set
              </button>
              <button
                onClick={() => useLastTime(exIndex)}
                disabled={!ex.lastTime?.length}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-2)',
                  color: ex.lastTime?.length ? 'var(--text)' : 'var(--muted)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Use Last Time
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Exercise button */}
      {exercises.length === 0 && !isRunning && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            Add exercises to get started
          </div>
        </div>
      )}

      <button
        onClick={() => setShowPicker(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: 'calc(100% - 24px)',
          margin: '0 12px 24px',
          padding: '14px 0',
          borderRadius: 'var(--radius)',
          border: '2px dashed var(--border)',
          color: 'var(--muted)',
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        + Add Exercise
      </button>

      {/* Exercise Picker */}
      {showPicker && (
        <ExercisePicker
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={addExercise}
          selectedIds={new Set(exercises.map(e => e.exerciseId))}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmLabel={confirm?.destructive ? 'Remove' : 'OK'}
        destructive={confirm?.destructive}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />

      {/* Finish Summary */}
      {showSummary && summaryData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(0,0,0,.5)',
          }}
          onClick={() => setShowSummary(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              padding: 24,
              maxWidth: 340,
              width: '100%',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>💪</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 12 }}>
              Workout Complete
            </h3>
            <div style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.8 }}>
              <div>
                {new Date(summaryData.startedAt).toLocaleDateString()}{' '}
                {new Date(summaryData.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' — '}
                {new Date(summaryData.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div>Duration: {formatDuration(summaryData.endedAt - summaryData.startedAt)}</div>
              <div>{summaryData.setCount} completed sets</div>
            </div>
            <button
              onClick={() => { setShowSummary(false); setExercises([]); }}
              style={{
                marginTop: 20,
                padding: '12px 32px',
                borderRadius: 'var(--radius)',
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


