import { useEffect, useRef, type ComponentProps } from 'react';

interface ExerciseButtonProps extends ComponentProps<'button'> {
  onEdit: () => void;
}

/** A tap keeps its usual action; holding opens the editor without a follow-up tap. */
export default function ExerciseButton({ onEdit, onClick, style, title = 'Hold to edit (or press Shift+F10)', ...props }: ExerciseButtonProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  const stopReleaseGuard = useRef<(() => void) | null>(null);

  const cancelHold = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };

  useEffect(() => () => { cancelHold(); stopReleaseGuard.current?.(); }, []);

  const edit = () => {
    const heldPointer = origin.current;
    cancelHold();
    suppressClick.current = true;
    // A newly opened dialog can receive the touch's compatibility mouse events.
    // Ignore that release, but allow the next deliberate pointer/keyboard action.
    if (heldPointer) {
      stopReleaseGuard.current?.();
      let releaseTimer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        clearTimeout(releaseTimer);
        window.removeEventListener('mousedown', blockRelease, true);
        window.removeEventListener('click', blockRelease, true);
        window.removeEventListener('pointerup', released, true);
        window.removeEventListener('pointercancel', released, true);
        window.removeEventListener('pointerdown', cleanup, true);
        if (stopReleaseGuard.current === cleanup) stopReleaseGuard.current = null;
      };
      const blockRelease = (event: MouseEvent) => {
        if (event.detail === 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type === 'click') cleanup();
      };
      const released = (event: PointerEvent) => {
        if (event.pointerId !== heldPointer.id) return;
        releaseTimer = setTimeout(cleanup, 500);
      };
      stopReleaseGuard.current = cleanup;
      window.addEventListener('mousedown', blockRelease, true);
      window.addEventListener('click', blockRelease, true);
      window.addEventListener('pointerup', released, true);
      window.addEventListener('pointercancel', released, true);
      window.addEventListener('pointerdown', cleanup, true);
    }
    onEdit();
  };

  return (
    <button
      {...props}
      type="button"
      title={title}
      style={{ ...style, userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'pan-y' }}
      onPointerDown={event => {
        cancelHold();
        if (!event.isPrimary || event.button !== 0) return;
        suppressClick.current = false;
        origin.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
        timer.current = setTimeout(edit, 500);
      }}
      onPointerMove={event => {
        const start = origin.current;
        if (start && start.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
          suppressClick.current = true;
          cancelHold();
        }
      }}
      onPointerUp={cancelHold}
      onPointerCancel={() => { suppressClick.current = true; cancelHold(); }}
      onPointerLeave={cancelHold}
      onBlur={cancelHold}
      onContextMenu={event => {
        event.preventDefault();
        if (!suppressClick.current) edit();
      }}
      onKeyDown={event => {
        if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
          event.preventDefault();
          edit();
        } else if (event.key === 'Enter' || event.key === ' ') {
          suppressClick.current = false;
        }
      }}
      onClick={event => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
