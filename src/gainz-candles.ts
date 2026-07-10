/* ============================================================
   GAINZ — candlestick model + chart geometry
   Drop-in reference implementation. Ported verbatim from the
   validated logic in gainz-design.html. Do not re-derive this;
   it is the subtlest part of the app and it is already correct.

   INVARIANTS (assert these in tests — see Section 25):
     1. Every Day candle is wickless:  h === max(o,c) && l === min(o,c)
     2. The series is gapless:         candle[i].o === candle[i-1].c
     3. Week/Month/Year candles grow a wick whenever a session
        inside the period escaped the open→close body.
     4. up === (c >= o). Green when up, red when not.
     5. Periods with no sessions produce NO candle, and the next
        candle's open still carries from the last real close.
   ============================================================ */

export type Period = 'Day' | 'Week' | 'Month' | 'Year';

/** Metrics that have a meaningful open and close, so can be candles.
 *  Sets and Volume are period TOTALS — they belong in the lower pane. */
export type CandleMetric = 'weight' | 'reps';

/** The upper bound on the zoom slider, per period (Section 17). */
export const MAX_CANDLES: Record<Period, number> = {
  Day: 365,
  Week: 52,
  Month: 12,
  Year: 50,
};

/** One workout's contribution to the series, for one exercise. */
export interface Session {
  /** epoch ms — the workout's startedAt */
  at: number;
  topWeightKg: number;
  repsAtTopWeight: number;
  sets: number;
  volumeKg: number;
}

export interface Candle {
  key: string;
  /** short label for the x axis, e.g. "W27" */
  label: string;
  /** long label for the tap readout, e.g. "Week 27, 2026" */
  full: string;
  o: number;
  h: number;
  l: number;
  c: number;
  up: boolean;
  /** period totals — drive the lower pane */
  volumeKg: number;
  sets: number;
  /** how many workouts fell inside this period */
  sessions: number;
  /** heaviest set in the period, and the reps done at it */
  topWeightKg: number;
  repsAtTopWeight: number;
}

/* ---------- period bucketing ---------- */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** ISO-8601 week number. Weeks start Monday; week 1 contains the first Thursday. */
export function isoWeek(d: Date): [number, number] {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return [t.getUTCFullYear(), week];
}

const KEY: Record<Period, (d: Date) => string> = {
  Day:   d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
  Week:  d => isoWeek(d).join('-'),
  Month: d => `${d.getFullYear()}-${d.getMonth()}`,
  Year:  d => `${d.getFullYear()}`,
};

const LABEL: Record<Period, (d: Date) => string> = {
  Day:   d => `${d.getDate()}/${d.getMonth() + 1}`,
  Week:  d => `W${isoWeek(d)[1]}`,
  Month: d => MONTHS[d.getMonth()],
  Year:  d => `${d.getFullYear()}`,
};

const FULL: Record<Period, (d: Date) => string> = {
  Day:   d => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  Week:  d => `Week ${isoWeek(d)[1]}, ${isoWeek(d)[0]}`,
  Month: d => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  Year:  d => `${d.getFullYear()}`,
};

/* ---------- the model ---------- */

/**
 * Build the candle series.
 *
 * For a period holding sessions v1..vk (chronological):
 *
 *     open  = the close carried in from the previous period
 *             (for the very first candle, v1 itself)
 *     close = vk
 *     high  = max(open, v1..vk)
 *     low   = min(open, v1..vk)
 *
 * A Day holds exactly one session, so high and low collapse onto
 * the body and daily candles have no wicks. A Week holds several,
 * so a mid-week dip that the body never reaches becomes a lower
 * wick — which is the whole point of the chart.
 *
 * Carrying the open from the previous close makes the series
 * gapless, exactly as a trading chart behaves, and means the
 * green/red colour always answers "did I improve since last time".
 *
 * @param sessions MUST be sorted ascending by `at`.
 */
