// Simple horizontal bar list. items: [{ label, value }]
export default function BarList({ items = [], total, empty = 'No data in this period.' }) {
  if (!items.length) return <div className="chart-empty">{empty}</div>;

  const max = Math.max(1, ...items.map((i) => i.value));
  const sum = total ?? items.reduce((t, i) => t + i.value, 0);

  return (
    <div className="bar-list">
      {items.map((i) => (
        <div className="bar-row" key={i.label}>
          <div className="bar-head">
            <span className="bar-label">{i.label}</span>
            <span className="bar-value">
              {i.value}
              <span className="text-muted"> · {sum ? Math.round((i.value / sum) * 100) : 0}%</span>
            </span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}