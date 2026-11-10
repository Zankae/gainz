import { describe, expect, it } from 'vitest';
import { buildCandles, getTrainingPeriodKey, type Period, type Session } from './gainz-candles';
import { getTrainingDate, getTrainingDayKey } from './training-day';

describe('06:00 Sweden training-day boundary', () => {
  it.each([
    ['2026-11-09T23:59:59+01:00', '2026-11-09'],
    ['2026-11-10T00:00:00+01:00', '2026-11-09'],
    ['2026-11-10T01:30:00+01:00', '2026-11-09'],
    ['2026-11-10T05:59:59.999+01:00', '2026-11-09'],
    ['2026-11-10T06:00:00+01:00', '2026-11-10'],
    ['2026-11-10T06:00:00.001+01:00', '2026-11-10'],
    ['2026-07-14T05:59:59.999+02:00', '2026-07-13'],
    ['2026-07-14T06:00:00+02:00', '2026-07-14'],
    // Spring forward: the cutoff is a wall-clock hour, not six elapsed hours.
    ['2026-03-29T01:59:59+01:00', '2026-03-28'],
    ['2026-03-29T03:00:00+02:00', '2026-03-28'],
    ['2026-03-29T05:59:59.999+02:00', '2026-03-28'],
    ['2026-03-29T06:00:00+02:00', '2026-03-29'],
    // Fall back: both occurrences of 02:30 belong to the previous day.
    ['2026-10-25T02:30:00+02:00', '2026-10-24'],
    ['2026-10-25T02:30:00+01:00', '2026-10-24'],
    ['2026-10-25T05:59:59.999+01:00', '2026-10-24'],
    ['2026-10-25T06:00:00+01:00', '2026-10-25'],
    ['2026-01-01T05:59:59+01:00', '2025-12-31'],
    ['2026-09-01T05:59:59+02:00', '2026-08-31'],
    ['2028-03-01T05:59:59+01:00', '2028-02-29'],
  ])('%s belongs to %s', (timestamp, expected) => {
    const at = Date.parse(timestamp);
    expect(getTrainingDayKey(at)).toBe(expected);
    expect(getTrainingDate(at).toISOString()).toBe(`${expected}T00:00:00.000Z`);
  });
});

const session = (timestamp: string, weight = 10): Session => ({
  at: Date.parse(timestamp), topWeightKg: weight,
  repsAtTopWeight: 8, sets: 1, volumeKg: weight * 8,
});

describe('training periods in strength and volume charts', () => {
  it('keeps Monday evening and Tuesday before 06:00 in the same daily candle', () => {
    const sessions = [
      session('2026-11-09T23:00:00+01:00', 10),
      session('2026-11-10T01:00:00+01:00', 12),
      session('2026-11-10T05:59:59.999+01:00', 14),
      session('2026-11-10T06:00:00+01:00', 16),
    ];
    const candles = buildCandles(sessions, 'Day', 'weight');
    expect(candles).toHaveLength(2);
    expect(candles[0]).toMatchObject({
      key: '2026-11-09', label: '9/11', full: '9 Nov 2026',
      sessions: 3, sets: 3, volumeKg: 288, c: 14,
    });
    expect(candles[1]).toMatchObject({ key: '2026-11-10', sessions: 1, o: 14, c: 16 });
    expect(sessions.map(s => getTrainingPeriodKey(s.at, 'Day'))).toEqual([
      '2026-11-09', '2026-11-09', '2026-11-09', '2026-11-10',
    ]);
  });

  it.each<[Period, string, string, string]>([
    ['Week', '2026-11-09', '+01:00', '2026-W45'],
    ['Week', '2027-01-04', '+01:00', '2026-W53'],
    ['Month', '2026-09-01', '+02:00', '2026-08'],
    ['Year', '2027-01-01', '+01:00', '2026'],
  ])('starts the new %s at 06:00 on %s', (period, day, offset, previousKey) => {
    const before = session(`${day}T05:59:59.999${offset}`);
    const after = session(`${day}T06:00:00${offset}`);
    const candles = buildCandles([before, after], period, 'weight');
    expect(candles).toHaveLength(2);
    expect(candles[0].key).toBe(previousKey);
    expect(getTrainingPeriodKey(before.at, period)).toBe(previousKey);
    expect(getTrainingPeriodKey(after.at, period)).toBe(candles[1].key);
    expect(candles[1].key).not.toBe(previousKey);
  });
});
