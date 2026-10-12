import { supabase, logAudit } from './supabase';

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

// Returns { counts, filename } and triggers a JSON download.
export async function runBackup(onProgress = () => {}) {
  const tables = {};
  const counts = {};
  for (const t of BACKUP_TABLES) {
    onProgress(t);
    tables[t] = await fetchAll(t);
    counts[t] = tables[t].length;
  }

  const payload = { created_at: new Date().toISOString(), counts, tables };
  const filename = `rootcare-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  await logAudit('backup.download', 'backup', null, { counts });
  return { counts, filename };
}