export function buildCandles(
  sessions: Session[],
  period: Period,
  metric: CandleMetric,
): Candle[] {
  const pick = (s: Session) => (metric === 'weight' ? s.topWeightKg : s.repsAtTopWeight);

  interface Bucket {
    key: string; label: string; full: string;
    vals: number[]; volumeKg: number; sets: number;
    sessions: number; topWeightKg: number; repsAtTopWeight: number;
  }

  const map = new Map<string, Bucket>();
  const order: Bucket[] = [];

  for (const s of sessions) {
    const d = new Date(s.at);
    const key = KEY[period](d);
    let b = map.get(key);
    if (!b) {
      b = { key, label: LABEL[period](d), full: FULL[period](d),
            vals: [], volumeKg: 0, sets: 0, sessions: 0,
            topWeightKg: 0, repsAtTopWeight: 0 };
      map.set(key, b);
      order.push(b);   // insertion order === chronological, because sessions are sorted
    }
    b.vals.push(pick(s));
    b.volumeKg += s.volumeKg;
    b.sets += s.sets;
    b.sessions += 1;
    if (s.topWeightKg > b.topWeightKg) {
      b.topWeightKg = s.topWeightKg;
      b.repsAtTopWeight = s.repsAtTopWeight;
    }
  }

  let prevClose: number | null = null;
  return order.map(b => {
    const o = prevClose === null ? b.vals[0] : prevClose;
    const c = b.vals[b.vals.length - 1];
    // loop rather than Math.max(o, ...b.vals): a Year bucket can hold
    // hundreds of sessions, and spreading them is a needless stack risk
    let h = o, l = o;
    for (const v of b.vals) { if (v > h) h = v; if (v < l) l = v; }
    prevClose = c;
    return {
      key: b.key, label: b.label, full: b.full,
      o, h, l, c, up: c >= o,
      volumeKg: b.volumeKg, sets: b.sets, sessions: b.sessions,
      topWeightKg: b.topWeightKg, repsAtTopWeight: b.repsAtTopWeight,
    };
  });
}

/** True when the candle needs a wick drawn at all. Days never do. */
export function hasWick(k: Candle): boolean {
  const EPS = 1e-9;
  return k.h > Math.max(k.o, k.c) + EPS || k.l < Math.min(k.o, k.c) - EPS;
}

/* ---------- turning stored sets into sessions ---------- */

export interface SetRow {
  workoutId: number;
  /** real workout start; supplied by chartRowsForExercise() */
  workoutStartedAt?: number;
  performedAt: number;
  weightKg: number;
  reps: number;
}

/**
 * Collapse the `sets` rows for ONE exercise into one Session per workout.
 * Feed it chartRowsForExercise() from gainz-db.ts so the session timestamp
 * is the workout's real startedAt rather than the first set timestamp.
 *
 * Volume is weightKg * reps. Nothing else. Do not scale it by equipment,
 * and in particular do not double a dumbbell weight because there are two
 * dumbbells — a 20 kg curl for 10 reps is 200, exactly as entered. See
 * Section 10. `perHand` chooses a label and never enters a calculation.
 */
