// src/utils/seasonReportPdf.js
// Builds a printable HTML representation of the season report and
// hands it to expo-print. Returns the HTML string.

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const GREEN_HEALTHY = '#2E9E4F';
const GREEN_PRIMARY = '#0D631B';
const RED = '#D9423A';
const AMBER = '#E8912D';
const TEXT = '#1A1A1A';
const TEXT_MUTED = '#6B7280';
const BORDER = '#E5E7EB';

const DISEASE_GREENS = ['#1E7A3A', '#2E9E4F', '#4CB86A', '#6ECB87', '#93DCA6'];

const formatDate = (d = new Date()) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const healthBarHtml = (healthy, breakdown, total) => {
  if (!total) return '';
  const segments = [
    { key: 'healthy', count: healthy, color: GREEN_HEALTHY },
    ...breakdown.map((d, i) => ({
      key: d.code,
      count: d.count,
      color: DISEASE_GREENS[i % DISEASE_GREENS.length],
    })),
  ].filter((s) => s.count > 0);

  const cells = segments
    .map(
      (s, i) =>
        `<td style="background:${s.color};width:${(s.count / total) * 100}%;padding:0;${
          i > 0 ? 'border-left:2px solid #ffffff;' : ''
        }">&nbsp;</td>`
    )
    .join('');

  const legend = [
    `<span style="display:inline-block;margin-right:14px;font-size:11px;color:${TEXT_MUTED}"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${GREEN_HEALTHY};margin-right:5px;"></span>Healthy <strong style="color:${TEXT}">${healthy}</strong></span>`,
    ...breakdown.map(
      (d, i) =>
        `<span style="display:inline-block;margin-right:14px;font-size:11px;color:${TEXT_MUTED}"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${
          DISEASE_GREENS[i % DISEASE_GREENS.length]
        };margin-right:5px;"></span>${escapeHtml(d.name)} <strong style="color:${TEXT}">${d.count}</strong></span>`
    ),
  ].join('');

  return `
    <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;height:14px;border-radius:7px;overflow:hidden;background:#F3F4F6;">
      <tr>${cells}</tr>
    </table>
    <div style="margin-top:10px;line-height:1.9;">${legend}</div>
  `;
};

const rollingTrendHtml = (rolling) => {
  if (!rolling) return '';

  const tone =
    rolling.trend === 'worsening'
      ? { bg: '#FEF2F2', border: RED, label: RED }
      : rolling.trend === 'improving'
      ? { bg: '#F0F9F1', border: GREEN_HEALTHY, label: GREEN_HEALTHY }
      : { bg: '#F8FAF8', border: '#D1D5DB', label: TEXT_MUTED };

  const trendLabel =
    rolling.trend === 'worsening'
      ? 'Worsening'
      : rolling.trend === 'improving'
      ? 'Improving'
      : rolling.trend === 'quiet'
      ? 'No recent activity'
      : rolling.trend === 'baseline'
      ? 'Baseline'
      : 'Steady';

  return `
    <div style="margin-top:20px;padding:12px 14px;background:${tone.bg};border-left:4px solid ${tone.border};border-radius:6px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${tone.label};margin-bottom:4px;">
        Last 30 days · ${trendLabel}
      </div>
      <div style="font-size:12px;line-height:1.55;color:${TEXT};">
        ${escapeHtml(rolling.text)}
      </div>
      ${
        rolling.driverText
          ? `<div style="font-size:11.5px;line-height:1.5;color:${TEXT_MUTED};margin-top:6px;font-weight:600;">
               ${escapeHtml(rolling.driverText)}
             </div>`
          : ''
      }
    </div>
  `;
};

