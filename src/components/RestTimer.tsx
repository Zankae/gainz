import { useState, useEffect, useRef, useCallback } from 'react';

const PRESETS = [30, 60, 90, 120, 180];

export default function RestTimer() {
  const [seconds, setSeconds] = useState(60);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    setRemaining((prev) => {
      if (prev <= 1) {
        clearTimer();
        setRunning(false);
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        return 0;
      }
      return prev - 1;
    });
  }, [clearTimer]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [running, tick, clearTimer]);

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  const startPause = () => {
    if (remaining <= 0) {
      setRemaining(seconds);
    }
    setRunning(!running);
  };

  const reset = () => {
    setRunning(false);
    setRemaining(seconds);
  };

  const setPreset = (s: number) => {
    setRunning(false);
    setSeconds(s);
    setRemaining(s);
  };

  const addTime = () => {
    setRemaining((prev) => prev + 15);
    if (!running) {
      setSeconds((prev) => prev + 15);
    }
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg)',
        padding: '12px 16px 14px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, textAlign: 'center' }}>
        ⏱ REST TIMER
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 40,
          fontWeight: 700,
          textAlign: 'center',
          color: remaining === 0 ? 'var(--gain)' : running ? 'var(--accent)' : 'var(--text)',
          marginBottom: 10,
        }}
      >
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>

      {/* Controls — 20% larger */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
        <button
          onClick={startPause}
          style={{
            padding: '10px 24px',
            borderRadius: 'var(--radius-sm)',
            background: running ? 'var(--loss-dim)' : 'var(--gain-dim)',
            color: running ? 'var(--loss)' : 'var(--gain)',
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          {running ? 'Pause' : remaining <= 0 ? 'Restart' : 'Start'}
        </button>
        <button
          onClick={reset}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            fontSize: 15,
          }}
        >
          Reset
        </button>
        <button
          onClick={addTime}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-2)',
            color: 'var(--accent)',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          +15s
        </button>
      </div>

      {/* Presets — 20% larger */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {PRESETS.map((s) => (
          <button
            key={s}
            onClick={() => setPreset(s)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              background: seconds === s && !running ? 'var(--accent-dim)' : 'var(--surface-2)',
              color: seconds === s && !running ? 'var(--accent)' : 'var(--muted)',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {s >= 120 ? `${Math.floor(s / 60)}m` : `${s}s`}
          </button>
        ))}
      </div>
    </div>
  );
}
