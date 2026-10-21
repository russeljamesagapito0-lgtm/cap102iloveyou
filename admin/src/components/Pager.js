export default function Pager({ pager }) {
  const { page, pageCount, total, pageSize, setPage } = pager;
  if (total <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pager">
      <span className="pager-info">
        {from} to {to} of {total}
      </span>
      <div className="pager-controls">
        <button
          className="filter-btn"
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
        >
          Prev
        </button>
        <span className="pager-page">
          Page {page} of {pageCount}
        </span>
        <button
          className="filter-btn"
          onClick={() => setPage(page + 1)}
          disabled={page >= pageCount}
        >
          Next
        </button>
      </div>
    </div>
  );
}
