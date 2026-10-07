import { useState } from 'react';

const WIDTH = 1000;
const PAD_X = 40;
const PAD_TOP = 24;
const PAD_BOTTOM = 40;
const GRID_STEPS = [0, 0.25, 0.5, 0.75, 1];

const toPoints = (data, innerW, innerH, max) =>
  data.map((d, i) => {
    const count = Number(d.count) || 0;
    const x = PAD_X + (i / Math.max(1, data.length - 1)) * innerW;
    const y = PAD_TOP + (1 - count / max) * innerH;
    return { x, y, day: d.day, count };
  });

const smoothPath = (points) => {
  if (points.length < 2) return '';

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
};

const formatScanLabel = (count) =>
  `${count} scan${count !== 1 ? 's' : ''}`;

export default function LineChart({ data = [], height = 220 }) {
  const [hover, setHover] = useState(null);

  if (!data.length) return null;

  const innerW = WIDTH - PAD_X * 2;
  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const counts = data.map((d) => Number(d.count) || 0);
  const max = Math.max(1, ...counts);
  const pts = toPoints(data, innerW, innerH, max);

  const linePath = smoothPath(pts);
  const baselineY = PAD_TOP + innerH;
  const lastPt = pts[pts.length - 1];
  const areaPath = `${linePath} L ${lastPt.x} ${baselineY} L ${pts[0].x} ${baselineY} Z`;
  const peakIndex = counts.indexOf(max);

  const hoveredPt = hover !== null ? pts[hover] : null;

  return (
    <div className="line-chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        className="line-chart-svg"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {GRID_STEPS.map((t, i) => (
          <line
            key={i}
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={PAD_TOP + innerH * t}
            y2={PAD_TOP + innerH * t}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray={t === 1 ? '0' : '3 4'}
            opacity={t === 1 ? 0.9 : 0.5}
          />
        ))}

        <path d={areaPath} fill="url(#line-fill)" />

        <path
          d={linePath}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {pts.map((p, i) => {
          const isPeak = i === peakIndex && p.count > 0;
          const isHover = hover === i;
          const emphasized = isPeak || isHover;

          return (
            <g key={i}>
              <rect
                x={p.x - innerW / (data.length * 2)}
                y={PAD_TOP}
                width={innerW / data.length}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={emphasized ? 5 : 3}
                fill="var(--card)"
                stroke="var(--primary)"
                strokeWidth={emphasized ? 2.5 : 2}
              />
            </g>
          );
        })}

        {pts.map((p, i) => {
          const isPeak = i === peakIndex && p.count > 0;
          return (
            <text
              key={i}
              x={p.x}
              y={height - 12}
              textAnchor="middle"
              fill={isPeak ? 'var(--primary)' : 'var(--textSecondary)'}
              fontSize="12"
              fontWeight={isPeak ? 700 : 500}
            >
              {p.day}
            </text>
          );
        })}
      </svg>

      {hoveredPt && (
        <div
          className="line-chart-tooltip"
          style={{ left: `${(hoveredPt.x / WIDTH) * 100}%` }}
        >
          <span className="tooltip-day">{hoveredPt.day}</span>
          <span className="tooltip-value">{formatScanLabel(hoveredPt.count)}</span>
        </div>
      )}
    </div>
  );
}