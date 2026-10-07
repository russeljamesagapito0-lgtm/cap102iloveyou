const escapeCell = (value) => {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const buildCsv = (rows) => {
  const cols = Object.keys(rows[0]);
  const header = cols.join(',');
  const body = rows.map((r) => cols.map((c) => escapeCell(r[c])).join(','));
  return [header, ...body].join('\n');
};

const triggerDownload = (filename, content) => {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export function downloadCsv(name, rows) {
  if (!rows.length) return alert('Nothing to export.');
  triggerDownload(name, buildCsv(rows));
}