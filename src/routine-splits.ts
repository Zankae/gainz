import { db } from './gainz-db';

export const ROUTINE_DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

export type RoutineDay = typeof ROUTINE_DAYS[number];
export type RoutineFields = { muscleGroups: string; notes: string };
export type RoutineSplits = Record<RoutineDay, RoutineFields>;

const ROUTINE_KEY = 'routineSplits';

/** Days always come from the fixed week, including when restoring older backups. */
function readRoutine(value: unknown): RoutineSplits {
  const stored = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(ROUTINE_DAYS.map(day => {
    const row = stored[day];
    const fields = row && typeof row === 'object' ? row as Record<string, unknown> : {};
    return [day, {
      muscleGroups: typeof fields.muscleGroups === 'string' ? fields.muscleGroups : '',
      notes: typeof fields.notes === 'string' ? fields.notes : '',
    }];
  })) as RoutineSplits;
}

export async function getRoutineSplits(): Promise<RoutineSplits> {
  return readRoutine((await db.settings.get(ROUTINE_KEY))?.value);
}

/** Each keystroke writes only its cell, without overwriting other pending edits. */
export async function saveRoutineCell(day: RoutineDay, field: keyof RoutineFields, value: string): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const routine = await getRoutineSplits();
    routine[day][field] = value;
    await db.settings.put({ key: ROUTINE_KEY, value: routine });
  });
}
