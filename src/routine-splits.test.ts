import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, exportBackup, restoreBackup } from './gainz-db';
import { getRoutineSplits, saveRoutineCell } from './routine-splits';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

const expectedMuscleGroups = [
  'Rest',
  'Chest + biceps + rear shoulders',
  'Legs + side shoulders + calves + abs',
  'Back + triceps + traps + forearms',
  'Rest',
  'Shoulders first, then chest + back + biceps + triceps',
  'Legs + calves + abs',
];

describe('routine splits persistence', () => {
  it('prefills the exact image routine in a fixed Monday–Sunday week with blank notes', async () => {
    const routine = await getRoutineSplits();
    expect(Object.keys(routine)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(Object.values(routine)).toEqual(expectedMuscleGroups.map(muscleGroups => ({ muscleGroups, notes: '' })));
    db.close();
    await db.open();
    expect(await getRoutineSplits()).toEqual(routine);
  });

  it('fills previously saved empty cells once while preserving existing edits and notes', async () => {
    await db.settings.put({ key: 'routineSplits', value: {
      Monday: { muscleGroups: '', notes: 'Walk outside' },
      Tuesday: { muscleGroups: 'My custom split', notes: '' },
      Friday: { muscleGroups: '   ', notes: '' },
    } });
    const routine = await getRoutineSplits();
    expect(routine.Monday).toEqual({ muscleGroups: 'Rest', notes: 'Walk outside' });
    expect(routine.Tuesday.muscleGroups).toBe('My custom split');
    expect(routine.Friday.muscleGroups).toBe('Rest');
    expect(routine.Saturday.muscleGroups).toBe(expectedMuscleGroups[5]);

    await saveRoutineCell('Monday', 'muscleGroups', '');
    await saveRoutineCell('Sunday', 'muscleGroups', 'Custom Sunday');
    db.close();
    await db.open();
    expect((await getRoutineSplits()).Monday.muscleGroups).toBe('');
    expect((await getRoutineSplits()).Sunday.muscleGroups).toBe('Custom Sunday');

    const backup = await exportBackup();
    await db.settings.clear();
    await restoreBackup(backup);
    expect((await getRoutineSplits()).Monday.muscleGroups).toBe('');
    expect((await getRoutineSplits()).Sunday.muscleGroups).toBe('Custom Sunday');
  });

  it('keeps the latest fast edits across cells without changing unrelated data', async () => {
    await db.settings.put({ key: 'profileName', value: 'Lifter' });
    const workoutId = await db.workouts.add({ startedAt: 1234, endedAt: 0 });
    await Promise.all([
      saveRoutineCell('Monday', 'muscleGroups', 'C'),
      saveRoutineCell('Monday', 'muscleGroups', 'Chest'),
      saveRoutineCell('Monday', 'notes', 'Start light\nThen add weight'),
      saveRoutineCell('Sunday', 'muscleGroups', 'Legs + calves'),
    ]);
    db.close();
    await db.open();
    const routine = await getRoutineSplits();
    expect(routine.Monday).toEqual({ muscleGroups: 'Chest', notes: 'Start light\nThen add weight' });
    expect(routine.Sunday.muscleGroups).toBe('Legs + calves');
    expect(await db.settings.get('profileName')).toEqual({ key: 'profileName', value: 'Lifter' });
    expect(await db.workouts.get(workoutId)).toEqual({ id: workoutId, startedAt: 1234, endedAt: 0 });
  });

  it('includes the routine in backups, restores it, and persists cleared cells', async () => {
    await saveRoutineCell('Wednesday', 'notes', 'Rest 💤\n<not markup>');
    const backup = await exportBackup();
    await saveRoutineCell('Wednesday', 'notes', 'Changed');
    await restoreBackup(backup);
    expect((await getRoutineSplits()).Wednesday.notes).toBe('Rest 💤\n<not markup>');
    await saveRoutineCell('Wednesday', 'notes', '');
    db.close();
    await db.open();
    expect((await getRoutineSplits()).Wednesday.notes).toBe('');

    // Backups created before this feature have no routine setting.
    await restoreBackup({ ...backup, settings: [] });
    expect(Object.values(await getRoutineSplits())).toEqual(expectedMuscleGroups.map(muscleGroups => ({ muscleGroups, notes: '' })));
  });

  it('ignores unknown days and non-text cells in restored settings', async () => {
    await db.settings.put({ key: 'routineSplits', value: {
      Sunday: { muscleGroups: 'Legs', notes: 123 },
      Monday: { muscleGroups: null, notes: 'Rest' },
      Someday: { muscleGroups: 'Arms', notes: '' },
    } });
    const routine = await getRoutineSplits();
    expect(Object.keys(routine)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(routine.Monday).toEqual({ muscleGroups: 'Rest', notes: 'Rest' });
    expect(routine.Sunday).toEqual({ muscleGroups: 'Legs', notes: '' });
  });
});
