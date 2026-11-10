import { useEffect, useState } from 'react';
import { getTrainingDayKey } from './training-day';

/** Refresh day-dependent screens at the boundary and when the PWA resumes. */
export function useTrainingDay(): string {
  const [day, setDay] = useState(() => getTrainingDayKey());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      setDay(getTrainingDayKey());
      timer = setTimeout(refresh, 60_000 - Date.now() % 60_000);
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return day;
}
