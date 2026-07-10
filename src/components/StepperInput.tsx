import { useState, useCallback, useEffect } from 'react';
import { normalizeQuarterKg, normalizeReps } from '../gainz-db';

interface StepperInputProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  /** 'weight' uses 0.25 kg steps and decimal keyboard; 'reps' uses whole numbers */
  mode: 'weight' | 'reps';
  label?: string;
}

export default function StepperInput({
  value,
  onChange,
  step: stepOverride,
  min = 0,
  mode,
  label,
}: StepperInputProps) {
  const step = stepOverride ?? (mode === 'weight' ? 0.25 : 1);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const display = editing
    ? editText
    : mode === 'weight'
      ? value.toFixed(2)
      : String(value);

  const commit = useCallback(() => {
    if (!editing) return;
    setEditing(false);
    try {
      const normalized =
        mode === 'weight'
          ? normalizeQuarterKg(editText || '0')
          : normalizeReps(editText || '0');
      onChange(Math.max(min, normalized));
    } catch {
      // Invalid input — revert to current value
    }
  }, [editing, editText, mode, onChange, min]);

  // Sync edit text when value changes externally
  useEffect(() => {
    if (!editing) {
      setEditText(mode === 'weight' ? value.toFixed(2) : String(value));
    }
  }, [value, editing, mode]);

  const adjust = (delta: number) => {
    const raw = value + delta;
    const clamped = Math.max(min, raw);
    const normalized =
      mode === 'weight'
        ? normalizeQuarterKg(clamped)
        : normalizeReps(clamped);
    onChange(normalized);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {label && (
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', minWidth: 40 }}>
          {label}
        </span>
      )}
      <button
        onClick={() => adjust(-step)}
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-2)',
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          flexShrink: 0,
        }}
      >
        −
      </button>
      <input
        type="text"
        inputMode={mode === 'weight' ? 'decimal' : 'numeric'}
        value={editing ? editText : display}
        onChange={(e) => {
          setEditing(true);
          setEditText(e.target.value);
        }}
        onFocus={() => {
          setEditing(true);
          setEditText(mode === 'weight' ? value.toFixed(2) : String(value));
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setEditing(false);
          }
        }}
        style={{
          width: 80,
          height: 36,
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 16,
          fontWeight: 600,
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          outline: 'none',
        }}
      />
      <button
        onClick={() => adjust(step)}
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-2)',
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          flexShrink: 0,
        }}
      >
        +
      </button>
    </div>
  );
}