const checklistHtml = (checklist) => {
  if (!checklist || checklist.length === 0) return '';

  const rows = checklist
    .map((item, i) => {
      const accent =
        item.kind === 'urgent'
          ? RED
          : item.kind === 'treat'
          ? AMBER
          : item.kind === 'protect'
          ? GREEN_PRIMARY
          : TEXT_MUTED;

      const isLast = i === checklist.length - 1;

      return `
        <tr>
          <td style="vertical-align:top;padding:12px 14px;${
            !isLast ? `border-bottom:1px solid ${BORDER};` : ''
          }">
            <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="vertical-align:top;width:28px;">
                  <div style="width:24px;height:24px;border-radius:12px;background:${accent}18;color:${accent};text-align:center;line-height:24px;font-size:11px;font-weight:800;">${i + 1}</div>
                </td>
                <td style="vertical-align:top;padding-left:8px;">
                  <div style="font-size:12.5px;font-weight:700;color:${TEXT};line-height:1.4;">${escapeHtml(item.label)}</div>
                  ${item.detail ? `<div style="font-size:11.5px;line-height:1.5;color:${TEXT_MUTED};margin-top:2px;">${escapeHtml(item.detail)}</div>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="margin-top:24px;">
      <h2 style="font-size:13px;font-weight:700;color:${TEXT};margin-bottom:10px;">What to do next</h2>
      <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
        ${rows}
      </table>
    </div>
  `;
};

const diseaseRowsHtml = (breakdown, total) =>
  breakdown
    .map((d, i) => {
      const pct = total ? Math.round((d.count / total) * 100) : 0;
      const accent = DISEASE_GREENS[i % DISEASE_GREENS.length];
      const meta = [
        d.severity && d.severity !== 'Unknown' ? `${d.severity} severity` : null,
        d.type && d.type !== 'Unknown' ? d.type : null,
      ]
        .filter(Boolean)
        .join(' · ');

      const advice = [];
      if (d.treatment) {
        advice.push(`
          <div style="margin-top:10px;padding:10px 12px;background:#F0F9F1;border-radius:6px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${GREEN_PRIMARY};margin-bottom:4px;">If still active</div>
            <div style="font-size:11.5px;line-height:1.5;color:${TEXT};">${escapeHtml(d.treatment)}</div>
          </div>
        `);
      }
      if (d.prevention) {
        advice.push(`
          <div style="margin-top:8px;padding:10px 12px;background:#F0F9F1;border-radius:6px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${GREEN_PRIMARY};margin-bottom:4px;">Before next season</div>
            <div style="font-size:11.5px;line-height:1.5;color:${TEXT};">${escapeHtml(d.prevention)}</div>
          </div>
        `);
      }

      return `
        <div style="padding:14px 14px 14px 18px;border-bottom:1px solid ${BORDER};position:relative;">
          <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${accent};"></div>
          <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top;">
                <div style="font-size:13px;font-weight:700;color:${TEXT};line-height:1.35;">${escapeHtml(d.name)}</div>
                ${meta ? `<div style="font-size:11px;color:${TEXT_MUTED};margin-top:3px;">${escapeHtml(meta)}</div>` : ''}
              </td>
              <td style="text-align:right;vertical-align:top;white-space:nowrap;padding-left:12px;">
                <div style="font-size:18px;font-weight:800;color:${TEXT};line-height:1;">${d.count}</div>
                <div style="font-size:10px;color:${TEXT_MUTED};margin-top:2px;">${pct}% of scans</div>
              </td>
            </tr>
          </table>
          ${advice.join('')}
        </div>
      `;
    })
    .join('');

export function buildSeasonReportHtml({
  report,
  comparison,
  headline,
  rolling,
  checklist,
  user,
}) {
  const generatedAt = new Date();
  const userName = user?.full_name || user?.first_name || null;
  const userRegion = user?.region || null;

  const preparedFor = userName
    ? `<div style="font-size:11px;color:${TEXT_MUTED};margin-top:2px;">Prepared for <strong style="color:${TEXT};">${escapeHtml(userName)}</strong>${
        userRegion ? ` · ${escapeHtml(userRegion)}` : ''
      }</div>`
    : '';

  const allHealthy = report.totalScans > 0 && report.breakdown.length === 0;

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>RootCare Season Report</title>
<style>
  @page { margin: 32px 28px; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: ${TEXT};
    margin: 0;
    padding: 0;
    font-size: 12px;
    line-height: 1.5;
  }
  h1, h2, h3 { margin: 0; }
</style>
</head>
<body>

  <!-- Header -->
  <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="vertical-align:top;">
        <div style="font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${GREEN_PRIMARY};">RootCare</div>
        <h1 style="font-size:24px;font-weight:800;letter-spacing:-0.4px;color:${TEXT};margin-top:4px;">Season Report</h1>
        <div style="font-size:12px;color:${TEXT_MUTED};margin-top:3px;">${escapeHtml(report.label)}</div>
        ${preparedFor}
      </td>
      <td style="text-align:right;vertical-align:top;font-size:11px;color:${TEXT_MUTED};">
        <div>Generated</div>
        <div style="font-weight:600;color:${TEXT};">${escapeHtml(formatDate(generatedAt))}</div>
      </td>
    </tr>
  </table>

  <hr style="border:none;border-top:1px solid ${BORDER};margin:0 0 20px 0;" />

  <!-- Snapshot -->
  <h2 style="font-size:13px;font-weight:700;color:${TEXT};margin-bottom:10px;">Snapshot</h2>

  <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:8px 0;margin-bottom:14px;">
    <tr>
      <td style="width:33.33%;padding:12px;border:1px solid ${BORDER};border-radius:10px;text-align:center;">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${TEXT_MUTED};">Total</div>
        <div style="font-size:22px;font-weight:800;color:${TEXT};margin-top:4px;line-height:1;">${report.totalScans}</div>
      </td>
      <td style="width:33.33%;padding:12px;border:1px solid ${BORDER};border-radius:10px;text-align:center;">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${TEXT_MUTED};">Healthy</div>
        <div style="font-size:22px;font-weight:800;color:${GREEN_HEALTHY};margin-top:4px;line-height:1;">${report.healthyCount}</div>
        <div style="font-size:10px;color:${TEXT_MUTED};margin-top:2px;">${report.healthyPct}%</div>
      </td>
      <td style="width:33.33%;padding:12px;border:1px solid ${BORDER};border-radius:10px;text-align:center;">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${TEXT_MUTED};">Diseased</div>
        <div style="font-size:22px;font-weight:800;color:${GREEN_PRIMARY};margin-top:4px;line-height:1;">${report.diseasedCount}</div>
        <div style="font-size:10px;color:${TEXT_MUTED};margin-top:2px;">${report.diseasedPct}%</div>
      </td>
    </tr>
  </table>

  ${healthBarHtml(report.healthyCount, report.breakdown, report.totalScans)}

  ${
    comparison
      ? `<div style="margin-top:16px;padding:10px 12px;background:#F8FAF8;border-radius:8px;font-size:11.5px;color:${TEXT};">
           ${escapeHtml(comparison.text)}
         </div>`
      : ''
  }

  ${rollingTrendHtml(rolling)}

  ${
    headline
      ? `<div style="margin-top:22px;">
           <h2 style="font-size:13px;font-weight:700;color:${TEXT};margin-bottom:8px;">What this means</h2>
           <div style="padding:12px 14px;background:#F0F9F1;border-left:4px solid ${GREEN_PRIMARY};border-radius:6px;">
             <div style="font-size:13px;font-weight:700;color:${TEXT};margin-bottom:4px;">${escapeHtml(headline.title)}</div>
             <div style="font-size:11.5px;line-height:1.55;color:${TEXT};">${escapeHtml(headline.body)}</div>
           </div>
         </div>`
      : ''
  }

  ${checklistHtml(checklist)}

  ${
    report.breakdown.length > 0
      ? `<div style="margin-top:24px;">
           <h2 style="font-size:13px;font-weight:700;color:${TEXT};margin-bottom:10px;">Diseases detected this season</h2>
           <div style="border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
             ${diseaseRowsHtml(report.breakdown, report.totalScans)}
           </div>
         </div>`
      : allHealthy
      ? `<div style="margin-top:24px;padding:14px;background:#F0F9F1;border-radius:10px;">
           <div style="font-size:13px;font-weight:700;color:${GREEN_HEALTHY};">No diseases detected</div>
           <div style="font-size:11.5px;color:${TEXT_MUTED};margin-top:4px;">All your scans came back healthy. Keep up your current routine and monitor weekly.</div>
         </div>`
      : ''
  }

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:14px;border-top:1px solid ${BORDER};font-size:10px;color:${TEXT_MUTED};text-align:center;">
    Generated by RootCare Companion · ${escapeHtml(formatDate(generatedAt))}
  </div>

</body>
</html>
  `.trim();
}