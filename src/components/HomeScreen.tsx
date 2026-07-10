import { useState, useEffect, useMemo } from 'react';
import {
  db, getActiveWorkout, startWorkout, saveDraftWorkout,
  type Workout, type BodyweightEntry, type Exercise, type Template,
} from '../gainz-db';

interface WeeklyDot {
  day: string;
  trained: boolean;
  isToday: boolean;
}

export default function HomeScreen({ onNavigate }: { onNavigate?: (tab: 'home' | 'workout' | 'history' | 'progress' | 'profile') => void }) {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [recentWorkout, setRecentWorkout] = useState<Workout | null>(null);
  const [weekCount, setWeekCount] = useState(0);
  const [weekDots, setWeekDots] = useState<WeeklyDot[]>([]);
  const [monthCount, setMonthCount] = useState(0);
  const [monthWorkouts, setMonthWorkouts] = useState<{ day: number; count: number }[]>([]);
  const [bodyweight, setBodyweight] = useState<BodyweightEntry | null>(null);
  const [recentPBs, setRecentPBs] = useState<{ exercise: Exercise; weight: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loadedTemplate, setLoadedTemplate] = useState<Template | null>(null);

  useEffect(() => {
    (async () => {
      const active = await getActiveWorkout();
      setActiveWorkout(active ?? null);

      const finished = await db.workouts.where('endedAt').above(0).reverse().sortBy('startedAt');
      setRecentWorkout(finished[0] ?? null);

      // Weekly
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekStartMs = weekStart.getTime();
      const thisWeek = finished.filter(w => w.startedAt >= weekStartMs);
      setWeekCount(thisWeek.length);

      const dots: WeeklyDot[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const dayEnd = dayStart + 86400000;
        dots.push({
          day: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
          trained: thisWeek.some(w => w.startedAt >= dayStart && w.startedAt < dayEnd),
          isToday: now.toDateString() === d.toDateString(),
        });
      }
      setWeekDots(dots);

      // Monthly
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const thisMonth = finished.filter(w => w.startedAt >= monthStart);
      setMonthCount(thisMonth.length);
      const dayMap = new Map<number, number>();
      for (const w of thisMonth) {
        const day = new Date(w.startedAt).getDate();
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
      setMonthWorkouts(Array.from(dayMap.entries()).map(([day, count]) => ({ day, count })).sort((a, b) => a.day - b.day));

      // Bodyweight
      const bw = await db.bodyweight.orderBy('at').reverse().first();
      setBodyweight(bw ?? null);

      // PBs
      const allExercises = await db.exercises.toArray();
      const pbs: { exercise: Exercise; weight: number }[] = [];
      for (const ex of allExercises) {
        if (!ex.id) continue;
        const sets = await db.sets.where('exerciseId').equals(ex.id).filter(s => s.reps > 0).toArray();
        if (sets.length) {
          pbs.push({ exercise: ex, weight: Math.max(...sets.map(s => s.weightKg)) });
        }
      }
      pbs.sort((a, b) => b.weight - a.weight);
      setRecentPBs(pbs.slice(0, 100));

      // Templates
      setTemplates(await db.templates.toArray());

      setLoading(false);
    })();
  }, []);

  // Monthly mini chart
  const monthChart = useMemo(() => {
    if (monthWorkouts.length === 0) return null;
    const maxH = 40;
    const maxCount = Math.max(...monthWorkouts.map(m => m.count), 1);
    const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: maxH, flex: 1, maxWidth: 200, marginLeft: 8 }}>
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const entry = monthWorkouts.find(m => m.day === day);
          const h = entry ? Math.max(2, (entry.count / maxCount) * maxH) : 1;
          const isToday = day === new Date().getDate();
          return (
            <div key={i} style={{
              flex: 1,
              height: Math.max(1, h),
              background: h > 1 ? 'var(--accent)' : isToday ? 'var(--accent-dim)' : 'var(--surface-2)',
              borderRadius: '2px 2px 0 0',
              opacity: h > 1 ? 1 : 0.4,
              minWidth: 1,
            }} />
          );
        })}
      </div>
    );
  }, [monthWorkouts]);

  const handleLoadTemplate = async (template: Template) => {
    if (!template.exerciseIds.length) return;
    // Try to load draft with weights/reps, fall back to empty sets
    let draftExercises: { exerciseId: number; sets: { weightKg: number; reps: number }[] }[];
    try {
      const parsed = JSON.parse(template.draftJson || '{}');
      draftExercises = parsed.exercises || [];
    } catch {
      draftExercises = template.exerciseIds.map(id => ({ exerciseId: id, sets: [{ weightKg: 0, reps: 0 }] }));
    }
    if (!draftExercises.length) {
      draftExercises = template.exerciseIds.map(id => ({ exerciseId: id, sets: [{ weightKg: 0, reps: 0 }] }));
    }
    const draft = { exercises: draftExercises };
    await saveDraftWorkout(draft);
    await db.templates.update(template.id!, { lastUsedAt: Date.now() });
    setLoadedTemplate(template);
    setShowTemplates(false);
  };

  const handleStartWorkout = async () => {
    await startWorkout();
    onNavigate?.('workout');
  };

  const deleteTemplate = async (id: number) => {
    await db.templates.delete(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (loadedTemplate?.id === id) setLoadedTemplate(null);
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const lastWorkoutDay = recentWorkout ? days[new Date(recentWorkout.startedAt).getDay()] : '';
  const lastWorkoutDate = recentWorkout ? new Date(recentWorkout.startedAt).toLocaleDateString() : '';

  return (
    <div style={{ padding: '20px 16px', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, letterSpacing: '.02em', marginBottom: 4 }}>
          GAIN<span style={{ color: 'var(--accent)' }}>Z</span>
        </h1>
        {recentWorkout && (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Last workout: {lastWorkoutDay} {lastWorkoutDate}
          </div>
        )}
      </div>

      {/* Start / Continue / Load Template */}
      {activeWorkout ? (
        <button onClick={() => onNavigate?.('workout')} style={{
          width: '100%', padding: '16px 0', borderRadius: 'var(--radius)',
          background: 'var(--gain-dim)', color: 'var(--gain)',
          marginBottom: 16, border: '2px solid var(--gain)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            WORKOUT ACTIVE
          </span>
          <WorkoutTimer startedAt={activeWorkout.startedAt} />
        </button>
      ) : loadedTemplate ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
            Loaded template
          </div>
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-dim)',
            color: 'var(--accent)', fontSize: 14, fontWeight: 600, marginBottom: 10,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{loadedTemplate.name}</span>
            <button onClick={() => setLoadedTemplate(null)} style={{ color: 'var(--muted)', fontSize: 16 }}>✕</button>
          </div>
          <button onClick={handleStartWorkout} style={{
            width: '100%', padding: '20px 0', borderRadius: 'var(--radius)',
            background: 'var(--accent)', color: 'var(--on-accent)',
            fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '.02em',
          }}>
            START WORKOUT
          </button>
        </div>
      ) : (
        <button onClick={() => setShowTemplates(true)} style={{
          width: '100%', padding: '20px 0', borderRadius: 'var(--radius)',
          background: 'var(--accent)', color: 'var(--on-accent)',
          fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '.02em', marginBottom: 16,
        }}>
          LOAD TEMPLATE
        </button>
      )}

      {/* Template list modal */}
      {showTemplates && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.5)' }}
          onClick={() => setShowTemplates(false)}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius) var(--radius) 0 0',
            padding: '20px 16px 32px', maxWidth: 480, width: '100%', maxHeight: '60vh', overflowY: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Templates</h3>
              <button onClick={() => setShowTemplates(false)} style={{ fontSize: 22 }}>✕</button>
            </div>
            {templates.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                No templates yet. Save a workout from History as a template.
              </div>
            ) : (
              templates.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-2)', marginBottom: 8,
                }}>
                  <button onClick={() => handleLoadTemplate(t)} style={{
                    flex: 1, textAlign: 'left', color: 'var(--text)', fontSize: 14, fontWeight: 500,
                  }}>
                    {t.name}
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {t.exerciseIds.length} exercise{t.exerciseIds.length !== 1 ? 's' : ''}
                      {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : ''}
                    </div>
                  </button>
                  <button onClick={() => deleteTemplate(t.id!)} style={{
                    color: 'var(--loss)', fontSize: 14, padding: '4px 8px',
                  }}>🗑</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* This Week */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
          This Week
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span className="num" style={{ fontSize: 28, fontWeight: 700 }}>{weekCount}</span>
            <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 6 }}>
              workout{weekCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {weekDots.map((dot, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600,
                  background: dot.trained ? 'var(--accent)' : dot.isToday ? 'var(--accent-dim)' : 'var(--surface-2)',
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

      {/* This Month */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
          This Month
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span className="num" style={{ fontSize: 28, fontWeight: 700 }}>{monthCount}</span>
            <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 6 }}>
              workout{monthCount !== 1 ? 's' : ''}
            </span>
          </div>
          {monthChart}
        </div>
      </div>

      {/* Bodyweight */}
      {bodyweight && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
            Bodyweight
          </div>
          <span className="num" style={{ fontSize: 24, fontWeight: 700 }}>{bodyweight.kg.toFixed(1)} kg</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
            {new Date(bodyweight.at).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Personal Bests */}
      {recentPBs.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            Personal Bests
          </div>
          {recentPBs.map((pb, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: i < recentPBs.length - 1 ? '1px solid var(--border)' : 'none',
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

function WorkoutTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(Date.now() - startedAt);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const s = Math.floor(elapsed / 1000) % 60;
  const m = Math.floor(elapsed / 60000) % 60;
  const h = Math.floor(elapsed / 3600000);
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700 }}>
      {h > 0 ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` :
       m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`}
    </span>
  );
}
