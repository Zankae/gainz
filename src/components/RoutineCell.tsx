import { useLayoutEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { clampRoutineCellHeight, MAX_ROUTINE_CELL_HEIGHT, MIN_ROUTINE_CELL_HEIGHT } from '../routine-splits';

interface RoutineCellProps {
  label: string;
  value: string;
  height?: number;
  onChange: (value: string) => void;
  onResize: (height: number) => void;
}

export default function RoutineCell({ label, value, height, onChange, onResize }: RoutineCellProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ pointerId: number; startY: number; startHeight: number; height: number } | null>(null);
  const [dragHeight, setDragHeight] = useState<number>();
  const [measuredHeight, setMeasuredHeight] = useState(MIN_ROUTINE_CELL_HEIGHT);
  const fixedHeight = dragHeight ?? height;

  useLayoutEffect(() => {
    const textarea = textareaRef.current!;
    const observer = new ResizeObserver(() => setMeasuredHeight(Math.round(textarea.getBoundingClientRect().height)));
    observer.observe(textarea);
    return () => observer.disconnect();
  }, []);

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const startHeight = textareaRef.current!.getBoundingClientRect().height;
    drag.current = { pointerId: event.pointerId, startY: event.clientY, startHeight, height: startHeight };
  };

  const moveResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current.height = clampRoutineCellHeight(drag.current.startHeight + event.clientY - drag.current.startY);
    setDragHeight(drag.current.height);
  };

  const finishResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const { height: nextHeight, startHeight } = drag.current;
    drag.current = null;
    setDragHeight(undefined);
    if (nextHeight !== startHeight) onResize(nextHeight);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = textareaRef.current!.getBoundingClientRect().height;
    const next = event.key === 'ArrowUp' ? current - 8
      : event.key === 'ArrowDown' ? current + 8
      : event.key === 'Home' ? MIN_ROUTINE_CELL_HEIGHT
      : event.key === 'End' ? MAX_ROUTINE_CELL_HEIGHT : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onResize(clampRoutineCellHeight(next));
  };

  return (
    <div className="routine-cell">
      <textarea ref={textareaRef} aria-label={label} rows={1} value={value}
        style={fixedHeight === undefined ? undefined : { height: fixedHeight, fieldSizing: 'fixed' }}
        onChange={event => onChange(event.target.value)} />
      <div className="routine-cell-resizer" role="separator" tabIndex={0} aria-label={`Resize ${label}`}
        aria-orientation="horizontal" aria-valuemin={MIN_ROUTINE_CELL_HEIGHT}
        aria-valuemax={MAX_ROUTINE_CELL_HEIGHT} aria-valuenow={measuredHeight}
        aria-valuetext={`${measuredHeight} pixels high`} title="Drag up to shrink or down to expand. Arrow keys also resize."
        onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={finishResize}
        onPointerCancel={finishResize} onLostPointerCapture={finishResize} onKeyDown={resizeWithKeyboard}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 10L10 3M7 10L10 7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}
