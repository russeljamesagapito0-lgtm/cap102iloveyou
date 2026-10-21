// src/lib/formatRelativeTime.js
// Human-friendly "X ago" string. Falls back to a date after 24h.
export function formatRelativeTime(input) {
  if (!input) return '';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));

  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Renders on a fixed interval so a "2 min ago" label ticks on its own.
// Returns a Date that updates every `intervalMs` ms.
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}