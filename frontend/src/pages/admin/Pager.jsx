import { PAGE_SIZES } from './useServerList';
import s from './Admin.module.css';

// Page numbers with gaps: 1 … 4 5 6 … 20
function pageList(page, pages) {
  const want = [...new Set([1, pages, page - 1, page, page + 1])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = [];
  want.forEach((n, i) => {
    if (i && n - want[i - 1] > 1) out.push(`gap-${n}`);
    out.push(n);
  });
  return out;
}

/**
 * "26–50 / 245 · გვერდზე [10|20|50]   ← 1 2 3 … 10 →".
 * Hidden when even the smallest page size shows everything.
 */
export default function Pager({ page, pageSize, total, onPage, onPageSize }) {
  if (total <= PAGE_SIZES[0]) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const go = (n) => {
    onPage(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className={s.pager} aria-label="გვერდები">
      <div className={s.pagerLeft}>
        <span className={s.pagerInfo}>{from}–{to} / {total}</span>
        {onPageSize && (
          <div className={s.pageSizes} role="group" aria-label="რამდენი ჩანდეს გვერდზე">
            <span className={s.pagerInfo}>გვერდზე:</span>
            {PAGE_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                className={`${s.pageSizeBtn} ${n === pageSize ? s.pageSizeBtnOn : ''}`}
                onClick={() => n !== pageSize && onPageSize(n)}
                aria-pressed={n === pageSize}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>
      {pages > 1 && (
        <div className={s.pagerBtns}>
          <button type="button" className={s.iconBtn} disabled={page <= 1} onClick={() => go(page - 1)} aria-label="წინა გვერდი">←</button>
          {pageList(page, pages).map((n) => (typeof n === 'string'
            ? <span key={n} className={s.pagerGap}>…</span>
            : (
              <button
                key={n}
                type="button"
                className={`${s.pageBtn} ${n === page ? s.pageBtnOn : ''}`}
                onClick={() => go(n)}
                aria-current={n === page ? 'page' : undefined}
              >
                {n}
              </button>
            )))}
          <button type="button" className={s.iconBtn} disabled={page >= pages} onClick={() => go(page + 1)} aria-label="შემდეგი გვერდი">→</button>
        </div>
      )}
    </nav>
  );
}
