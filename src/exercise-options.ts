import type { Equipment, MuscleGroup } from './gainz-db';

export const GROUPS: MuscleGroup[] = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
  'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Abdominals', 'Traps', 'Full body',
];

export const EQUIPMENT: Equipment[] = [
  'barbell', 'dumbbell', 'cable', 'machine', 'smith', 'plate', 'bodyweight', 'other',
];
