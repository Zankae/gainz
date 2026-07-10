import { useState, useEffect } from 'react';
import { db, getActiveWorkout, type Workout, type BodyweightEntry, type Exercise } from '../gainz-db';

interface WeeklyDot {
  day: string;
  trained: boolean;
  isToday: boolean;
}

export default function HomeScreen({ onNavigate }: { onNavigate?: (tab: 'home' | 'workout' | 'history' | 'progress' | 'profile') => void }) {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [recentWorkout, setRecentWorkout] = useState<Workout | null>(null);
  const [weekCount, setWeekCount] = useState(0);
  const [weeklyDots, setWeeklyDots] = useState<WeeklyDot[]>([]);
  const [bodyweight, setBodyweight] = useState<BodyweightEntry | null>(null);
  const [recentPBs, setRecentPBs] = useState<{ exercise: Exercise; weight: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Active workout?
      const active = await getActiveWorkout();
      setActiveWorkout(active ?? null);

      // Recent finished workout
      const finished = await db.workouts
        .where('endedAt').above(0)
        .reverse()
        .sortBy('startedAt');
      setRecentWorkout(finished[0] ?? null);

      // This week's workouts
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
      weekStart.setHours(0, 0, 0, 0);
      const weekStartMs = weekStart.getTime();

      const thisWeek = finished.filter(w => w.startedAt >= weekStartMs);
      setWeekCount(thisWeek.length);

      // Weekly dots (Mon-Sun)
      const dots: WeeklyDot[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const dayEnd = dayStart + 86400000;
        const trained = thisWeek.some(w => w.startedAt >= dayStart && w.startedAt < dayEnd);
        dots.push({
          day: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
          trained,
          isToday: now.getDate() === d.getDate() && now.getMonth() === d.getMonth(),
        });
      }
      setWeeklyDots(dots);

      // Bodyweight
      const bw = await db.bodyweight.orderBy('at').reverse().first();
      setBodyweight(bw ?? null);

      // Recent PBs (heaviest sets across all exercises, top 3)
      const allExercises = await db.exercises.toArray();
      const pbs: { exercise: Exercise; weight: number }[] = [];
      for (const ex of allExercises) {
        if (!ex.id) continue;
        const sets = await db.sets
          .where('exerciseId').equals(ex.id)
          .filter(s => s.reps > 0)
          .toArray();
        if (sets.length) {
          const max = Math.max(...sets.map(s => s.weightKg));
          pbs.push({ exercise: ex, weight: max });
        }
      }
      pbs.sort((a, b) => b.weight - a.weight);
      setRecentPBs(pbs.slice(0, 3));

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const lastWorkoutDay = recentWorkout
    ? days[new Date(recentWorkout.startedAt).getDay()]
    : '';
  const lastWorkoutDate = recentWorkout
    ? new Date(recentWorkout.startedAt).toLocaleDateString()
    : '';

  return (
    <div style={{ padding: '20px 16px', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: '.02em',
          marginBottom: 4,
        }}>
          GAINZ
        </h1>
        {recentWorkout && (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Last workout: {lastWorkoutDay} {lastWorkoutDate}
          </div>
        )}
      </div>

      {/* Start / Continue */}
      {activeWorkout ? (
        <button
          onClick={() => onNavigate?.('workout')}
          style={{
            width: '100%',
            padding: '20px 0',
            borderRadius: 'var(--radius)',
            background: 'var(--gain-dim)',
            color: 'var(--gain)',
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '.02em',
            marginBottom: 20,
            border: '2px solid var(--gain)',
          }}
        >
          CONTINUE WORKOUT ▶
        </button>
      ) : (
        <button
          onClick={() => onNavigate?.('workout')}
          style={{
            width: '100%',
            padding: '20px 0',
            borderRadius: 'var(--radius)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '.02em',
            marginBottom: 20,
          }}
        >
          START WORKOUT
        </button>
      )}

      {/* This week */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
          This week
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="num" style={{ fontSize: 28, fontWeight: 700 }}>
              {weekCount}
            </span>
            <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 6 }}>
              workout{weekCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {weeklyDots.map((dot, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  background: dot.trained
                    ? 'var(--accent)'
                    : dot.isToday
                      ? 'var(--accent-dim)'
                      : 'var(--surface-2)',
                  color: dot.trained ? 'var(--on-accent)' : 'var(--muted)',
                  border: dot.isToday && !dot.trained ? '2px solid var(--accent)' : 'none',
                }}>
                  {dot.day}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bodyweight */}
      {bodyweight && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          padding: 16,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
            Bodyweight
          </div>
          <span className="num" style={{ fontSize: 24, fontWeight: 700 }}>
            {bodyweight.kg.toFixed(1)} kg
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
            {new Date(bodyweight.at).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Personal Bests */}
      {recentPBs.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          padding: 16,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            Personal Bests
          </div>
          {recentPBs.map((pb, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: i < recentPBs.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: 14 }}>{pb.exercise.name}</span>
              <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--gain)' }}>
                {pb.weight.toFixed(2)} kg
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
