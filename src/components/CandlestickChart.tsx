import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { chartRowsForExercise, type Exercise } from '../gainz-db';
import {
  sessionsFromSets, buildCandles, hasWick, candleLayout, priceScale,
  CHART, CHART_TOTAL_H, VOL_TOP,
  type Period, type CandleMetric, type Candle, type Session,
} from '../gainz-candles';
import { useTheme } from '../theme';
import ChartDetails, { ChartPointButton } from './ChartDetails';

interface CandlestickChartProps { exercise: Exercise; }

const PERIODS: { key: Period; label: string }[] = [
  { key: 'Day', label: '1D' }, { key: 'Week', label: '1W' }, { key: 'Month', label: '1M' }, { key: 'Year', label: '1Y' },
];
const METRICS: { key: CandleMetric; label: string }[] = [
  { key: 'weight', label: 'Weight' }, { key: 'reps', label: 'Reps' },
];

export default function CandlestickChart({ exercise }: CandlestickChartProps) {
  const { theme } = useTheme();
  const [period, setPeriod] = useState<Period>('Week');
  const [metric, setMetric] = useState<CandleMetric>('weight');
  const [history, setHistory] = useState<{ exerciseId: number; sessions: Session[] | 'error' }>();
  const [zoom, setZoom] = useState<number>();
  const [selectedCandle, setSelectedCandle] = useState<Candle | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const exerciseId = exercise.id;
  const sessions = history?.exerciseId === exerciseId ? history?.sessions : undefined;

  useEffect(() => {
    if (exerciseId === undefined) return;
    setSelectedCandle(null);
    setZoom(undefined);
    let current = true;
    chartRowsForExercise(exerciseId).then(
      rows => { if (current) setHistory({ exerciseId, sessions: sessionsFromSets(rows) }); },
      () => { if (current) setHistory({ exerciseId, sessions: 'error' }); },
    );
    return () => { current = false; };
  }, [exerciseId]);

  const candles = useMemo(
    () => sessions && sessions !== 'error' ? buildCandles(sessions, period, metric) : [],
    [sessions, period, metric],
  );
  const visibleCount = zoom ?? candles.length;
  const visible = useMemo(() => candles.slice(Math.max(0, candles.length - visibleCount)), [candles, visibleCount]);

  const colors = useMemo(() => {
    if (typeof document === 'undefined') return { gain: '#34D877', loss: '#F45B69', grid: '#232B36', muted: '#8A94A3' };
    const cs = getComputedStyle(document.documentElement);
    return {
      gain: cs.getPropertyValue('--gain').trim() || '#34D877',
      loss: cs.getPropertyValue('--loss').trim() || '#F45B69',
      grid: cs.getPropertyValue('--grid').trim() || '#232B36',
      muted: cs.getPropertyValue('--muted').trim() || '#8A94A3',
    };
  }, [theme]);

  const AXIS = 50; // Left axis width

  const layout = useMemo(() => candleLayout(visible.length, 320 - AXIS), [visible.length]);
  const scale = useMemo(() => priceScale(visible), [visible]);
  const volMax = useMemo(() => visible.length ? Math.max(...visible.map(c => c.volumeKg)) : 1, [visible]);
  const hitWidth = Math.min(layout.slot, Math.max(layout.candleW, 24));
  const decimals = metric === 'weight' ? 2 : 0;

  const candleBodyY = useCallback((c: Candle) => {
    const top = Math.max(c.o, c.c);
    const bottom = Math.min(c.o, c.c);
    return { y: scale.y(top), h: Math.max(1, scale.y(bottom) - scale.y(top)) };
  }, [scale]);

  function resetSelection() {
    setSelectedCandle(null);
    setZoom(undefined);
  }

  if (sessions === undefined) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Loading chart…</div>;
  }
  if (sessions === 'error') {
    return <div role="alert" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Could not load strength progress.</div>;
  }
  if (!candles.length) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No data yet. Complete a workout to see progress.</div>;
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => {
              if (period !== p.key) resetSelection();
              setPeriod(p.key);
            }} style={{
              padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
              background: period === p.key ? 'var(--accent)' : 'transparent',
              color: period === p.key ? 'var(--on-accent)' : 'var(--muted)',
            }}>{p.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          {METRICS.map(m => (
            <button key={m.key} onClick={() => {
              if (metric !== m.key) resetSelection();
              setMetric(m.key);
            }} style={{
              padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
              background: metric === m.key ? 'var(--accent)' : 'transparent',
              color: metric === m.key ? 'var(--on-accent)' : 'var(--muted)',
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {candles.length > 4 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 30 }}>Zoom</span>
          <input type="range" min={Math.min(candles.length, 4)} max={candles.length} value={visibleCount}
            onChange={e => setZoom(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
          <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 30, fontFamily: 'var(--font-display)' }}>{visibleCount}</span>
        </div>
      )}

      <div ref={scrollRef} style={{
        overflowX: layout.scrolls ? 'auto' : 'hidden', background: 'var(--surface)',
        borderRadius: 'var(--radius)', padding: '8px 0',
      }}>
        <svg width={Math.max(320, layout.contentWidth + AXIS)} height={CHART_TOTAL_H}
          viewBox={`0 0 ${Math.max(320, layout.contentWidth + AXIS)} ${CHART_TOTAL_H}`}>

          {/* Left axis line */}
          <line x1={AXIS} x2={AXIS} y1={0} y2={CHART_TOTAL_H} stroke={colors.grid} strokeWidth="0.5" />

          {/* Gridlines with left labels */}
          {scale.lines.map((v, i) => (
            <g key={i}>
              <line x1={AXIS} x2={Math.max(320, layout.contentWidth + AXIS)} y1={scale.y(v)} y2={scale.y(v)}
                stroke={colors.grid} strokeWidth="0.5" />
              <text x={AXIS - 4} y={scale.y(v) + 4} textAnchor="end" fill={colors.muted} fontSize="10"
                fontFamily="var(--font-display)">
                {metric === 'weight' ? v.toFixed(1) : v}
              </text>
            </g>
          ))}

          {/* Volume histogram */}
          {metric === 'weight' && visible.map((c, i) => {
            const barH = volMax > 0 ? (c.volumeKg / volMax) * CHART.VOL_H : 0;
            return (
              <rect key={`vol-${c.key}`}
                x={AXIS + i * layout.slot + (layout.slot - layout.candleW) / 2}
                y={VOL_TOP + CHART.VOL_H - barH}
                width={layout.candleW} height={Math.max(1, barH)}
                fill={c.up ? colors.gain : colors.loss}
                opacity={c.up ? 0.3 : 0.25} />
            );
          })}

          {/* Candles */}
          {visible.map((c, i) => {
            const body = candleBodyY(c);
            const color = c.up ? colors.gain : colors.loss;
            const cx = AXIS + i * layout.slot + layout.slot / 2;
            const bx = AXIS + i * layout.slot + (layout.slot - layout.candleW) / 2;
            const highY = scale.y(c.h);
            const lowY = scale.y(c.l);
            const hitTop = Math.max(0, highY - 8);
            const hitBottom = Math.min(CHART.PRICE_H, Math.max(lowY, body.y + body.h) + 8);

            return (
              <g key={c.key}>
                {/* Wick */}
                {hasWick(c) && (
                  <line x1={cx} x2={cx} y1={highY} y2={lowY}
                    stroke={color} strokeWidth={layout.wickW} />
                )}
                <rect x={bx} y={body.y} width={layout.candleW} height={body.h} fill={color} rx={2} />
                <ChartPointButton x={cx - hitWidth / 2} y={hitTop} width={hitWidth} height={hitBottom - hitTop}
                  label={c.full} pressed={selectedCandle?.key === c.key} onSelect={() => setSelectedCandle(c)} />
                {/* X label */}
                {i % layout.labelEvery === 0 && (
                  <text x={cx} y={CHART_TOTAL_H - 2} textAnchor="middle" fill={colors.muted} fontSize="10">
                    {c.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {selectedCandle && (
        <ChartDetails title={selectedCandle.full} onClose={() => setSelectedCandle(null)} stats={[
          { label: 'Open', value: selectedCandle.o.toFixed(decimals) },
          { label: 'High', value: selectedCandle.h.toFixed(decimals), color: 'var(--gain)' },
          { label: 'Low', value: selectedCandle.l.toFixed(decimals), color: 'var(--loss)' },
          { label: 'Close', value: selectedCandle.c.toFixed(decimals) },
          { label: 'Volume', value: `${Math.round(selectedCandle.volumeKg)} kg` },
          { label: 'Sets', value: selectedCandle.sets },
        ]} />
      )}
    </div>
  );
}
