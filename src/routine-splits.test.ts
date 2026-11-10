import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, exportBackup, restoreBackup } from './gainz-db';
import { getRoutineSplits, saveRoutineCell } from './routine-splits';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('routine splits persistence', () => {
  it('starts with empty cells in a fixed Monday–Sunday week without writing defaults', async () => {
    const routine = await getRoutineSplits();
    expect(Object.keys(routine)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(Object.values(routine)).toEqual(Array.from({ length: 7 }, () => ({ muscleGroups: '', notes: '' })));
    expect(await db.settings.count()).toBe(0);
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
    expect(Object.values(await getRoutineSplits()).every(row => row.muscleGroups === '' && row.notes === '')).toBe(true);
  });

  it('ignores unknown days and non-text cells in restored settings', async () => {
    await db.settings.put({ key: 'routineSplits', value: {
      Sunday: { muscleGroups: 'Legs', notes: 123 },
      Monday: { muscleGroups: null, notes: 'Rest' },
      Someday: { muscleGroups: 'Arms', notes: '' },
    } });
    const routine = await getRoutineSplits();
    expect(Object.keys(routine)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(routine.Monday).toEqual({ muscleGroups: '', notes: 'Rest' });
    expect(routine.Sunday).toEqual({ muscleGroups: 'Legs', notes: '' });
  });
});
