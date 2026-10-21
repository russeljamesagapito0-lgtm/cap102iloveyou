import { supabase } from './supabase';

export const RANGES = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

const DAY_MS = 86400000;

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

export const toDateInput = (d) => dayKey(d);

// ISO timestamp for the start of a "last N days" window (today counts as day 1).
export const sinceFor = (days) =>
  days ? startOfDay(addDays(new Date(), -(days - 1))).toISOString() : null;

// Supabase caps responses at 1000 rows, so page through until we run out.
export async function fetchAll(
  table,
  columns,
  { since = null, until = null, pageSize = 1000, max = 20000 } = {}
) {
  let rows = [];
  for (let from = 0; from < max; from += pageSize) {
    let q = supabase
      .from(table)
      .select(columns)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);
    if (since) q = q.gte('created_at', since);
    if (until) q = q.lt('created_at', until);

    const { data, error } = await q;
    if (error) throw error;
    rows = rows.concat(data || []);
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

const shortDate = (d) =>
  d.toLocaleDateString('en', { month: 'short', day: 'numeric' });

// Turns rows into chart points: daily (<=30d), weekly (90d) or monthly (all time).
export function bucketSeries(rows, days, dateKey = 'created_at') {
  const today = startOfDay(new Date());

  if (days && days <= 30) {
    const counts = {};
    rows.forEach((r) => {
      const k = dayKey(r[dateKey]);
      counts[k] = (counts[k] || 0) + 1;
    });
    const points = Array.from({ length: days }, (_, i) => {
      const d = addDays(today, -(days - 1 - i));
      return {
        day: days <= 7 ? d.toLocaleDateString('en', { weekday: 'short' }) : shortDate(d),
        count: counts[dayKey(d)] || 0,
      };
    });
    return { points, labelEvery: days <= 7 ? 1 : 5, unit: 'day' };
  }

  if (days) {
    const weeks = Math.ceil(days / 7);
    const start = addDays(today, -(weeks * 7 - 1));
    const counts = Array(weeks).fill(0);
    rows.forEach((r) => {
      const diff = Math.round((startOfDay(r[dateKey]) - start) / DAY_MS);
      const i = Math.floor(diff / 7);
      if (i >= 0 && i < weeks) counts[i] += 1;
    });
    const points = counts.map((count, i) => ({
      day: shortDate(addDays(start, i * 7)),
      count,
    }));
    return { points, labelEvery: 2, unit: 'week' };
  }

  if (!rows.length) return { points: [], labelEvery: 1, unit: 'month' };

  const earliest = rows.reduce((min, r) => {
    const t = new Date(r[dateKey]).getTime();
    return t < min ? t : min;
  }, Infinity);

  let cursor = new Date(new Date(earliest).getFullYear(), new Date(earliest).getMonth(), 1);
  const now = new Date();
  const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (cursor.getTime() === endMonth.getTime()) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1); // need 2+ points
  }

  const counts = {};
  rows.forEach((r) => {
    const d = new Date(r[dateKey]);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    counts[k] = (counts[k] || 0) + 1;
  });

  const points = [];
  for (let d = new Date(cursor); d <= endMonth; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    points.push({
      day: d.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      count: counts[`${d.getFullYear()}-${d.getMonth()}`] || 0,
    });
  }
  return { points, labelEvery: Math.max(1, Math.ceil(points.length / 12)), unit: 'month' };
}

// ---------------------------------------------------------------------------
// Disease code normalization
//
// Scans in the database have a mix of code formats (older models wrote 'CBB',
// uppercase, or null). Before looking up a display name we normalize.
// ---------------------------------------------------------------------------
const CODE_ALIASES = {
  cbb: 'bacterial_blight',
  cbsd: 'cassava_brown_streak',
  cmd: 'cassava_mosaic',
  cgm: 'green_mite',
  cad: 'anthracnose',
};

export const normalizeDiseaseCode = (raw) => {
  if (raw === null || raw === undefined) return null;
  const key = String(raw).trim().toLowerCase();
  if (!key) return null;
  return CODE_ALIASES[key] || key;
};

export function summarizeByDisease(scans, names = {}) {
  const map = {};
  scans.forEach((s) => {
    // Prefer disease_name (the human-readable label). Fall back to code lookup.
    const nameFromRow =
      s.disease_name && String(s.disease_name).trim()
        ? String(s.disease_name).trim()
        : null;
    const code = normalizeDiseaseCode(s.disease_code);
    const displayName = nameFromRow || (code ? names[code] : null);

    // Skip scans that have no resolvable disease at all.
    if (!displayName) return;

    const m = (map[displayName] ||= {
      code: code || null,
      name: displayName,
      scans: 0,
      confSum: 0,
      corrected: 0,
      flagged: 0,
    });

    m.scans += 1;
    m.confSum += Number(s.confidence) || 0;
    if (s.corrected) m.corrected += 1;
    if (s.flagged) m.flagged += 1;
  });
  return Object.values(map).sort((a, b) => b.scans - a.scans);
}

export const pct = (n, d, digits = 0) =>
  d ? `${((n / d) * 100).toFixed(digits)}%` : '0%';

export const avgConfidence = (scans) =>
  scans.length
    ? `${((scans.reduce((t, s) => t + (Number(s.confidence) || 0), 0) / scans.length) * 100).toFixed(1)}%`
    : '—';

export const personName = (p) => p?.full_name || p?.email || 'Unknown';