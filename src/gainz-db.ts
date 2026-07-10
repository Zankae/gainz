/* ============================================================
   GAINZ — data layer (Dexie / IndexedDB)
   Build this BEFORE any UI. Every screen reads from here.

   Decisions baked in:

   1. `endedAt: 0` means "this workout is still running".
      IndexedDB cannot index null or undefined: a row whose indexed
      key is null does not appear in that index. Use 0 as the sentinel.

   2. Active-workout sets are written to disk when entered, never
      batched until Finish. A staged, not-yet-started workout is also
      persisted in IndexedDB under the `draftWorkout` setting.

   3. Boolean values are not valid IndexedDB keys. `custom`, `favorite`,
      `hidden`, `archived` and `perHand` are deliberately NOT indexes.
      Filter those flags in memory.
   ============================================================ */

import Dexie, { type Table } from 'dexie';
import seed from './gainz-exercises.json';

export const CURRENT_SCHEMA_VERSION = 1;

export type MuscleGroup =
  | 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Forearms'
  | 'Quadriceps' | 'Hamstrings' | 'Glutes' | 'Calves' | 'Abdominals'
  | 'Traps' | 'Full body';

export type Equipment =
  | 'barbell' | 'dumbbell' | 'cable' | 'machine'
  | 'smith' | 'plate' | 'bodyweight' | 'other';

export interface Exercise {
  id?: number;
  name: string;
  group: MuscleGroup;
  equipment: Equipment;
  /** true = the logged weight is ONE dumbbell. Label only; never a multiplier. */
  perHand: boolean;
  /** false for everything seeded from gainz-exercises.json */
  custom: boolean;
  /** user preference shown near the top of the exercise picker */
  favorite: boolean;
  /** reversible: omitted from normal pickers, still available in management */
  hidden: boolean;
  /** historical references exist, so the exercise cannot be hard-deleted */
  archived: boolean;
}

export interface Workout {
  id?: number;
  startedAt: number;
  /** 0 while the workout is running. Never null. */
  endedAt: number;
}

export interface WorkoutExercise {
  id?: number;
  workoutId: number;
  exerciseId: number;
  /** display order within the workout; supports Reorder Exercises */
  order: number;
}

export interface SetEntry {
  id?: number;
  workoutExerciseId: number;
  /** denormalised so a whole workout can be read without a join */
  workoutId: number;
  /** denormalised so the progress chart can hit one compound index */
  exerciseId: number;
  performedAt: number;
  order: number;
  /** exactly the number shown in the UI. Always a multiple of 0.25. */
  weightKg: number;
  reps: number;
}

export interface BodyweightEntry {
  id?: number;
  at: number;
  kg: number;
}

export interface Template {
  id?: number;
  name: string;
  exerciseIds: number[];
  lastUsedAt: number | null; // not indexed, so null is safe here
}

export interface DraftSet {
  weightKg: number;
  reps: number;
}

export interface DraftExercise {
  exerciseId: number;
  sets: DraftSet[];
}

/** A not-yet-started workout. Loading a template/history row writes this only. */
export interface DraftWorkout {
  exercises: DraftExercise[];
  updatedAt: number;
}

/** Known keys include theme, profile fields, backup time and draftWorkout. */
export interface Setting {
  key: string;
  value: unknown;
}

class GainzDB extends Dexie {
  exercises!: Table<Exercise, number>;
  workouts!: Table<Workout, number>;
  workoutExercises!: Table<WorkoutExercise, number>;
  sets!: Table<SetEntry, number>;
  bodyweight!: Table<BodyweightEntry, number>;
  templates!: Table<Template, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('gainz');
    this.version(1).stores({
      // Do not index Boolean flags: Boolean is not a valid IndexedDB key.
      exercises:        '++id, name, group, equipment',
      workouts:         '++id, startedAt, endedAt',
      workoutExercises: '++id, workoutId, exerciseId, [workoutId+order]',
      sets:              '++id, workoutExerciseId, workoutId, exerciseId, [exerciseId+performedAt]',
      bodyweight:        '++id, at',
      templates:         '++id, name',
      settings:          'key',
    });
  }
}

export const db = new GainzDB();

/* ---------- validated numeric values ---------- */

/** Accept Android locale decimals ("12,5" or "12.5") and store quarter-kilo values. */
export function normalizeQuarterKg(value: number | string): number {
  const parsed = typeof value === 'number'
    ? value
    : Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Weight must be a finite, non-negative number');
  }
  return Math.round((parsed + Number.EPSILON) * 4) / 4;
}

export function normalizeReps(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Repetitions must be a finite, non-negative number');
  }
  return Math.round(parsed);
}

/** Volume for one set is weightKg * reps. Nothing else, ever. */
export function setVolumeKg(weightKg: number, reps: number): number {
  return weightKg * reps;
}

/* ---------- staged workout ---------- */

const DRAFT_KEY = 'draftWorkout';

export async function getDraftWorkout(): Promise<DraftWorkout | undefined> {
  const row = await db.settings.get(DRAFT_KEY);
  if (!row || !isRecord(row.value) || !Array.isArray(row.value.exercises)) return undefined;
  return row.value as unknown as DraftWorkout;
}

