import { getTrainingPeriodKey, getTrainingPeriodLabel, type Period } from './gainz-candles';
import { setVolumeKg, type ChartSetRow } from './gainz-db';

export interface VolumePeriod {
  key: string;
  label: string;
  volumeKg: number;
  reps: number;
  sets: number;
  workouts: number;
  exercises: number;
}

type VolumeTotals = Omit<VolumePeriod, 'exercises'> & { exerciseIds: Set<number> };

export function buildVolumePeriods(rows: ChartSetRow[], period: Period): VolumePeriod[] {
  const periods = new Map<string, VolumeTotals>();
  const workoutPeriods = new Map<number, VolumeTotals>();

  for (const row of rows) {
    let totals = workoutPeriods.get(row.workoutId);
    if (!totals) {
      const key = getTrainingPeriodKey(row.workoutStartedAt, period);
      totals = periods.get(key);
      if (!totals) {
        totals = {
          key, label: getTrainingPeriodLabel(row.workoutStartedAt, period),
          volumeKg: 0, reps: 0, sets: 0, workouts: 0, exerciseIds: new Set(),
        };
        periods.set(key, totals);
      }
      totals.workouts += 1;
      workoutPeriods.set(row.workoutId, totals);
    }
    totals.volumeKg += setVolumeKg(row.weightKg, row.reps);
    totals.reps += row.reps;
    totals.sets += 1;
    totals.exerciseIds.add(row.exerciseId);
  }

  return [...periods.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ exerciseIds, ...totals }) => ({ ...totals, exercises: exerciseIds.size }));
}
