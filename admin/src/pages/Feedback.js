import { useState } from 'react';
import Badge from '../components/Badge';
import { feedback as seed } from '../data/mockData';

const statusColor = {
  open: 'yellow',
  in_review: 'blue',
  resolved: 'green',
  dismissed: 'gray'
};

export default function Feedback() {
  const [items, setItems] = useState(seed);
  const [selectedId, setSelectedId] = useState(seed[0]?.id ?? null);
  const [reply, setReply] = useState('');

  const selected = items.find((i) => i.id === selectedId);

  const sendReply = () => {
    if (!reply.trim() || !selected) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === selectedId
          ? {
              ...i,
              reply,
              status: 'resolved',
              date: new Date().toISOString().slice(0, 16).replace('T', ' ')
            }
          : i
      )
    );
    setReply('');
  };

  const setStatus = (status) => {
    setItems((prev) =>
      prev.map((i) => (i.id === selectedId ? { ...i, status } : i))
    );
  };

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