export async function saveDraftWorkout(
  draft: Omit<DraftWorkout, 'updatedAt'> | DraftWorkout,
): Promise<void> {
  const value: DraftWorkout = {
    exercises: draft.exercises.map(exercise => ({
      exerciseId: exercise.exerciseId,
      sets: (exercise.sets.length ? exercise.sets : [{ weightKg: 0, reps: 0 }]).map(set => ({
        weightKg: normalizeQuarterKg(set.weightKg),
        reps: normalizeReps(set.reps),
      })),
    })),
    updatedAt: Date.now(),
  };
  await db.settings.put({ key: DRAFT_KEY, value });
}

export async function clearDraftWorkout(): Promise<void> {
  await db.settings.delete(DRAFT_KEY);
}

/* ---------- the active workout ---------- */

export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.where('endedAt').equals(0).first();
}

/**
 * A workout begins ONLY here. The transaction prevents a double-tap from
 * creating two active workouts and atomically converts the persisted draft
 * into real workout rows. Loading a template or old workout must never call
 * this function until the user explicitly presses Start.
 */
export async function startWorkout(draftOverride?: DraftWorkout): Promise<number> {
  return db.transaction(
    'rw',
    db.workouts,
    db.workoutExercises,
    db.sets,
    db.settings,
    async () => {
      const existing = await db.workouts.where('endedAt').equals(0).first();
      if (existing?.id) return existing.id;

      const startedAt = Date.now();
      const workoutId = await db.workouts.add({ startedAt, endedAt: 0 });
      const draft = draftOverride ?? await getDraftWorkout();
      let sequence = 0;

      if (draft) {
        for (const [exerciseOrder, draftExercise] of draft.exercises.entries()) {
          const workoutExerciseId = await db.workoutExercises.add({
            workoutId,
            exerciseId: draftExercise.exerciseId,
            order: exerciseOrder,
          });
          const sourceSets = draftExercise.sets.length
            ? draftExercise.sets
            : [{ weightKg: 0, reps: 0 }];
          await db.sets.bulkAdd(sourceSets.map((set, setOrder) => ({
            workoutExerciseId,
            workoutId,
            exerciseId: draftExercise.exerciseId,
            performedAt: startedAt + sequence++,
            order: setOrder,
            weightKg: normalizeQuarterKg(set.weightKg),
            reps: normalizeReps(set.reps),
          })));
        }
      }

      await db.settings.delete(DRAFT_KEY);
      return workoutId;
    },
  );
}

/**
 * Finish is the commit boundary for history. Every remaining row with reps > 0
 * is treated as performed; zero-rep placeholder rows are discarded. An empty
 * workout is kept active so the user can add a real set or explicitly abandon it.
 */
export async function finishWorkout(workoutId: number): Promise<void> {
  await db.transaction('rw', db.workouts, db.workoutExercises, db.sets, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout) throw new Error('Workout not found');
    if (workout.endedAt !== 0) throw new Error('Workout is already finished');

    const rows = await db.sets.where('workoutId').equals(workoutId).toArray();
    const completed = rows.filter(row => row.reps > 0);
    if (!completed.length) {
      throw new Error('Log at least one set before finishing the workout');
    }

    const placeholderIds = rows
      .filter(row => row.reps <= 0 && row.id !== undefined)
      .map(row => row.id as number);
    if (placeholderIds.length) await db.sets.bulkDelete(placeholderIds);

    const exerciseRows = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
    const usedWorkoutExerciseIds = new Set(completed.map(row => row.workoutExerciseId));
    const emptyExerciseIds = exerciseRows
      .filter(row => row.id !== undefined && !usedWorkoutExerciseIds.has(row.id))
      .map(row => row.id as number);
    if (emptyExerciseIds.length) await db.workoutExercises.bulkDelete(emptyExerciseIds);

    const endedAt = Math.max(Date.now(), workout.startedAt + 1);
    await db.workouts.update(workoutId, { endedAt });
  });
}

/* ---------- progress chart feed ---------- */

export async function setsForExercise(exerciseId: number): Promise<SetEntry[]> {
  return db.sets
    .where('[exerciseId+performedAt]')
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .toArray();
}

export type ChartSetRow = SetEntry & { workoutStartedAt: number };

/**
 * Use this for sessionsFromSets(). Candles are bucketed by the workout's real
 * start time, not by whichever set happened to be entered first.
 */
export async function chartRowsForExercise(exerciseId: number): Promise<ChartSetRow[]> {
  const rows = (await setsForExercise(exerciseId)).filter(row => row.reps > 0);
  const ids = [...new Set(rows.map(row => row.workoutId))];
  const workouts = await db.workouts.bulkGet(ids);
  const starts = new Map<number, number>();
  workouts.forEach((workout, index) => {
    // Active workouts are durable working state, not history. They enter charts
    // only after Finish commits an endedAt timestamp.
    if (workout && workout.endedAt > 0) starts.set(ids[index], workout.startedAt);
  });
  return rows
    .filter(row => starts.has(row.workoutId))
    .map(row => ({
      ...row,
      workoutStartedAt: starts.get(row.workoutId) as number,
    }));
}

