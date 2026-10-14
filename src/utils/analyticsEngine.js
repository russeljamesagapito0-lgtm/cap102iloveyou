// src/utils/analyticsEngine.js
import { DISEASE_INFO, getDiseaseInfo } from '../constants/diseaseInfo';


const WET_MONTHS = [5, 6, 7, 8, 9, 10];

const getSeason = (date) => {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (WET_MONTHS.includes(month)) {
    return { name: 'Wet Season', year, start: new Date(year, 5, 1), end: new Date(year, 11, 1) };
  }
  const startYear = month <= 1 ? year - 1 : year;
  return { name: 'Dry Season', year, start: new Date(startYear, 11, 1), end: new Date(year, 5, 1) };
};

const getPreviousSeason = (current) => {
  if (current.name === 'Wet Season') {
    return {
      name: 'Dry Season',
      year: current.year,
      start: new Date(current.year - 1, 11, 1),
      end: current.start,
    };
  }
  return {
    name: 'Wet Season',
    year: current.year - 1,
    start: new Date(current.year - 1, 5, 1),
    end: new Date(current.year - 1, 11, 1),
  };
};

const inRange = (date, start, end) => date >= start && date < end;

export const getCurrentSeason = () => getSeason(new Date());
export const getLastSeason = () => getPreviousSeason(getSeason(new Date()));
export const seasonLabel = (season) => `${season.name} ${season.year}`;

export const filterBySeason = (scans, season) => {
  if (!season) return scans;
  return scans.filter((s) => inRange(new Date(s.createdAt), season.start, season.end));
};

// ---------------------------------------------------------------------------
// Disease code normalization
// ---------------------------------------------------------------------------
const CODE_ALIASES = {
  cbb: 'bacterial_blight',
  cbsd: 'cassava_brown_streak',
  cmd: 'cassava_mosaic',
  cgm: 'green_mite',
  cad: 'anthracnose',
  'bacterial-blight': 'bacterial_blight',
  'brown-spot': 'brown_spot',
  'cassava-mosaic': 'cassava_mosaic',
  'green-mite': 'green_mite',
};

const normalizeDiseaseCode = (raw) => {
  if (raw === null || raw === undefined) return null;
  const key = String(raw).trim().toLowerCase();
  if (!key) return null;
  return CODE_ALIASES[key] || key;
};

const humanizeCode = (code) => {
  if (!code) return 'Unknown';
  return String(code)
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
};

const normalizeScan = (scan) => {
  let code = null;

  if (scan.diseaseCode) {
    code = normalizeDiseaseCode(scan.diseaseCode);
  } else if (scan.diseaseType === 'Healthy') {
    code = 'healthy';
  } else if (scan.title) {
    const found = Object.entries(DISEASE_INFO).find(
      ([, info]) => info.name.toLowerCase() === scan.title.toLowerCase()
    );
    if (found) code = found[0];
  }

  return { ...scan, code };
};

// ---------------------------------------------------------------------------
// Weighted disease priority
// ---------------------------------------------------------------------------
const SEVERITY_WEIGHT = { High: 3, Medium: 2, Low: 1, None: 0.5, Unknown: 1 };
const TYPE_MULTIPLIER = { Viral: 1.4, Bacterial: 1.2, Pest: 1.0, Fungal: 0.8 };

const diseaseWeight = (info) => {
  const sev = SEVERITY_WEIGHT[info?.severity] ?? 1;
  const type = TYPE_MULTIPLIER[info?.type] ?? 1;
  return sev * type;
};

const priorityScore = (count, weight) => weight * Math.sqrt(count + 1);

export const buildSeasonReport = (rawScans, season) => {
  const scans = filterBySeason(rawScans, season).map(normalizeScan);

  const totalScans = scans.length;
  const healthyCount = scans.filter((s) => s.code === 'healthy').length;
  const diseaseScans = scans.filter((s) => s.code && s.code !== 'healthy');

  const countsByCode = diseaseScans.reduce((acc, s) => {
    acc[s.code] = (acc[s.code] || 0) + 1;
    return acc;
  }, {});

  const breakdownRaw = Object.entries(countsByCode).map(([code, count]) => {
    const info = getDiseaseInfo(code);
    const weight = diseaseWeight(info);
    return {
      code,
      count,
      name: info?.name || humanizeCode(code),
      type: info?.type || null,
      severity: info?.severity || 'Unknown',
      symptoms: info?.symptoms || '',
      treatment: info?.treatment || '',
      prevention: info?.prevention || '',
      priorityScore: priorityScore(count, weight),
    };
  });

  const breakdown = breakdownRaw.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return b.count - a.count;
  });

  const topProblem = breakdown[0] || null;

  return {
    season,
    label: seasonLabel(season),
    totalScans,
    healthyCount,
    diseasedCount: diseaseScans.length,
    healthyPct: totalScans === 0 ? 0 : Math.round((healthyCount / totalScans) * 100),
    diseasedPct: totalScans === 0 ? 0 : Math.round((diseaseScans.length / totalScans) * 100),
    breakdown,
    topProblem,
  };
};

