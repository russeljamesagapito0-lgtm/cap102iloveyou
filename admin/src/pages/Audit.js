import { useEffect, useState, useMemo } from 'react';
import Badge from '../components/Badge';
import { supabase, fmtDate } from '../lib/supabase';

const ACTION_COLORS = {
  create: 'green',
  update: 'blue',
  reactivate: 'green',
  delete: 'red',
  suspend: 'red',
  'backup.user': 'blue',
  'backup.all': 'blue',
  login: 'green',
  logout: 'yellow',
};

const SESSION_ACTIONS = ['login', 'logout'];

const adminName = (p) => p?.full_name || p?.email || '-';

const formatDetails = (action, details) => {
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

    case 'backup.user':
      return `User: ${details.email || '-'} · ${details.scans ?? 0} scans`;

    case 'backup.all':
      return `${details.profiles ?? 0} users · ${details.scans ?? 0} scans`;

    default: {
      const text = JSON.stringify(details);
      return text.length > 140 ? text.slice(0, 140) + '…' : text;
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
            {filtered.map((r) => (
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
    </div>
  );
}