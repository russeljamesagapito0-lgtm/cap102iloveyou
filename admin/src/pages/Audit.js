import { useEffect, useState } from 'react';
import Badge from '../components/Badge';
import { supabase, fmtDate } from '../lib/supabase';

const color = { create: 'green', update: 'blue', reactivate: 'green', delete: 'red', suspend: 'red' };

export default function Audit() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('*, profiles(full_name,email)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setRows(data || []));
  }, []);

  return (
    <div className="stack-lg">
      <div className="page-header">
        <h1 className="page-title">Audit Log</h1>
        <p className="page-subtitle">Last {rows.length} admin actions</p>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th><th>Details</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="cell-muted">{fmtDate(r.created_at)}</td>
                <td className="cell-strong">{r.profiles?.full_name || r.profiles?.email || '-'}</td>
                <td><Badge color={color[r.action] || 'gray'}>{r.action}</Badge></td>
                <td>{r.entity}</td>
                <td className="cell-muted">{JSON.stringify(r.details).slice(0, 140)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="5" className="text-center text-muted">No activity yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
