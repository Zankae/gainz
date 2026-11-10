import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, exportBackup, getActiveWorkout, restoreBackup, saveDraftWorkout, seedIfEmpty } from './gainz-db';
import { ensureRoutineTemplates, ROUTINE_TEMPLATE_PLANS } from './routine-templates';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

async function addMatchingFavorites() {
  const unique = new Map(ROUTINE_TEMPLATE_PLANS.flatMap(plan => plan.exercises).map(exercise =>
    [`${exercise.name}:${exercise.equipment}`, exercise] as const,
  ));
  await db.exercises.bulkAdd([...unique.values()].map((exercise, index) => ({
    id: 900 + index, name: exercise.name, equipment: exercise.equipment, group: 'Full body',
    perHand: exercise.equipment === 'dumbbell', custom: true, favorite: true, hidden: false, archived: false,
  })));
}

describe('five routine templates', () => {
  it('atomically installs five days using current favorite IDs while leaving existing data untouched', async () => {
    await seedIfEmpty(); // Unhearted factory exercises must never be selected.
    await addMatchingFavorites();
    await db.templates.add({ name: 'My existing template', exerciseIds: [900], draftJson: '{}', lastUsedAt: 123 });
    await db.workouts.add({ startedAt: 1234, endedAt: 0 });
    await db.bodyweight.add({ at: 1234, kg: 70 });
    await saveDraftWorkout({ exercises: [{ exerciseId: 900, sets: [{ weightKg: 12, reps: 8 }] }] });
    await db.settings.put({ key: 'routineSplits', value: { Tuesday: { muscleGroups: 'Custom text', notes: 'Keep' } } });
    const tables = db.tables.filter(table => table.name !== 'templates' && table.name !== 'settings');
    const before = await Promise.all(tables.map(table => table.toArray()));
    const settings = await db.settings.toArray();

    expect(await Promise.all([ensureRoutineTemplates(), ensureRoutineTemplates()])).toEqual([[], []]);
    const templates = await db.templates.toArray();
    expect(templates).toHaveLength(6);
    expect(templates[0]).toMatchObject({ name: 'My existing template', lastUsedAt: 123 });
    expect(templates.slice(1).map(template => template.name.split(' — ')[0])).toEqual(['Tuesday', 'Wednesday', 'Thursday', 'Saturday', 'Sunday']);
    for (const template of templates.slice(1)) {
      expect(new Set(template.exerciseIds).size).toBe(template.exerciseIds.length);
      const draft = JSON.parse(template.draftJson);
      expect(draft.exercises.map((exercise: { exerciseId: number }) => exercise.exerciseId)).toEqual(template.exerciseIds);
      for (const entry of draft.exercises) {
        expect(entry.exerciseId).toBeGreaterThanOrEqual(900);
        expect(await db.exercises.get(entry.exerciseId)).toMatchObject({ favorite: true, hidden: false, archived: false });
        expect(entry.sets.length).toBeGreaterThan(0);
        expect(entry.sets.every((set: { weightKg: number; reps: number }) => set.weightKg === 0 && set.reps === 0)).toBe(true);
      }
    }
    expect(await Promise.all(tables.map(table => table.toArray()))).toEqual(before);
    for (const setting of settings) expect(await db.settings.get(setting.key)).toEqual(setting);
  });

  it.each(['favorite', 'hidden', 'archived'] as const)('does not substitute an unavailable exercise (%s) or install partial templates', async flag => {
    await addMatchingFavorites();
    const exercise = await db.exercises.get(900);
    await db.exercises.update(900, { [flag]: flag !== 'favorite' });
    expect(await ensureRoutineTemplates()).toContain(exercise!.name);
    expect(await db.templates.count()).toBe(0);
    expect(await db.settings.get('routineTemplates20261110')).toBeUndefined();
    expect(await getActiveWorkout()).toBeUndefined();
    await db.exercises.update(900, { [flag]: flag === 'favorite' });
    expect(await ensureRoutineTemplates()).toEqual([]);
    expect(await db.templates.count()).toBe(5);
  });

  it('preserves edited and deleted templates across app reopening and backup restore', async () => {
    await addMatchingFavorites();
    await ensureRoutineTemplates();
    const templates = await db.templates.toArray();
    await db.templates.update(templates[0].id!, { name: 'My customized Tuesday', draftJson: '{"exercises":[]}' });
    await db.templates.delete(templates[1].id!);
    const expected = await db.templates.toArray();
    db.close();
    await db.open();
    await ensureRoutineTemplates();
    expect(await db.templates.toArray()).toEqual(expected);
    const backup = await exportBackup();
    await db.templates.clear();
    await restoreBackup(backup);
    await ensureRoutineTemplates();
    expect(await db.templates.toArray()).toEqual(expected);
  });

  it('does not duplicate or overwrite named templates restored without the installation marker', async () => {
    await addMatchingFavorites();
    await ensureRoutineTemplates();
    const templates = await db.templates.toArray();
    await db.templates.update(templates[0].id!, { draftJson: '{"exercises":[]}', lastUsedAt: 456 });
    const expected = await db.templates.toArray();
    await db.settings.delete('routineTemplates20261110');
    await ensureRoutineTemplates();
    expect(await db.templates.toArray()).toEqual(expected);
  });
});
