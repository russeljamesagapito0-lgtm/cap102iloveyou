import { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { BACKUP_TABLES, runBackup } from '../lib/backup';

export default function Backup() {
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState('');
  const [result, setResult] = useState(null);

  const start = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await runBackup(setCurrent);
      setResult(res);
      toast.success('Backup downloaded');
    } catch (e) {
      toast.error(`Backup failed: ${e.message}`);
    } finally {
      setRunning(false);
      setCurrent('');
    }
  };

  return (
    <div className="card">
      <div className="flex-between">
        <div>
          <div className="card-title" style={{ marginBottom: 4 }}>
            Manual backup
          </div>
          <p className="page-subtitle">
            Downloads {BACKUP_TABLES.join(', ')} as CSV files (one per table) in a single ZIP. Not encrypted, store it safely.
          </p>
        </div>
        <button className="btn btn-primary" onClick={start} disabled={running}>
          {running ? `Reading ${current}…` : 'Backup now'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 16, fontSize: 13 }}>
          <div className="text-muted" style={{ marginBottom: 6 }}>{result.filename}</div>
          {Object.entries(result.counts).map(([t, n]) => (
            <div key={t} className="flex-between">
              <span>{t}</span>
              <span>{n} rows</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}