export function sessionsFromSets(rows: SetRow[]): Session[] {
  const byWorkout = new Map<number, SetRow[]>();
  for (const r of rows) {
    const arr = byWorkout.get(r.workoutId);
    if (arr) arr.push(r); else byWorkout.set(r.workoutId, [r]);
  }

  const out: Session[] = [];
  for (const setRows of byWorkout.values()) {
    setRows.sort((a, b) => a.performedAt - b.performedAt);
    let topWeightKg = -Infinity;
    let repsAtTopWeight = 0;
    let volumeKg = 0;
    for (const r of setRows) {
      volumeKg += r.weightKg * r.reps;
      if (r.weightKg > topWeightKg) {   // strict >: the FIRST set at the top weight wins
        topWeightKg = r.weightKg;
        repsAtTopWeight = r.reps;
      }
    }
    out.push({
      at: setRows[0].workoutStartedAt ?? setRows[0].performedAt,
      topWeightKg,
      repsAtTopWeight,
      sets: setRows.length,
      volumeKg,
    });
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

/* ---------- chart geometry ---------- */

export const CHART = {
  PRICE_H: 200,   // candle pane height, px
  PANE_GAP: 14,
  VOL_H: 52,      // lower pane height, px
  XLBL_H: 18,
  AXIS_W: 46,     // pinned right-hand value axis — does NOT scroll
  MIN_SLOT: 3,    // below this the chart scrolls instead of shrinking
} as const;

export const CHART_TOTAL_H = CHART.PRICE_H + CHART.PANE_GAP + CHART.VOL_H + CHART.XLBL_H;
export const VOL_TOP = CHART.PRICE_H + CHART.PANE_GAP;

export interface Layout {
  slot: number;         // horizontal space per candle
  candleW: number;      // body width
  wickW: number;
  labelEvery: number;   // draw an x label every Nth candle
  contentWidth: number; // svg width
  scrolls: boolean;
}

/**
 * Fit `n` candles into `plotWidth` px (i.e. frame width minus AXIS_W).
 * These constants are tuned, not arbitrary — 62% gives a body/gap ratio
 * that reads as a candle chart, the 34px cap stops a 5-candle view
 * producing absurd slabs, and 25px keeps x labels from touching.
 *
 * An exercise with no history is a normal state, so this returns a safe
 * empty layout rather than Infinity when there is nothing to draw.
 */
export function candleLayout(n: number, plotWidth: number): Layout {
  if (n < 1 || plotWidth <= 0) {
    return { slot: 0, candleW: 0, wickW: 0, labelEvery: 1,
             contentWidth: CHART.AXIS_W, scrolls: false };
  }
  let slot = plotWidth / n;
  const scrolls = slot < CHART.MIN_SLOT;
  if (scrolls) slot = CHART.MIN_SLOT;
  const candleW = Math.max(1, Math.min(34, Math.round(slot * 0.62)));
  return {
    slot,
    candleW,
    wickW: candleW >= 8 ? 2 : 1,
    labelEvery: Math.max(1, Math.ceil(25 / slot)),
    contentWidth: n * slot + CHART.AXIS_W,
    scrolls,
  };
}

/** Rounded gridline interval. Never hardcode gridline values.
 *  Returns 1 for a zero or non-finite range: a step of 0 makes any
 *  `for (v = lo; v <= hi; v += step)` loop spin forever. */
export function niceStep(range: number, target = 4): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
}

/** Gridline values across [lo, hi], and the value→y mapper. */
export function priceScale(candles: Candle[], height = CHART.PRICE_H) {
  if (candles.length === 0) {
    return { hi: 1, lo: 0, lines: [] as number[], y: () => height };
  }
  let hi = Math.max(...candles.map(k => k.h));
  let lo = Math.min(...candles.map(k => k.l));
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.10;          // 10% headroom top and bottom
  hi += pad; lo -= pad;

  const step = niceStep(hi - lo, 4);
  const lines: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    lines.push(Math.round(v * 1000) / 1000);
  }
  return { hi, lo, lines, y: (v: number) => height - ((v - lo) / (hi - lo)) * height };
}

/* ============================================================
   RENDERING NOTE — this will cost you an hour if you skip it.

   Render the chart as SVG. When you build the SVG, do NOT write
   fill="var(--gain)" as a presentation ATTRIBUTE: var() is not
   reliably resolved there. Read the tokens once per render and
   inline the concrete values:

     const cs = getComputedStyle(document.documentElement);
     const gain = cs.getPropertyValue('--gain').trim();

   Then re-render the chart when the theme changes, since the
   inlined colours will not update on their own.
   ============================================================ */
