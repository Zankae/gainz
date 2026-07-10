import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { chartRowsForExercise, type Exercise } from '../gainz-db';
import {
  sessionsFromSets, buildCandles, hasWick, candleLayout, priceScale,
  CHART, CHART_TOTAL_H, VOL_TOP,
  type Period, type CandleMetric, type Candle,
} from '../gainz-candles';
import { useTheme } from '../theme';

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
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(52);
  const [selectedCandle, setSelectedCandle] = useState<Candle | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedCandle(null);
    (async () => {
      if (!exercise.id) return;
      const rows = await chartRowsForExercise(exercise.id);
      const sessions = sessionsFromSets(rows);
      if (!sessions.length) { setCandles([]); setLoading(false); return; }
      const c = buildCandles(sessions, period, metric);
      setCandles(c);
      setZoom(c.length);
      setLoading(false);
    })();
  }, [exercise.id, period, metric]);

  const visible = useMemo(() => candles.slice(Math.max(0, candles.length - zoom)), [candles, zoom]);

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

  const candleBodyY = useCallback((c: Candle) => {
    const top = Math.max(c.o, c.c);
    const bottom = Math.min(c.o, c.c);
    return { y: scale.y(top), h: Math.max(1, scale.y(bottom) - scale.y(top)) };
  }, [scale]);

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Loading chart…</div>;
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
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
              background: period === p.key ? 'var(--accent)' : 'transparent',
              color: period === p.key ? 'var(--on-accent)' : 'var(--muted)',
            }}>{p.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          {METRICS.map(m => (
            <button key={m.key} onClick={() => setMetric(m.key)} style={{
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
          <input type="range" min={Math.min(candles.length, 4)} max={candles.length} value={zoom}
            onChange={e => setZoom(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
          <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 30, fontFamily: 'var(--font-display)' }}>{zoom}</span>
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

            return (
              <g key={c.key}>
                {/* Wick */}
                {hasWick(c) && (
                  <line x1={cx} x2={cx} y1={scale.y(c.h)} y2={scale.y(c.l)}
                    stroke={color} strokeWidth={layout.wickW} />
                )}
                {/* Body — tappable */}
                <rect x={bx} y={body.y} width={layout.candleW} height={body.h}
                  fill={color} rx={2} style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedCandle(c)} />
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

      {/* Selected candle OHLC readout */}
      {selectedCandle && (
        <div style={{ marginTop: 10, padding: '12px 16px', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>{selectedCandle.full}</span>
            <button onClick={() => setSelectedCandle(null)} style={{ fontSize: 16, color: 'var(--muted)' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 13 }}>
            <div style={{ color: 'var(--muted)' }}>Open</div>
            <div style={{ fontFamily: 'var(--font-display)', textAlign: 'right' }}>{selectedCandle.o.toFixed(metric === 'weight' ? 2 : 0)}</div>
            <div style={{ color: 'var(--muted)' }}>High</div>
            <div style={{ fontFamily: 'var(--font-display)', textAlign: 'right', color: 'var(--gain)' }}>{selectedCandle.h.toFixed(metric === 'weight' ? 2 : 0)}</div>
            <div style={{ color: 'var(--muted)' }}>Low</div>
            <div style={{ fontFamily: 'var(--font-display)', textAlign: 'right', color: 'var(--loss)' }}>{selectedCandle.l.toFixed(metric === 'weight' ? 2 : 0)}</div>
            <div style={{ color: 'var(--muted)' }}>Close</div>
            <div style={{ fontFamily: 'var(--font-display)', textAlign: 'right' }}>{selectedCandle.c.toFixed(metric === 'weight' ? 2 : 0)}</div>
            <div style={{ color: 'var(--muted)' }}>Volume</div>
            <div style={{ fontFamily: 'var(--font-display)', textAlign: 'right' }}>{Math.round(selectedCandle.volumeKg)} kg</div>
            <div style={{ color: 'var(--muted)' }}>Sets</div>
            <div style={{ fontFamily: 'var(--font-display)', textAlign: 'right' }}>{selectedCandle.sets}</div>
          </div>
        </div>
      )}
    </div>
  );
}
