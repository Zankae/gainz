interface ChartDetailsProps {
  title: string;
  stats: { label: string; value: string | number; color?: string }[];
  onClose: () => void;
}

export default function ChartDetails({ title, stats, onClose }: ChartDetailsProps) {
  return (
    <div role="region" aria-label={`${title} details`} style={{
      position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
      maxWidth: 440, width: 'calc(100% - 24px)', zIndex: 300,
      padding: '12px 16px', borderRadius: 'var(--radius)', background: 'var(--surface)',
      boxShadow: '0 -4px 20px var(--shadow)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>{title}</span>
        <button aria-label="Close chart details" onClick={onClose} style={{ fontSize: 16, color: 'var(--muted)' }}>✕</button>
      </div>
      <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 13 }}>
        {stats.map(({ label, value, color }) => (
          <div key={label} style={{ display: 'contents' }}>
            <dt style={{ color: 'var(--muted)' }}>{label}</dt>
            <dd style={{ margin: 0, fontFamily: 'var(--font-display)', textAlign: 'right', color }}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface ChartPointButtonProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  pressed: boolean;
  onSelect: () => void;
}

export function ChartPointButton({ x, y, width, height, label, pressed, onSelect }: ChartPointButtonProps) {
  return (
    <rect x={x} y={y} width={width} height={height} fill="transparent" style={{ cursor: 'pointer' }}
      role="button" tabIndex={0} aria-label={label} aria-pressed={pressed}
      onClick={onSelect} onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}>
      <title>{label}</title>
    </rect>
  );
}
