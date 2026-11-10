export const TRAINING_TIME_ZONE = 'Europe/Stockholm';

const stockholmClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: TRAINING_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', hourCycle: 'h23',
});

/**
 * Training days run from 06:00 to 05:59:59 in Sweden, including DST.
 * The returned Date carries a calendar date at UTC midnight, not a real
 * workout timestamp. Use UTC accessors/formatting for calendar arithmetic.
 */
export function getTrainingDate(at = Date.now()): Date {
  const parts = stockholmClock.formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)!.value);
  const date = new Date(Date.UTC(value('year'), value('month') - 1, value('day')));
  if (value('hour') < 6) date.setUTCDate(date.getUTCDate() - 1);
  return date;
}

export function calendarDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getTrainingDayKey(at = Date.now()): string {
  return calendarDateKey(getTrainingDate(at));
}

export function formatTrainingDate(at: number): string {
  return getTrainingDate(at).toLocaleDateString(undefined, { timeZone: 'UTC' });
}

export function formatWorkoutTime(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    timeZone: TRAINING_TIME_ZONE, hour: '2-digit', minute: '2-digit',
  });
}
