import { DISEASE_INFO } from '../constants/diseaseInfo';

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
    return { name: 'Dry Season', year: current.year, start: new Date(current.year - 1, 11, 1), end: current.start };
  }
  return { name: 'Wet Season', year: current.year - 1, start: new Date(current.year - 1, 5, 1), end: new Date(current.year - 1, 11, 1) };
};

const inRange = (date, start, end) => date >= start && date < end;

export const getCurrentSeason = () => getSeason(new Date());

export const getLastSeason = () => getPreviousSeason(getSeason(new Date()));

export const seasonLabel = (season) => `${season.name} ${season.year}`;

export const filterBySeason = (scans, season) => {
  if (!season) return scans;
  return scans.filter((s) => inRange(new Date(s.createdAt), season.start, season.end));
};

const normalizeScan = (scan) => {
  let code = null;
  if (scan.diseaseCode) {
    code = scan.diseaseCode;
  } else if (scan.diseaseType === 'Healthy') {
    code = 'HEALTHY';
  } else if (scan.title) {
    const found = Object.entries(DISEASE_INFO).find(
      ([, info]) => info.name.toLowerCase() === scan.title.toLowerCase()
    );
    if (found) code = found[0];
  }
  return { ...scan, code };
};

const getDiseaseInfo = (code) => {
  if (!code) return null;
  return DISEASE_INFO[code] || null;
};

export const buildSeasonReport = (rawScans, season) => {
  const scans = filterBySeason(rawScans, season).map(normalizeScan);

  const totalScans = scans.length;

  const healthyCount = scans.filter((s) => s.code === 'HEALTHY').length;

  const diseaseScans = scans.filter((s) => s.code && s.code !== 'HEALTHY');

  const countsByCode = diseaseScans.reduce((acc, s) => {
    acc[s.code] = (acc[s.code] || 0) + 1;
    return acc;
  }, {});

  const breakdown = Object.entries(countsByCode)
    .map(([code, count]) => {
      const info = getDiseaseInfo(code);
      return {
        code,
        count,
        name: info?.name || code,
        type: info?.type || null,
        severity: info?.severity || 'Unknown',
        symptoms: info?.symptoms || '',
        treatment: info?.treatment || '',
        prevention: info?.prevention || '',
      };
    })
    .sort((a, b) => b.count - a.count);

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
    lines.push(`You also detected ${others.map((o) => `${o.name} (${o.count})`).join(' and ')}.`);
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