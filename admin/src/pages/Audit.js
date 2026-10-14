import { useEffect, useState, useMemo } from 'react';
import Badge from '../components/Badge';
import Pager from '../components/Pager';
import usePagination from '../lib/usePagination';
import { downloadCsv } from '../lib/csv';
import { supabase, fmtDate } from '../lib/supabase';

const ACTION_COLORS = {
  create: 'green',
  update: 'blue',
  reactivate: 'green',
  delete: 'red',
  suspend: 'red',
  'backup.user': 'blue',
  'backup.all': 'blue',
  'maintenance.on': 'red',
  'maintenance.off': 'green',
  'maintenance.update': 'blue',
  'model.switch': 'yellow',
  'report.export': 'blue',
  'export.users': 'blue',
  'backup.download': 'blue',
  login: 'green',
  logout: 'yellow',
};

const SESSION_ACTIONS = ['login', 'logout'];

export const adminName = (p) => p?.full_name || p?.email || '-';

export const formatDetails = (action, details) => {
  if (!details || typeof details !== 'object') return '-';

  switch (action) {
    case 'login':
      return details.email ? `User: ${details.email}` : '-';

    case 'logout': {
      const email = details.email || '-';
      const reason = details.reason === 'session_expired' ? ' (session expired)' : '';
      return `User: ${email}${reason}`;
    }

    case 'suspend':
    case 'reactivate':
      return details.email ? `User: ${details.email}` : '-';

    case 'update': {
      const from = details.from || 'unknown';
      const to = details.to || 'unknown';
      return `Label changed: ${from} → ${to}`;
    }

    case 'maintenance.on':
    case 'maintenance.off':
    case 'maintenance.update':
      return details.message ? `Message: ${details.message}` : '-';

    case 'report.export': {
      const size = details.rows != null ? `${details.rows} rows` : `${details.scans ?? 0} scans`;
      const range = details.from || details.to ? ` · ${details.from || 'start'} to ${details.to || 'today'}` : '';
      return `${details.report || 'report'} · ${size}${range}`;
    }

    case 'model.switch':
      return `${details.from || '?'} → ${details.to || '?'}`;

    case 'backup.user':
      return `User: ${details.email || '-'} · ${details.scans ?? 0} scans`;

    case 'backup.all':
      return `${details.profiles ?? 0} users · ${details.scans ?? 0} scans`;

    case 'export.users':
      return `Exported ${details.count ?? 0} users (${details.view || 'all'} view)`;

    case 'backup.download': {
      const counts = details.counts || {};
      const tables = Object.keys(counts).length;
      const rows = Object.values(counts).reduce((a, n) => a + (Number(n) || 0), 0);
      return `Full system backup · ${rows} rows from ${tables} tables`;
    }

    default: {
      const parts = Object.entries(details)
        .filter(([k, v]) => v !== null && v !== undefined && v !== '' && k !== 'at')
        .map(([k, v]) => {
          const label = k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
          const value = typeof v === 'object' ? `${Object.keys(v).length} items` : String(v);
          return `${label}: ${value}`;
        });
      return parts.length ? parts.join(' · ') : '-';
    }
  }
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'actions', label: 'Actions' },
  { key: 'sessions', label: 'Sessions' },
];

export default function Audit() {
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('*, profiles(full_name,email)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setRows(data || []));
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'sessions') {
      return rows.filter((r) => SESSION_ACTIONS.includes(r.action));
    }
    if (tab === 'actions') {
      return rows.filter((r) => !SESSION_ACTIONS.includes(r.action));
    }
    return rows;
  }, [rows, tab]);

  const pager = usePagination(filtered, 15, tab);

  const exportCsv = () => {
    downloadCsv(
      `rootcare-audit-${tab}_${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        when: r.created_at,
        admin: adminName(r.profiles),
        action: r.action,
        details: formatDetails(r.action, r.details),
      }))
    );
  };

  return (
    <div className="stack-lg">
      <div className="flex-between">
        <p className="page-subtitle">
          Last {filtered.length} of {rows.length} entries
        </p>

        <div className="filter-bar">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={'filter-btn' + (tab === t.key ? ' active' : '')}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
          <button className="btn btn-outline btn-sm" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.map((r) => (
              <tr key={r.id}>
                <td className="cell-muted">{fmtDate(r.created_at)}</td>
                <td className="cell-strong">{adminName(r.profiles)}</td>
                <td>
                  <Badge color={ACTION_COLORS[r.action] || 'gray'}>{r.action}</Badge>
                </td>
                <td className="cell-muted">{formatDetails(r.action, r.details)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center text-muted">
                  No entries match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager pager={pager} />
    </div>
  );
}