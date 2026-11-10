import { db } from './gainz-db';

export const ROUTINE_DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

export type RoutineDay = typeof ROUTINE_DAYS[number];
export type RoutineFields = { muscleGroups: string; notes: string };
export type RoutineCellHeights = Partial<Record<keyof RoutineFields, number>>;
export type RoutineSplits = Record<RoutineDay, RoutineFields & { heights?: RoutineCellHeights }>;
export const MIN_ROUTINE_CELL_HEIGHT = 42;
export const MAX_ROUTINE_CELL_HEIGHT = 600;

export function clampRoutineCellHeight(height: number): number {
  return Math.min(MAX_ROUTINE_CELL_HEIGHT, Math.max(MIN_ROUTINE_CELL_HEIGHT, Math.round(height)));
}

const ROUTINE_KEY = 'routineSplits';
const IMAGE_SEEDED_KEY = 'routineSplitsImageSeeded';

const IMAGE_MUSCLE_GROUPS: Record<RoutineDay, string> = {
  Monday: 'Rest',
  Tuesday: 'Chest + biceps + rear shoulders',
  Wednesday: 'Legs + side shoulders + calves + abs',
  Thursday: 'Back + triceps + traps + forearms',
  Friday: 'Rest',
  Saturday: 'Shoulders first, then chest + back + biceps + triceps',
  Sunday: 'Legs + calves + abs',
};

/** Days always come from the fixed week, including when restoring older backups. */
function readRoutine(value: unknown): RoutineSplits {
  const stored = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(ROUTINE_DAYS.map(day => {
    const row = stored[day];
    const fields = row && typeof row === 'object' ? row as Record<string, unknown> : {};
    const storedHeights = fields.heights && typeof fields.heights === 'object'
      ? fields.heights as Record<string, unknown> : {};
    const heights: RoutineCellHeights = {};
    for (const field of ['muscleGroups', 'notes'] as const) {
      const height = storedHeights[field];
      if (typeof height === 'number' && Number.isFinite(height)) heights[field] = clampRoutineCellHeight(height);
    }
    return [day, {
      muscleGroups: typeof fields.muscleGroups === 'string' ? fields.muscleGroups : '',
      notes: typeof fields.notes === 'string' ? fields.notes : '',
      ...(Object.keys(heights).length ? { heights } : {}),
    }];
  })) as RoutineSplits;
}

/** Called inside a settings transaction so the seed and marker stay together. */
async function readOrSeedRoutine(): Promise<RoutineSplits> {
  const routine = readRoutine((await db.settings.get(ROUTINE_KEY))?.value);
  if ((await db.settings.get(IMAGE_SEEDED_KEY))?.value !== true) {
    for (const day of ROUTINE_DAYS) {
      if (!routine[day].muscleGroups.trim()) routine[day].muscleGroups = IMAGE_MUSCLE_GROUPS[day];
    }
    // Fill the previous release's empty cells once; preserve any existing text
    // and notes, and allow the user to clear cells after this initialization.
    await db.settings.bulkPut([
      { key: ROUTINE_KEY, value: routine },
      { key: IMAGE_SEEDED_KEY, value: true },
    ]);
  }
  return routine;
}

export async function getRoutineSplits(): Promise<RoutineSplits> {
  return db.transaction('rw', db.settings, readOrSeedRoutine);
}

/** Each keystroke writes only its cell, without overwriting other pending edits. */
export async function saveRoutineCell(day: RoutineDay, field: keyof RoutineFields, value: string): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const routine = await readOrSeedRoutine();
    routine[day][field] = value;
    await db.settings.put({ key: ROUTINE_KEY, value: routine });
  });
}

/** Store only this cell's size, preserving text and simultaneous edits. */
export async function saveRoutineCellHeight(day: RoutineDay, field: keyof RoutineFields, height: number): Promise<void> {
  if (!Number.isFinite(height)) throw new Error('Cell height must be a finite number');
  await db.transaction('rw', db.settings, async () => {
    const routine = await readOrSeedRoutine();
    routine[day].heights = { ...routine[day].heights, [field]: clampRoutineCellHeight(height) };
    await db.settings.put({ key: ROUTINE_KEY, value: routine });
  });
}
