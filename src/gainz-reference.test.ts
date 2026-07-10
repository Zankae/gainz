import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  seedIfEmpty,
  normalizeQuarterKg,
  saveDraftWorkout,
  getDraftWorkout,
  startWorkout,
  finishWorkout,
  getActiveWorkout,
  chartRowsForExercise,
  exportBackup,
  restoreBackup,
} from './gainz-db';
import { buildCandles, hasWick, sessionsFromSets, candleLayout } from './gainz-candles';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('GAINZ reference data layer', () => {
  it('seeds all 104 exercises with non-indexed state flags', async () => {
    await seedIfEmpty();
    expect(await db.exercises.count()).toBe(104);
    const first = await db.exercises.orderBy('id').first();
    expect(first).toMatchObject({ custom: false, favorite: false, hidden: false, archived: false });
    expect(db.exercises.schema.indexes.map(i => i.name)).not.toContain('custom');
  });

  it('accepts Swedish decimal comma and normalizes to quarter kilos', () => {
    expect(normalizeQuarterKg('12,5')).toBe(12.5);
    expect(normalizeQuarterKg('12.37')).toBe(12.25);
    expect(() => normalizeQuarterKg('-1')).toThrow();
  });

  it('persists a draft and atomically converts it only when Start is pressed', async () => {
    await seedIfEmpty();
    const exercise = await db.exercises.orderBy('id').first();
    if (!exercise?.id) throw new Error('seed missing');

    await saveDraftWorkout({
      exercises: [{ exerciseId: exercise.id, sets: [{ weightKg: 12.5, reps: 10 }] }],
    });
    expect(await getActiveWorkout()).toBeUndefined();
    expect((await getDraftWorkout())?.exercises).toHaveLength(1);

    const id1 = await startWorkout();
    const id2 = await startWorkout();
    expect(id2).toBe(id1);
    expect((await getActiveWorkout())?.id).toBe(id1);
    expect(await getDraftWorkout()).toBeUndefined();
    expect(await db.workoutExercises.where('workoutId').equals(id1).count()).toBe(1);
    expect(await db.sets.where('workoutId').equals(id1).count()).toBe(1);
    expect(await chartRowsForExercise(exercise.id)).toHaveLength(0);

    await finishWorkout(id1);
    expect(await getActiveWorkout()).toBeUndefined();
    expect(await chartRowsForExercise(exercise.id)).toHaveLength(1);
  });


  it('discards zero-rep placeholders and refuses to finish an empty workout', async () => {
    await seedIfEmpty();
    const exercise = await db.exercises.orderBy('id').first();
    if (!exercise?.id) throw new Error('seed missing');

    await saveDraftWorkout({
      exercises: [{ exerciseId: exercise.id, sets: [{ weightKg: 20, reps: 0 }] }],
    });
    const emptyId = await startWorkout();
    await expect(finishWorkout(emptyId)).rejects.toThrow('Log at least one set');
    expect((await getActiveWorkout())?.id).toBe(emptyId);

    const emptyRow = await db.sets.where('workoutId').equals(emptyId).first();
    if (!emptyRow?.id) throw new Error('placeholder missing');
    await db.sets.update(emptyRow.id, { reps: 8 });
    const workoutExerciseId = emptyRow.workoutExerciseId;
    await db.sets.add({
      workoutExerciseId,
      workoutId: emptyId,
      exerciseId: exercise.id,
      performedAt: Date.now(),
      order: 1,
      weightKg: 20,
      reps: 0,
    });

    await finishWorkout(emptyId);
    const finishedRows = await db.sets.where('workoutId').equals(emptyId).toArray();
    expect(finishedRows).toHaveLength(1);
    expect(finishedRows[0].reps).toBe(8);
  });

  it('feeds chart sessions with the actual workout start and preserves decimal volume', async () => {
    await seedIfEmpty();
    const exercise = await db.exercises.orderBy('id').first();
    if (!exercise?.id) throw new Error('seed missing');
    const startedAt = new Date(2026, 6, 10, 23, 59).getTime();
    const workoutId = await db.workouts.add({ startedAt, endedAt: startedAt + 60_000 });
    const workoutExerciseId = await db.workoutExercises.add({ workoutId, exerciseId: exercise.id, order: 0 });
    await db.sets.add({
      workoutExerciseId,
      workoutId,
      exerciseId: exercise.id,
      performedAt: startedAt + 120_000,
      order: 0,
      weightKg: 7.25,
      reps: 3,
    });
    const rows = await chartRowsForExercise(exercise.id);
    const sessions = sessionsFromSets(rows);
    expect(sessions[0].at).toBe(startedAt);
    expect(sessions[0].volumeKg).toBe(21.75);
  });

  it('validates a restore before clearing and restores a valid backup', async () => {
    await seedIfEmpty();
    await expect(restoreBackup({ app: 'gainz', schemaVersion: 1 })).rejects.toThrow();
    expect(await db.exercises.count()).toBe(104);

    const backup = await exportBackup();
    await db.exercises.clear();
    expect(await db.exercises.count()).toBe(0);
    await restoreBackup(backup);
    expect(await db.exercises.count()).toBe(104);
  });
});

describe('GAINZ candle model', () => {
  it('keeps daily candles wickless and the series gapless', () => {
    const sessions = [
      { at: new Date(2026, 0, 1).getTime(), topWeightKg: 10, repsAtTopWeight: 8, sets: 2, volumeKg: 160 },
      { at: new Date(2026, 0, 3).getTime(), topWeightKg: 12, repsAtTopWeight: 6, sets: 2, volumeKg: 144 },
    ];
    const candles = buildCandles(sessions, 'Day', 'weight');
    expect(candles.every(c => !hasWick(c))).toBe(true);
    expect(candles[1].o).toBe(candles[0].c);
  });

  it('creates a weekly wick when an internal session escapes the body', () => {
    const sessions = [
      { at: new Date(2026, 0, 5).getTime(), topWeightKg: 10, repsAtTopWeight: 8, sets: 1, volumeKg: 80 },
      { at: new Date(2026, 0, 7).getTime(), topWeightKg: 15, repsAtTopWeight: 5, sets: 1, volumeKg: 75 },
      { at: new Date(2026, 0, 9).getTime(), topWeightKg: 12, repsAtTopWeight: 6, sets: 1, volumeKg: 72 },
    ];
    const [candle] = buildCandles(sessions, 'Week', 'weight');
    expect(hasWick(candle)).toBe(true);
    expect(candle.h).toBe(15);
  });

  it('scrolls instead of shrinking 365 candles below three pixels', () => {
    const layout = candleLayout(365, 320 - 46);
    expect(layout.scrolls).toBe(true);
    expect(layout.slot).toBe(3);
    expect(layout.labelEvery).toBeGreaterThan(1);
  });
});