/* ---------- previous performance & personal bests ---------- */

/** The "Last time" strip on the workout screen, and the source for USE LAST TIME. */
export async function lastPerformance(
  exerciseId: number,
  excludeWorkoutId?: number,
): Promise<SetEntry[]> {
  const rows = (await setsForExercise(exerciseId))
    .filter(row => row.workoutId !== excludeWorkoutId && row.reps > 0);
  if (!rows.length) return [];

  const ids = [...new Set(rows.map(row => row.workoutId))];
  const workouts = await db.workouts.bulkGet(ids);
  let latestId: number | undefined;
  let latestStart = -Infinity;
  workouts.forEach((workout, index) => {
    if (workout && workout.endedAt > 0 && workout.startedAt > latestStart) {
      latestStart = workout.startedAt;
      latestId = ids[index];
    }
  });
  if (latestId === undefined) return [];
  return rows.filter(row => row.workoutId === latestId).sort((a, b) => a.order - b.order);
}

/** A personal best is the heaviest single set ever logged for the exercise. */
export async function bestWeightKg(exerciseId: number): Promise<number> {
  const rows = await chartRowsForExercise(exerciseId);
  return rows.reduce((max, row) => Math.max(max, row.weightKg), 0);
}

/* ---------- export / restore ---------- */

export interface Backup {
  app: 'gainz';
  schemaVersion: number;
  exportedAt: number;
  exercises: Exercise[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  sets: SetEntry[];
  bodyweight: BodyweightEntry[];
  templates: Template[];
  settings: Setting[];
}

const BACKUP_ARRAY_KEYS = [
  'exercises', 'workouts', 'workoutExercises', 'sets',
  'bodyweight', 'templates', 'settings',
] as const;

export async function exportBackup(): Promise<Backup> {
  const exportedAt = Date.now();
  await db.settings.put({ key: 'lastBackupAt', value: exportedAt });
  const [exercises, workouts, workoutExercises, sets, bodyweight, templates, settings] =
    await Promise.all([
      db.exercises.toArray(), db.workouts.toArray(), db.workoutExercises.toArray(),
      db.sets.toArray(), db.bodyweight.toArray(), db.templates.toArray(), db.settings.toArray(),
    ]);
  return {
    app: 'gainz',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt,
    exercises,
    workouts,
    workoutExercises,
    sets,
    bodyweight,
    templates,
    settings,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBackup(value: unknown): Backup {
  if (!isRecord(value) || value.app !== 'gainz') {
    throw new Error('Not a GAINZ backup file');
  }
  if (!Number.isInteger(value.schemaVersion) || (value.schemaVersion as number) < 1) {
    throw new Error('Backup has an invalid schema version');
  }
  if ((value.schemaVersion as number) > CURRENT_SCHEMA_VERSION) {
    throw new Error('Backup is from a newer version of GAINZ');
  }
  for (const key of BACKUP_ARRAY_KEYS) {
    if (!Array.isArray(value[key])) throw new Error(`Backup is missing ${key}`);
  }

  const backup = value as unknown as Backup;
  // Normalize flags so early development backups created before these fields
  // existed can still be restored safely.
  backup.exercises = backup.exercises.map(exercise => ({
    ...exercise,
    custom: Boolean(exercise.custom),
    favorite: Boolean(exercise.favorite),
    hidden: Boolean(exercise.hidden),
    archived: Boolean(exercise.archived),
  }));
  return backup;
}

/** Destructive. Download a fresh export and confirm in-app before calling this. */
export async function restoreBackup(value: unknown): Promise<void> {
  const backup = parseBackup(value); // validate fully before clearing anything
  await db.transaction(
    'rw',
    [
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.sets,
      db.bodyweight,
      db.templates,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.exercises.clear(), db.workouts.clear(), db.workoutExercises.clear(),
        db.sets.clear(), db.bodyweight.clear(), db.templates.clear(), db.settings.clear(),
      ]);
      await db.exercises.bulkAdd(backup.exercises);
      await db.workouts.bulkAdd(backup.workouts);
      await db.workoutExercises.bulkAdd(backup.workoutExercises);
      await db.sets.bulkAdd(backup.sets);
      await db.bodyweight.bulkAdd(backup.bodyweight);
      await db.templates.bulkAdd(backup.templates);
      await db.settings.bulkAdd(backup.settings);
    },
  );
}

/* ---------- first run ---------- */

export async function seedIfEmpty(): Promise<void> {
  if (await db.exercises.count()) return;
  type SeedExercise = Omit<Exercise, 'id' | 'custom' | 'favorite' | 'hidden' | 'archived'>;
  await db.exercises.bulkAdd(
    (seed.exercises as SeedExercise[]).map(exercise => ({
      ...exercise,
      custom: false,
      favorite: false,
      hidden: false,
      archived: false,
    })),
  );
}
