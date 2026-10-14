import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Pager from '../components/Pager';
import usePagination from '../lib/usePagination';
import useAutoRefresh from '../lib/useAutoRefresh';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { downloadCsv } from '../lib/csv';
import { supabase, fmtDate, logAudit, fetchPages } from '../lib/supabase';

const PER_PAGE = 10;
const TABLE_MAX = 5000;

const STATUSES = [
  { value: 'open', label: 'Open', color: 'yellow' },
  { value: 'in_review', label: 'In review', color: 'blue' },
  { value: 'resolved', label: 'Resolved', color: 'green' },
  { value: 'dismissed', label: 'Dismissed', color: 'gray' },
];
const STATUS_BY_VALUE = Object.fromEntries(STATUSES.map((s) => [s.value, s]));
const FILTERS = ['all', ...STATUSES.map((s) => s.value)];

const buildItem = (f) => ({
  id: f.id,
  userId: f.user_id,
  name: f.profiles?.full_name || f.profiles?.email || 'Deleted user',
  email: f.profiles?.email || '',
  subject: f.subject || '(no subject)',
  message: f.message || '',
  status: f.status,
  createdAt: f.created_at,
  date: fmtDate(f.created_at),
});

const fetchAll = () =>
  fetchPages(
    () =>
      supabase
        .from('feedback')
        .select('id, user_id, subject, message, status, created_at, profiles(full_name,email)')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
    { max: TABLE_MAX }
  );

function StatusBadge({ status }) {
  const s = STATUS_BY_VALUE[status];
  return <Badge color={s?.color || 'gray'}>{s?.label || status}</Badge>;
}

export default function Feedback() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get('status');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(FILTERS.includes(initial) ? initial : 'all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState('open');
  const confirm = useConfirm();
  const toast = useToast();

  // Silent refetch used by the auto-refresh below
  const refresh = useCallback(async () => {
    try {
      const data = await fetchAll();
      setItems(data.map(buildItem));
    } catch (e) {
      // keep the last good list
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchAll();
        setItems(data.map(buildItem));
      } catch (e) {
        toast.error('Failed to load feedback: ' + (e.message || 'unknown error'));
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(refresh, { intervalMs: 10000, table: 'feedback' });

  const counts = useMemo(() => {
    const c = { all: items.length };
    for (const s of STATUSES) c[s.value] = 0;
    for (const f of items) if (c[f.status] != null) c[f.status] += 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((f) => {
      if (filter !== 'all' && f.status !== filter) return false;
      if (!q) return true;
      return (
        f.subject.toLowerCase().includes(q) ||
        f.message.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q)
      );
    });
  }, [items, filter, query]);

  const pager = usePagination(filtered, PER_PAGE, `${filter}|${query}`);

  const changeFilter = (f) => {
    setFilter(f);
    setSearchParams(f === 'all' ? {} : { status: f });
  };

  const openItem = (f) => {
    setSelected(f);
    setNewStatus(f.status);
  };

  const saveStatus = async () => {
    if (!selected || newStatus === selected.status) return;

    const ok = await confirm({
      title: 'Update status?',
      message: `Change status from "${STATUS_BY_VALUE[selected.status]?.label}" to "${STATUS_BY_VALUE[newStatus]?.label}"? This will be logged in the audit trail.`,
      confirmText: 'Update',
      tone: 'primary',
    });
    if (!ok) return;

    const { error } = await supabase
      .from('feedback')
      .update({ status: newStatus })
      .eq('id', selected.id);

    if (error) {
      toast.error('Failed to update status: ' + error.message);
      return;
    }

    logAudit('update', 'feedback', selected.id, {
      from: selected.status,
      to: newStatus,
    });

    setItems((prev) =>
      prev.map((f) => (f.id === selected.id ? { ...f, status: newStatus } : f))
    );
    toast.success('Status updated', { description: STATUS_BY_VALUE[newStatus]?.label });
    setSelected(null);
  };

  const exportCsv = () => {
    if (!filtered.length) {
      toast.info('Nothing to export');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const suffix = filter === 'all' ? '' : `_${filter}`;
    downloadCsv(
      `feedback${suffix}_${date}.csv`,
      filtered.map((f) => ({
        id: f.id,
        created_at: f.createdAt,
        user_name: f.name,
        user_email: f.email,
        subject: f.subject,
        message: f.message,
        status: f.status,
      }))
    );
    toast.success('Export downloaded', { description: `${filtered.length} rows` });
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Feedback" />
        <p className="page-subtitle">Loading feedback…</p>
      </>
    );
  }

  const emptyText = items.length === 0
    ? 'No feedback submitted yet.'
    : 'No feedback matches this filter.';

  return (
    <>
      <PageHeader
        title="Feedback"
        subtitle={`${counts.all} total · ${counts.open} open`}
      />

      <div className="stack-lg">
        <div className="flex-between">
          <div className="filter-bar">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={'filter-btn' + (filter === f ? ' active' : '')}
                onClick={() => changeFilter(f)}
              >
                {f === 'all' ? 'All' : STATUS_BY_VALUE[f].label} ({counts[f]})
              </button>
            ))}
          </div>

          <div className="flex-center" style={{ gap: 10 }}>
            <input
              className="input"
              style={{ width: 280 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subject, message, or user..."
            />
            <button className="btn btn-outline btn-sm" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>From</th>
                <th>Date</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pager.pageItems.map((f) => (
                <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => openItem(f)}>
                  <td className="cell-strong">{f.subject}</td>
                  <td className="cell-muted">{f.name}</td>
                  <td className="cell-muted">{f.date}</td>
                  <td><StatusBadge status={f.status} /></td>
                  <td className="text-right">
                    <button
                      className="link-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openItem(f);
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center text-muted">
                    {emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager pager={pager} />
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Feedback"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setSelected(null)}>
              Close
            </button>
            <button
              className="btn btn-primary"
              onClick={saveStatus}
              disabled={!selected || newStatus === selected.status}
            >
              Save status
            </button>
          </>
        }
      >
        {selected && (
          <div className="stack-md">
            <div>
              <div className="info-row">
                <span className="info-row-label">From</span>
                <span className="info-row-value">{selected.name}</span>
              </div>
              {selected.email && (
                <div className="info-row">
                  <span className="info-row-label">Email</span>
                  <span className="info-row-value">{selected.email}</span>
                </div>
              )}
              <div className="info-row">
                <span className="info-row-label">Sent</span>
                <span className="info-row-value">{selected.date}</span>
              </div>
              <div className="info-row">
                <span className="info-row-label">Subject</span>
                <span className="info-row-value">{selected.subject}</span>
              </div>
            </div>

            <div>
              <label className="label">Message</label>
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.6,
                  maxHeight: 260,
                  overflowY: 'auto',
                }}
              >
                {selected.message}
              </div>
            </div>

            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
