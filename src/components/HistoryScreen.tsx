import { useState, useEffect, useMemo } from 'react';
import { db, saveDraftWorkout, getActiveWorkout, type Workout, type Exercise, type SetEntry } from '../gainz-db';

type ViewMode = 'list' | 'calendar';

interface WorkoutSummary {
  workout: Workout;
  exercises: { exercise: Exercise; sets: SetEntry[] }[];
  setCount: number;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function HistoryScreen({ onNavigate }: { onNavigate?: (tab: 'home' | 'workout' | 'history' | 'progress' | 'profile') => void }) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // Calendar state
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<WorkoutSummary[] | null>(null);
  // Template save prompt
  const [templatePrompt, setTemplatePrompt] = useState<WorkoutSummary | null>(null);
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    (async () => {
      const finished = await db.workouts
        .where('endedAt').above(0)
        .reverse()
        .sortBy('startedAt');

      const summaries: WorkoutSummary[] = [];
      for (const w of finished) {
        const weRows = await db.workoutExercises.where('workoutId').equals(w.id!).sortBy('order');
        const exercises: WorkoutSummary['exercises'] = [];
        let setCount = 0;
        for (const we of weRows) {
          const ex = await db.exercises.get(we.exerciseId);
          if (!ex) continue;
          const sets = await db.sets.where('workoutExerciseId').equals(we.id!).sortBy('order');
          const realSets = sets.filter(s => s.reps > 0);
          exercises.push({ exercise: ex, sets: realSets });
          setCount += realSets.length;
        }
        if (exercises.length > 0) {
          summaries.push({ workout: w, exercises, setCount });
        }
      }
      setWorkouts(summaries);
      setLoading(false);
    })();
  }, []);

  // --- Calendar helpers ---
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => {
    const d = new Date(year, month, 1).getDay();
    return d === 0 ? 6 : d - 1; // Monday = 0
  };

  const workoutsByDate = useMemo(() => {
    const map = new Map<string, WorkoutSummary[]>();
    for (const ws of workouts) {
      const d = new Date(ws.workout.startedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) || [];
      arr.push(ws);
      map.set(key, arr);
    }
    return map;
  }, [workouts]);

  const calendarDays = useMemo(() => {
    const total = daysInMonth(calMonth.year, calMonth.month);
    const offset = firstDayOfMonth(calMonth.year, calMonth.month);
    const cells: (number | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    return cells;
  }, [calMonth]);

  const getDayKey = (day: number) =>
    `${calMonth.year}-${calMonth.month}-${day}`;

  const handleDayClick = (day: number) => {
    const key = getDayKey(day);
    setSelectedDay(workoutsByDate.get(key) || []);
  };

  // --- Use as New Workout ---
  const useAsWorkout = async (ws: WorkoutSummary) => {
    const active = await getActiveWorkout();
    if (active) {
      // Confirm overwrite would go here — for now, just replace
    }
    const draft = {
      exercises: ws.exercises.map(e => ({
        exerciseId: e.exercise.id!,
        sets: e.sets.map(s => ({ weightKg: s.weightKg, reps: s.reps })),
      })),
    };
    await saveDraftWorkout(draft);
    onNavigate?.('workout');
  };

  const saveTemplate = async (name: string) => {
    if (!templatePrompt) return;
    const exerciseIds = templatePrompt.exercises.map(e => e.exercise.id!);
    const draft = {
      exercises: templatePrompt.exercises.map(e => ({
        exerciseId: e.exercise.id!,
        sets: e.sets.map(s => ({ weightKg: s.weightKg, reps: s.reps })),
      })),
    };
    await db.templates.add({ name, exerciseIds, draftJson: JSON.stringify(draft), lastUsedAt: null });
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return `${DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDuration = (start: number, end: number) => {
    const mins = Math.round((end - start) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  }

  return (
    <div style={{ padding: '12px 16px', paddingBottom: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>History</h2>
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === 'list' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'list' ? 'var(--on-accent)' : 'var(--muted)',
            }}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === 'calendar' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'calendar' ? 'var(--on-accent)' : 'var(--muted)',
            }}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* ---- LIST VIEW ---- */}
      {viewMode === 'list' && (
        <div>
          {workouts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              No workouts yet. Start your first workout!
            </div>
          ) : (
            workouts.map((ws) => (
              <div
                key={ws.workout.id}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  marginBottom: 10,
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => setExpandedId(expandedId === ws.workout.id ? null : ws.workout.id!)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'left',
                    color: 'var(--text)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      {formatDate(ws.workout.startedAt)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {formatTime(ws.workout.startedAt)} · {ws.exercises.length} exercise{ws.exercises.length !== 1 ? 's' : ''} · {ws.setCount} set{ws.setCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {formatDuration(ws.workout.startedAt, ws.workout.endedAt)}
                  </div>
                </button>

                {/* Expanded detail */}
                {expandedId === ws.workout.id && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                    {ws.exercises.map((ex, i) => (
                      <div key={i} style={{ marginBottom: i < ws.exercises.length - 1 ? 12 : 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                          {ex.exercise.name}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {ex.sets.map((s, j) => (
                            <span key={j} style={{
                              fontSize: 12,
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--surface-2)',
                              color: 'var(--text)',
                              fontFamily: 'var(--font-display)',
                            }}>
                              {s.weightKg.toFixed(2)} × {s.reps}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => useAsWorkout(ws)}
                      style={{
                        width: '100%',
                        marginTop: 14,
                        padding: '10px 0',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-dim)',
                        color: 'var(--accent)',
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      USE AS NEW WORKOUT
                    </button>
                    <button
                      onClick={() => { setTemplatePrompt(ws); setTemplateName(''); }}
                      style={{
                        width: '100%',
                        marginTop: 8,
                        padding: '10px 0',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-2)',
                        color: 'var(--text)',
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      SAVE TEMPLATE
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ---- CALENDAR VIEW ---- */}
      {viewMode === 'calendar' && (
        <div>
          {/* Month nav */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}>
            <button
              onClick={() => setCalMonth(prev => ({
                year: prev.month === 0 ? prev.year - 1 : prev.year,
                month: prev.month === 0 ? 11 : prev.month - 1,
              }))}
              style={{ fontSize: 20, padding: '4px 8px', color: 'var(--accent)' }}
            >
              ←
            </button>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>
              {MONTHS[calMonth.month]} {calMonth.year}
            </span>
            <button
              onClick={() => setCalMonth(prev => ({
                year: prev.month === 11 ? prev.year + 1 : prev.year,
                month: prev.month === 11 ? 0 : prev.month + 1,
              }))}
              style={{ fontSize: 20, padding: '4px 8px', color: 'var(--accent)' }}
            >
              →
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const key = getDayKey(day);
              const hasWorkout = workoutsByDate.has(key);
              const isToday = new Date().toDateString() === new Date(calMonth.year, calMonth.month, day).toDateString();

              return (
                <button
                  key={key}
                  onClick={() => handleDayClick(day)}
                  style={{
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 14,
                    fontWeight: hasWorkout ? 700 : 400,
                    background: hasWorkout ? 'var(--accent-dim)' : 'transparent',
                    color: hasWorkout ? 'var(--accent)' : 'var(--text)',
                    border: isToday ? '2px solid var(--accent)' : 'none',
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Selected day detail */}
          {selectedDay !== null && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                background: 'rgba(0,0,0,.4)',
              }}
              onClick={() => setSelectedDay(null)}
            >
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius) var(--radius) 0 0',
                  padding: '20px 16px 32px',
                  maxWidth: 480,
                  width: '100%',
                  maxHeight: '70vh',
                  overflowY: 'auto',
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
                    {selectedDay.length > 0
                      ? formatDate(selectedDay[0].workout.startedAt)
                      : 'No workouts'}
                  </h3>
                  <button onClick={() => setSelectedDay(null)} style={{ fontSize: 22 }}>✕</button>
                </div>

                {selectedDay.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>
                    No workouts on this day
                  </div>
                ) : (
                  selectedDay.map((ws) => (
                    <div key={ws.workout.id} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                        {formatTime(ws.workout.startedAt)} — {formatTime(ws.workout.endedAt)} · {formatDuration(ws.workout.startedAt, ws.workout.endedAt)}
                      </div>
                      {ws.exercises.map((ex, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{ex.exercise.name}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {ex.sets.map((s, j) => (
                              <span key={j} style={{
                                fontSize: 12,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--surface-2)',
                                color: 'var(--text)',
                                fontFamily: 'var(--font-display)',
                              }}>
                                {s.weightKg.toFixed(2)} × {s.reps}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => { setSelectedDay(null); useAsWorkout(ws); }}
                        style={{
                          width: '100%',
                          marginTop: 8,
                          padding: '10px 0',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--accent-dim)',
                          color: 'var(--accent)',
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        USE AS NEW WORKOUT
                      </button>
                      <button
                        onClick={() => { setTemplatePrompt(ws); setTemplateName(''); }}
                        style={{
                          width: '100%',
                          marginTop: 6,
                          padding: '10px 0',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-2)',
                          color: 'var(--text)',
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        SAVE TEMPLATE
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Template name prompt */}
      {templatePrompt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.5)' }}
          onClick={() => setTemplatePrompt(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 20, maxWidth: 320, width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 12 }}>Save Template</h3>
            <input
              type="text"
              placeholder="Template name…"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: 14, outline: 'none', marginBottom: 16,
              }}
              onKeyDown={async e => {
                if (e.key === 'Enter' && templateName.trim()) {
                  await saveTemplate(templateName.trim());
                  setTemplatePrompt(null);
                }
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setTemplatePrompt(null)} style={{
                padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontWeight: 500,
              }}>Cancel</button>
              <button onClick={async () => {
                if (!templateName.trim()) return;
                await saveTemplate(templateName.trim());
                setTemplatePrompt(null);
              }} disabled={!templateName.trim()} style={{
                padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 600,
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
