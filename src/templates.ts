import { db, normalizeReps, normalizeWeight, type DraftExercise, type Template } from './gainz-db';

/** Older templates may have only exerciseIds, or an incomplete draft payload. */
export function templateExercises(template: Template): DraftExercise[] {
  let stored: unknown;
  try { stored = JSON.parse(template.draftJson); } catch { stored = undefined; }
  const rows: unknown[] = stored && typeof stored === 'object' && 'exercises' in stored && Array.isArray(stored.exercises)
    ? stored.exercises : [];
  return [...new Set(template.exerciseIds)].filter(id => Number.isInteger(id) && id > 0).map(exerciseId => {
    const row = rows.find((entry): entry is { exerciseId: number; sets?: unknown } =>
      !!entry && typeof entry === 'object' && 'exerciseId' in entry && entry.exerciseId === exerciseId,
    );
    const sets = Array.isArray(row?.sets) ? row.sets : [];
    return {
      exerciseId,
      sets: (sets.length ? sets : [{}]).map(set => ({
        weightKg: typeof set?.weightKg === 'number' && Number.isFinite(set.weightKg) && set.weightKg >= 0 ? set.weightKg : 0,
        reps: typeof set?.reps === 'number' && Number.isFinite(set.reps) && set.reps >= 0 ? Math.round(set.reps) : 0,
      })),
    };
  });
}

/** Edit the template in place; never change a staged or active workout. */
export async function saveTemplate(id: number | undefined, name: string, exercises: DraftExercise[]): Promise<Template> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Enter a template name.');
  if (!exercises.length) throw new Error('Add at least one exercise.');
  const ids = exercises.map(exercise => exercise.exerciseId);
  if (ids.some(exerciseId => !Number.isInteger(exerciseId) || exerciseId <= 0)) throw new Error('Invalid exercise.');
  if (new Set(ids).size !== ids.length) throw new Error('Add each exercise only once.');
  const draft = {
    exercises: exercises.map(exercise => ({
      exerciseId: exercise.exerciseId,
      sets: (exercise.sets.length ? exercise.sets : [{ weightKg: 0, reps: 0 }]).map(set => ({
        weightKg: normalizeWeight(set.weightKg), reps: normalizeReps(set.reps),
      })),
    })),
  };

  return db.transaction('rw', db.templates, db.exercises, async () => {
    const existing = id === undefined ? undefined : await db.templates.get(id);
    if (id !== undefined && !existing) throw new Error('This template no longer exists.');
    if ((await db.exercises.bulkGet(ids)).some(exercise => !exercise)) {
      throw new Error('Remove exercises that are no longer in your library.');
    }
    const saved: Template = {
      ...existing, name: trimmedName, exerciseIds: ids,
      draftJson: JSON.stringify(draft), lastUsedAt: existing?.lastUsedAt ?? null,
    };
    saved.id = await db.templates.put(saved);
    return saved;
  });
}
