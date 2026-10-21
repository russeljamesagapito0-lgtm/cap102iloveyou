import { useState, useEffect, useMemo } from 'react';

// Client side paging for lists that are already loaded.
// Pass a resetKey (search text, filter, selected user) to jump back to page 1
// when it changes. The page is clamped so a shrinking list never shows an empty page.
export default function usePagination(items, pageSize = 10, resetKey = '') {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const current = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize]
  );

  return {
    page: current,
    setPage,
    pageCount,
    pageItems,
    total: items.length,
    pageSize,
  };
}
