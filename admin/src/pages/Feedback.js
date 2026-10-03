import { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import { supabase, fmtDate } from '../lib/supabase';

const statusColor = {
  open: 'yellow',
  in_review: 'blue',
  resolved: 'green',
  dismissed: 'gray'
};

export default function Feedback() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    supabase
      .from('feedback')
      .select('*, profiles(full_name,email)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = (data || []).map((f) => ({
          id: f.id,
          user: f.profiles?.full_name || f.profiles?.email || 'Unknown',
          subject: f.subject,
          message: f.message,
          status: f.status,
          reply: f.reply,
          date: fmtDate(f.created_at)
        }));
        setItems(list);
        setSelectedId(list[0]?.id ?? null);
      });
  }, []);
  const [reply, setReply] = useState('');

  const selected = items.find((i) => i.id === selectedId);

  const patchItem = async (patch) => {
    const { error } = await supabase.from('feedback').update(patch).eq('id', selectedId);
    if (error) return alert(error.message);
    setItems((prev) => prev.map((i) => (i.id === selectedId ? { ...i, ...patch } : i)));
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    await patchItem({ reply, status: 'resolved', replied_at: new Date().toISOString() });
    setReply('');
  };

  const setStatus = (status) => patchItem({ status });

  const openCount = items.filter((i) => i.status === 'open').length;

  return (
    <div className="stack-lg">
      <div className="page-header">
        <h1 className="page-title">Feedback</h1>
        <p className="page-subtitle">{openCount} open messages</p>
      </div>

      <div className="inbox-layout">
        <div className="inbox-list">
          {items.map((i) => (
            <button
              key={i.id}
              className={'inbox-item' + (selectedId === i.id ? ' active' : '')}
              onClick={() => {
                setSelectedId(i.id);
                setReply('');
              }}
            >
              <div className="row1">
                <span className="subject">{i.subject}</span>
                <Badge color={statusColor[i.status]}>
                  {i.status.replace('_', ' ')}
                </Badge>
              </div>
              <p className="user">{i.user}</p>
              <p className="date">{i.date}</p>
            </button>
          ))}
        </div>

        <div className="inbox-detail">
          {selected ? (
            <>
              <div className="inbox-detail-header">
                <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h2 className="card-title" style={{ marginBottom: 4 }}>
                      {selected.subject}
                    </h2>
                    <p className="text-muted" style={{ fontSize: 12 }}>
                      From <strong>{selected.user}</strong> · {selected.date}
                    </p>
                  </div>
                  <Badge color={statusColor[selected.status]}>
                    {selected.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div className="inbox-detail-body">
                <div className="message-bubble">{selected.message}</div>
                {selected.reply && (
                  <div className="reply-bubble">
                    <div className="reply-bubble-label">Admin reply</div>
                    {selected.reply}
                  </div>
                )}
              </div>

              <div className="inbox-detail-footer">
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Write a reply..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />

                <div className="inbox-footer-actions">
                  <div className="inbox-footer-actions-left">
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setStatus('in_review')}
                    >
                      Mark in review
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setStatus('dismissed')}
                    >
                      Dismiss
                    </button>
                  </div>
                  <button className="btn btn-primary" onClick={sendReply}>
                    Send reply
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="inbox-empty">Select a message</div>
          )}
        </div>
      </div>
    </div>
  );
}