// ---------------------------------------------------------------------------
// Rolling 30-day comparison
// ---------------------------------------------------------------------------
const MS_DAY = 24 * 60 * 60 * 1000;

const scansInWindow = (scans, fromDays, toDays) => {
  const now = Date.now();
  const from = new Date(now - fromDays * MS_DAY);
  const to = new Date(now - toDays * MS_DAY);
  return scans.filter((s) => {
    const t = new Date(s.createdAt).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
};

const windowCounts = (scans, fromDays, toDays) => {
  const inWindow = scansInWindow(scans, fromDays, toDays);
  const diseased = inWindow.filter((s) => {
    const code = normalizeDiseaseCode(s.diseaseCode);
    return code && code !== 'healthy';
  });
  return { total: inWindow.length, diseased: diseased.length };
};

// ---------------------------------------------------------------------------
// Per-disease rolling trends
//
// For each disease, compare its count in the last 30 days to its count in
// the 30 days before that. Returns diseases sorted by the magnitude of
// change (biggest movers first). Only returns diseases with a nonzero
// count in at least one window.
// ---------------------------------------------------------------------------
export const buildDiseaseTrends = (rawScans) => {
  const current = scansInWindow(rawScans, 30, 0);
  const previous = scansInWindow(rawScans, 60, 30);

  const countByCode = (scans) => {
    const counts = {};
    for (const s of scans) {
      const code = normalizeDiseaseCode(s.diseaseCode);
      if (!code || code === 'healthy') continue;
      counts[code] = (counts[code] || 0) + 1;
    }
    return counts;
  };

  const currentCounts = countByCode(current);
  const previousCounts = countByCode(previous);

  const codes = new Set([
    ...Object.keys(currentCounts),
    ...Object.keys(previousCounts),
  ]);

  const trends = [];

  for (const code of codes) {
    const now = currentCounts[code] || 0;
    const before = previousCounts[code] || 0;
    const delta = now - before;

    if (delta === 0) continue;

    const info = getDiseaseInfo(code);
    const name = info?.name || humanizeCode(code);

    trends.push({
      code,
      name,
      now,
      before,
      delta,
      // Absolute magnitude for sorting: a jump from 1 → 4 is bigger than 5 → 6.
      magnitude: Math.abs(delta),
    });
  }

  return trends.sort((a, b) => b.magnitude - a.magnitude);
};

// Formats a single trend into a short human sentence.
const describeTrend = (trend) => {
  const { name, now, before, delta } = trend;

  if (before === 0 && now > 0) {
    return `${name} appeared for the first time (${now} scan${now === 1 ? '' : 's'}).`;
  }
  if (now === 0 && before > 0) {
    return `${name} cleared up (was ${before} scan${before === 1 ? '' : 's'}).`;
  }
  if (delta > 0) {
    return `${name} increased from ${before} to ${now} scan${now === 1 ? '' : 's'}.`;
  }
  return `${name} dropped from ${before} to ${now} scan${now === 1 ? '' : 's'}.`;
};

export const buildRollingComparison = (rawScans) => {
  const current = windowCounts(rawScans, 30, 0);
  const previous = windowCounts(rawScans, 60, 30);

  if (current.total === 0 && previous.total === 0) return null;

  const currentRate =
    current.total === 0 ? 0 : Math.round((current.diseased / current.total) * 100);
  const previousRate =
    previous.total === 0 ? 0 : Math.round((previous.diseased / previous.total) * 100);
  const rateDiff = currentRate - previousRate;

  let trend;
  let text;

  if (previous.total === 0) {
    trend = 'baseline';
    text = `First 30 days of data — ${current.diseased} of ${current.total} scans showed disease.`;
  } else if (current.total === 0) {
    trend = 'quiet';
    text = 'No scans in the last 30 days. Scan regularly to track changes.';
  } else if (rateDiff >= 10) {
    trend = 'worsening';
    text = `Disease rate up ${rateDiff} points — ${current.diseased} of ${current.total} scans in the last 30 days (was ${previous.diseased} of ${previous.total}).`;
  } else if (rateDiff <= -10) {
    trend = 'improving';
    text = `Disease rate down ${Math.abs(rateDiff)} points — ${current.diseased} of ${current.total} scans in the last 30 days (was ${previous.diseased} of ${previous.total}).`;
  } else {
    trend = 'stable';
    text = `Disease rate steady — ${current.diseased} of ${current.total} scans in the last 30 days (was ${previous.diseased} of ${previous.total}).`;
  }

  // Per-disease driver: the disease with the biggest change that also
  // agrees with the overall direction (or is the most notable mover).
  const allTrends = buildDiseaseTrends(rawScans);
  let driver = null;
  let driverText = null;

  if (allTrends.length > 0) {
    if (trend === 'worsening') {
      // Prefer a disease that went up
      driver = allTrends.find((t) => t.delta > 0) || allTrends[0];
    } else if (trend === 'improving') {
      driver = allTrends.find((t) => t.delta < 0) || allTrends[0];
    } else {
      driver = allTrends[0];
    }
    if (driver) driverText = describeTrend(driver);
  }

  return {
    current,
    previous,
    currentRate,
    previousRate,
    rateDiff,
    trend,
    text,
    driver,
    driverText,
  };
};

// ---------------------------------------------------------------------------
// Action checklist
// ---------------------------------------------------------------------------
const ICON_FOR_ACTION = {
  urgent: 'alert-circle-outline',
  protect: 'shield-checkmark-outline',
  treat: 'medkit-outline',
  monitor: 'eye-outline',
};

const ACTION_LABEL = {
  urgent: 'Act now',
  protect: 'Protect now',
  treat: 'Treat now',
  monitor: 'Monitor',
};

const severityToActionKind = (severity, type) => {
  const isViral = type === 'Viral';
  if (severity === 'High' && isViral) return 'urgent';
  if (severity === 'High' && !isViral) return 'treat';
  if (severity === 'Medium') return 'protect';
  return 'monitor';
};

export const buildActionChecklist = (report) => {
  if (!report || report.totalScans === 0) return [];

  if (report.diseasedCount === 0) {
    return [
      {
        id: 'keep-going',
        kind: 'monitor',
        label: 'Keep up your current routine',
        detail:
          'All your scans came back healthy. Continue weekly monitoring to catch problems early.',
      },
    ];
  }

  const actions = [];

  for (const disease of report.breakdown.slice(0, 4)) {
    const kind = severityToActionKind(disease.severity, disease.type);
    const count = disease.count;

    let detail = '';
    if (kind === 'urgent' && disease.prevention) {
      detail = disease.prevention;
    } else if (disease.treatment) {
      detail = disease.treatment;
    } else if (disease.prevention) {
      detail = disease.prevention;
    } else if (disease.symptoms) {
      detail = `Watch for: ${disease.symptoms}`;
    }

    actions.push({
      id: disease.code,
      kind,
      label:
        count === 1
          ? `${disease.name} on 1 plant`
          : `${disease.name} on ${count} plants`,
      detail,
      disease,
    });
  }

  actions.push({
    id: 'scan-weekly',
    kind: 'monitor',
    label: 'Scan weekly',
    detail:
      'Regular scanning catches disease in the first days, when treatment is still possible.',
  });

  return actions;
};

export const ACTION_META = { ICON_FOR_ACTION, ACTION_LABEL };

// ---------------------------------------------------------------------------
// Headline advice + comparisons
// ---------------------------------------------------------------------------
export const buildComparison = (currentReport, previousReport) => {
  if (!currentReport || !previousReport) return null;
  const curr = currentReport.diseasedCount;
  const prev = previousReport.diseasedCount;
  const diff = curr - prev;
  return {
    curr,
    prev,
    diff,
    text:
      diff === 0
        ? 'Same number of diseased scans as last season'
        : diff > 0
        ? `${diff} more diseased scan${diff === 1 ? '' : 's'} than last season`
        : `${Math.abs(diff)} fewer diseased scan${Math.abs(diff) === 1 ? '' : 's'} than last season`,
  };
};

export const buildHeadlineAdvice = (report) => {
  if (report.totalScans === 0) return null;

  if (report.diseasedCount === 0) {
    return {
      title: 'Excellent season',
      body: `All ${report.totalScans} of your scans came back healthy. Keep doing what you're doing — monitor weekly and maintain your current care routine.`,
    };
  }

  const top = report.topProblem;
  const others = report.breakdown.slice(1, 3);

  const lines = [
    `Your main issue this season was ${top.name} (${top.count} scan${top.count === 1 ? '' : 's'}).`,
  ];
  if (others.length) {
    lines.push(
      `You also detected ${others.map((o) => `${o.name} (${o.count})`).join(' and ')}.`
    );
  }
  lines.push(`Focus on the prevention steps below before your next planting.`);

  return {
    title: `Your main problem was ${top.name}`,
    body: lines.join(' '),
  };
};

export const buildAvoidList = (report) => {
  const items = [];
  for (const b of report.breakdown) {
    const m = b.prevention.match(/avoid[^.,;]*[.,;]?/gi);
    if (m) m.forEach((line) => items.push({ disease: b.name, text: line.trim() }));
  }
  return items;
};