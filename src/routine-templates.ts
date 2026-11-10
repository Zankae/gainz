import { db, type Equipment, type Template } from './gainz-db';

interface PlannedExercise {
  name: string;
  equipment: Equipment;
  sets: number;
}

interface RoutineTemplatePlan {
  name: string;
  exercises: PlannedExercise[];
}

// The five training days, selected from the supplied favorites and split.
// Equipment variants of a movement are spread across days, never doubled up.
export const ROUTINE_TEMPLATE_PLANS: RoutineTemplatePlan[] = [
  {
    name: 'Tuesday — Chest, Biceps & Rear Delts',
    exercises: [
      { name: 'Incline Dumbbell Press', equipment: 'dumbbell', sets: 3 },
      { name: 'Cable Fly', equipment: 'cable', sets: 3 },
      { name: 'Barbell Curl', equipment: 'barbell', sets: 3 },
      { name: 'Rear Delt Fly', equipment: 'machine', sets: 3 },
    ],
  },
  {
    name: 'Wednesday — Quads, Side Delts & Abs',
    exercises: [
      { name: 'Leg Press', equipment: 'machine', sets: 3 },
      { name: 'Leg Extension', equipment: 'machine', sets: 3 },
      { name: 'Lying Leg Curl', equipment: 'machine', sets: 2 },
      { name: 'Lateral Raise Cable', equipment: 'cable', sets: 3 },
      { name: 'Seated Calf Raise', equipment: 'machine', sets: 3 },
      { name: 'Hanging Leg Raise', equipment: 'bodyweight', sets: 3 },
    ],
  },
  {
    name: 'Thursday — Back, Triceps, Traps & Forearms',
    exercises: [
      { name: 'Deadlift', equipment: 'barbell', sets: 3 },
      { name: 'Wide-Grip Lat Pulldown', equipment: 'cable', sets: 3 },
      { name: 'Seated Cable Row', equipment: 'cable', sets: 3 },
      { name: 'Overhead Cable Extension', equipment: 'cable', sets: 3 },
      { name: 'Wrist Curl', equipment: 'barbell', sets: 2 },
      { name: 'Reverse Wrist Curl', equipment: 'barbell', sets: 2 },
    ],
  },
  {
    name: 'Saturday — Machine Day, Shoulders First',
    exercises: [
      { name: 'Shoulder Press Machine', equipment: 'machine', sets: 3 },
      { name: 'Chest Press Machine', equipment: 'machine', sets: 3 },
      { name: 'Machine Fly', equipment: 'machine', sets: 3 },
      { name: 'Close-Grip Lat Pulldown', equipment: 'cable', sets: 3 },
      { name: 'Machine Row', equipment: 'machine', sets: 3 },
      { name: 'Biceps Curl Machine', equipment: 'machine', sets: 3 },
      { name: 'Triceps Press Machine', equipment: 'machine', sets: 3 },
    ],
  },
  {
    name: 'Sunday — Hamstrings & Abs',
    exercises: [
      { name: 'Lying Leg Curl', equipment: 'machine', sets: 4 },
      { name: 'Leg Press', equipment: 'machine', sets: 2 },
      { name: 'Seated Calf Raise', equipment: 'machine', sets: 3 },
      { name: 'Abdominal Machine', equipment: 'machine', sets: 3 },
      { name: 'Rotary Torso', equipment: 'machine', sets: 2 },
    ],
  },
];

const INSTALLED_KEY = 'routineTemplates20261110';
const normalizedName = (name: string) => name.trim().toLocaleLowerCase('en');

/** Add the five templates once, using the device's current hearted exercise IDs. */
export async function ensureRoutineTemplates(): Promise<string[]> {
  return db.transaction('rw', db.exercises, db.templates, db.settings, async () => {
    if ((await db.settings.get(INSTALLED_KEY))?.value === true) return [];

    const favorites = await db.exercises.filter(exercise =>
      exercise.favorite && !exercise.hidden && !exercise.archived,
    ).toArray();
    const existingNames = new Set((await db.templates.toArray()).map(template => template.name));
    const missing = new Set<string>();
    const templates: Template[] = [];

    for (const plan of ROUTINE_TEMPLATE_PLANS) {
      // Preserve an existing template, including a restored or customized one.
      if (existingNames.has(plan.name)) continue;
      const exercises = plan.exercises.flatMap(planned => {
        const exercise = favorites.find(candidate =>
          normalizedName(candidate.name) === normalizedName(planned.name) && candidate.equipment === planned.equipment,
        );
        if (!exercise?.id) {
          missing.add(planned.name);
          return [];
        }
        return [{
          exerciseId: exercise.id,
          sets: Array.from({ length: planned.sets }, () => ({ weightKg: 0, reps: 0 })),
        }];
      });
      templates.push({
        name: plan.name,
        exerciseIds: exercises.map(exercise => exercise.exerciseId),
        draftJson: JSON.stringify({ exercises }),
        lastUsedAt: null,
      });
    }

    // Never substitute an unhearted exercise or install an incomplete day.
    if (missing.size) return [...missing];
    await db.templates.bulkAdd(templates);
    await db.settings.put({ key: INSTALLED_KEY, value: true });
    return [];
  });
}
