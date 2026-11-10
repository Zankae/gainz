import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, exportBackup, finishWorkout, restoreBackup, saveDraftWorkout, seedIfEmpty, startWorkout, type Template } from './gainz-db';
import { saveTemplate, templateExercises } from './templates';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('template editing', () => {
  it('updates the same template and preserves workouts, staged edits, favorites and settings', async () => {
    await seedIfEmpty();
    const [first, second, third] = await db.exercises.limit(3).toArray();
    await db.exercises.update(first.id!, { favorite: true });
    const draft = { exercises: [{ exerciseId: first.id!, sets: [{ weightKg: 25, reps: 8 }] }] };
    const finished = await startWorkout({ ...draft, updatedAt: 123 });
    await finishWorkout(finished);
    await startWorkout({ ...draft, updatedAt: 124 });
    await saveDraftWorkout(draft);
    await db.settings.put({ key: 'routineTemplates20261110', value: true });
    await db.bodyweight.add({ at: 123, kg: 72 });
    const id = await db.templates.add({ name: 'Original', exerciseIds: [first.id!, second.id!], draftJson: JSON.stringify(draft), lastUsedAt: 456 });
    const otherTables = db.tables.filter(table => table.name !== 'templates');
    const before = await Promise.all(otherTables.map(table => table.toArray()));
    const exercises = [
      { exerciseId: third.id!, sets: [{ weightKg: 0, reps: 0 }] },
      { exerciseId: first.id!, sets: [{ weightKg: 12.37, reps: 8 }, { weightKg: 0, reps: 0 }] },
    ];

    const saved = await saveTemplate(id, '  Renamed template  ', exercises);
    expect(saved).toMatchObject({ id, name: 'Renamed template', exerciseIds: [third.id!, first.id!], lastUsedAt: 456 });
    expect(templateExercises(saved)).toEqual(exercises);
    expect(await db.templates.count()).toBe(1);
    expect(await Promise.all(otherTables.map(table => table.toArray()))).toEqual(before);
    db.close();
    await db.open();
    expect(await db.templates.get(id)).toEqual(saved);
    const backup = await exportBackup();
    await db.templates.clear();
    await restoreBackup(backup);
    expect(await db.templates.get(id)).toEqual(saved);
  });

  it('creates a named template with unset weights and reps and at least one editable set', async () => {
    await seedIfEmpty();
    const exercise = await db.exercises.orderBy('id').first();
    const saved = await saveTemplate(undefined, '  New plan  ', [{ exerciseId: exercise!.id!, sets: [] }]);
    expect(saved.name).toBe('New plan');
    expect(saved.lastUsedAt).toBeNull();
    expect(templateExercises(saved)).toEqual([{ exerciseId: exercise!.id!, sets: [{ weightKg: 0, reps: 0 }] }]);
    expect(await db.workouts.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
    expect(await db.settings.count()).toBe(0);
  });

  it('rejects invalid edits and missing records without partially saving or recreating a deleted template', async () => {
    await seedIfEmpty();
    const exercise = await db.exercises.orderBy('id').first();
    const entry = { exerciseId: exercise!.id!, sets: [{ weightKg: 0, reps: 0 }] };
    const saved = await saveTemplate(undefined, 'Keep this', [entry]);
    await expect(saveTemplate(saved.id, ' ', [entry])).rejects.toThrow('name');
    await expect(saveTemplate(saved.id, 'Empty', [])).rejects.toThrow('at least one');
    await expect(saveTemplate(saved.id, 'Duplicates', [entry, entry])).rejects.toThrow('only once');
    await expect(saveTemplate(saved.id, 'Missing exercise', [{ ...entry, exerciseId: 99999 }])).rejects.toThrow('no longer in your library');
    await expect(saveTemplate(saved.id, 'Bad weight', [{ ...entry, sets: [{ weightKg: -1, reps: 8 }] }])).rejects.toThrow();
    await expect(saveTemplate(saved.id, 'Bad reps', [{ ...entry, sets: [{ weightKg: 20, reps: NaN }] }])).rejects.toThrow();
    expect(await db.templates.toArray()).toEqual([saved]);
    await db.templates.delete(saved.id!);
    await expect(saveTemplate(saved.id, 'Deleted', [entry])).rejects.toThrow('no longer exists');
    expect(await db.templates.count()).toBe(0);
  });
});

describe('legacy template loading', () => {
  const template: Template = { name: 'Legacy', exerciseIds: [2, 1], draftJson: '', lastUsedAt: null };

  it.each(['', 'broken JSON', '{}', '{"exercises":null}'])('loads ID-only templates with missing or malformed drafts: %s', draftJson => {
    expect(templateExercises({ ...template, draftJson })).toEqual([
      { exerciseId: 2, sets: [{ weightKg: 0, reps: 0 }] },
      { exerciseId: 1, sets: [{ weightKg: 0, reps: 0 }] },
    ]);
  });

  it('keeps saved exercise order and valid values while repairing incomplete legacy set rows', () => {
    expect(templateExercises({ ...template, draftJson: JSON.stringify({ exercises: [
      { exerciseId: 1, sets: [{ weightKg: 12.37, reps: 8 }, null, { weightKg: -5, reps: 'bad' }] },
      { exerciseId: 999, sets: [{ weightKg: 50, reps: 10 }] },
    ] }) })).toEqual([
      { exerciseId: 2, sets: [{ weightKg: 0, reps: 0 }] },
      { exerciseId: 1, sets: [{ weightKg: 12.37, reps: 8 }, { weightKg: 0, reps: 0 }, { weightKg: 0, reps: 0 }] },
    ]);
  });
});
