import { useRestTimer } from '../useRestTimer';

const PRESETS = [30, 60, 90, 120, 180];

export default function RestTimer() {
  const { seconds, remaining, running, startPause, reset, setPreset, addTime } = useRestTimer();

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg)',
        padding: '14px 16px 16px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: 15, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8, textAlign: 'center' }}>
        ⏱ REST TIMER
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 48,
          fontWeight: 700,
          textAlign: 'center',
          color: remaining === 0 ? 'var(--gain)' : running ? 'var(--accent)' : 'var(--text)',
          marginBottom: 12,
        }}
      >
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
        <button onClick={startPause} style={{
          padding: '12px 28px', borderRadius: 'var(--radius-sm)',
          background: running ? 'var(--loss-dim)' : 'var(--gain-dim)',
          color: running ? 'var(--loss)' : 'var(--gain)',
          fontWeight: 600, fontSize: 16,
        }}>{running ? 'Pause' : remaining <= 0 ? 'Restart' : 'Start'}</button>
        <button onClick={reset} style={{
          padding: '12px 24px', borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-2)', color: 'var(--text)', fontSize: 16,
        }}>Reset</button>
        <button onClick={addTime} style={{
          padding: '12px 20px', borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-2)', color: 'var(--accent)', fontSize: 16, fontWeight: 600,
        }}>+15s</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {PRESETS.map((s) => (
          <button key={s} onClick={() => setPreset(s)} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)',
            background: seconds === s && !running ? 'var(--accent-dim)' : 'var(--surface-2)',
            color: seconds === s && !running ? 'var(--accent)' : 'var(--muted)',
            fontSize: 14, fontWeight: 500,
          }}>{s >= 120 ? `${Math.floor(s / 60)}m` : `${s}s`}</button>
        ))}
      </div>
    </div>
  );
}
