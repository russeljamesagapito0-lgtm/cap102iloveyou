import { supabase, logAudit } from './supabase';
import { buildZip } from './zip';

export const BACKUP_TABLES = [
  'profiles',
  'diseases',
  'disease_translations',
  'scans',
  'feedback',
  'audit_log',
  'app_settings',
];

const PAGE = 1000; // Supabase returns max 1000 rows per request

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

// jsonb / array columns come back as objects, so keep them as JSON text instead of "[object Object]"
const cell = (value) => {
  if (value == null) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function rowsToCsv(rows) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const body = rows.map((r) => cols.map((c) => cell(r[c])).join(','));
  return [cols.join(','), ...body].join('\r\n');
}

// Returns { counts, filename } and triggers a ZIP download with one CSV per table.
export async function runBackup(onProgress = () => {}) {
  const files = [];
  const counts = {};
  for (const t of BACKUP_TABLES) {
    onProgress(t);
    const rows = await fetchAll(t);
    counts[t] = rows.length;
    files.push({ name: `${t}.csv`, content: '\ufeff' + rowsToCsv(rows) });
  }

  const filename = `rootcare-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  const url = URL.createObjectURL(buildZip(files));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  await logAudit('backup.download', 'backup', null, { counts });
  return { counts, filename };
}