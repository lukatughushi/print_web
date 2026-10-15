import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { API_BASE } from '../../lib/catalog';
import { gel, getErrorMessage, shortDate } from './adminShared';
import Pager from './Pager';
import useServerList, { useDebounced, usePageSize } from './useServerList';
import s from './Admin.module.css';

const QUOTE_STATUSES = [
  { key: 'NEW', label: 'ახალი', tone: 'pink' },
  { key: 'CONTACTED', label: 'დაკავშირებული', tone: 'amber' },
  { key: 'WON', label: 'შეთანხმებული', tone: 'green' },
  { key: 'LOST', label: 'უარი', tone: 'grey' },
];
const STATUS = Object.fromEntries(QUOTE_STATUSES.map((st) => [st.key, st]));

const PRODUCTS = { tee: 'მაისური მოკლე', ls: 'მაისური გრძელმკლავიანი', polo: 'პოლო მაისური მოკლე', polo_ls: 'პოლო გრძელმკლავიანი', hoodie: 'ჰუდი', zip_hoodie: 'ჰუდი ელვა შესაკრავით', bomber: 'ბომბერი', cap: 'კეპი', bag: 'ჩანთა', vest: 'სამუშაო ჟილეტი' };
const ZONES = { front: 'წინა მხარე', back: 'ზურგი', sleeve: 'სახელო' };

const isEmail = (v) => /\S+@\S+\.\S+/.test(v);

function QuoteDrawer({ quote, onClose, onSaved }) {
  const [note, setNote] = useState(quote.adminNote || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (patch) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.patch(`/api/quotes/${quote.id}`, patch);
      onSaved(data);
    } catch (e) {
      setError(getErrorMessage(e, 'შენახვა ვერ მოხერხდა'));
    } finally {
      setBusy(false);
    }
  };

  const contactHref = isEmail(quote.contact) ? `mailto:${quote.contact}` : `tel:${quote.contact.replace(/\s/g, '')}`;

  return (
    <>
      <div className={s.backdrop} onClick={onClose} aria-hidden="true" />
      <aside className={s.drawer} role="dialog" aria-label={`მოთხოვნა ${quote.number}`}>
        <div className={s.drawerHead}>
          <div>
            <h2 className={s.drawerTitle}>{quote.number}</h2>
            <div className={s.muted} style={{ fontSize: 12.5 }}>{shortDate(quote.createdAt, true)}</div>
          </div>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="დახურვა">✕</button>
        </div>
        <div className={s.drawerBody}>
          {error && <div className={s.error}>{error}</div>}

          <div className={s.card}>
            <h3 className={s.cardTitle}>სტატუსი</h3>
            <div className={s.statusPick}>
              {QUOTE_STATUSES.map((st) => (
                <button
                  key={st.key}
                  type="button"
                  disabled={busy}
                  className={`${s.badge} ${s[`tone-${st.tone}`]} ${quote.status === st.key ? s.statusPickOn : ''}`}
                  onClick={() => quote.status !== st.key && save({ status: st.key })}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className={s.card}>
            <h3 className={s.cardTitle}>კლიენტი</h3>
            <dl className={s.kv}>
              <dt>სახელი</dt><dd>{quote.name}</dd>
              {quote.company && <><dt>კომპანია</dt><dd>{quote.company}</dd></>}
              <dt>კონტაქტი</dt><dd><a className={s.link} href={contactHref}>{quote.contact}</a></dd>
            </dl>
          </div>

          <div className={s.card}>
            <h3 className={s.cardTitle}>მოთხოვნა</h3>
            <dl className={s.kv}>
              {quote.product && <><dt>პროდუქტი</dt><dd>{PRODUCTS[quote.product] ?? quote.product}</dd></>}
              {quote.quantity && <><dt>რაოდენობა</dt><dd>{quote.quantity} ცალი</dd></>}
              {quote.zones?.length > 0 && <><dt>ზონები</dt><dd>{quote.zones.map((z) => ZONES[z] ?? z).join(', ')}</dd></>}
              {quote.estimate != null && <><dt>სავარაუდო</dt><dd className={s.strong}>{gel(quote.estimate)}</dd></>}
              <dt>ლოგო</dt>
              <dd>
                {quote.logoFile
                  ? <a className={s.link} href={`${API_BASE}/api/files/${quote.logoFile}`} target="_blank" rel="noreferrer">⬇ {quote.logoName || 'ფაილი'}</a>
                  : <span className={s.muted}>არ არის</span>}
              </dd>
            </dl>
            {quote.comment && (
              <p style={{ margin: '12px 0 0', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{quote.comment}</p>
            )}
          </div>

          <div className={s.card}>
            <h3 className={s.cardTitle}>შიდა შენიშვნა</h3>
            <textarea className={s.textarea} value={note} onChange={(e) => setNote(e.target.value)} placeholder="მაგ. „მაკეტი გაეგზავნა, ელოდება დადასტურებას“" />
          </div>
        </div>
        <div className={s.drawerFoot}>
          <button type="button" className={s.btnGhost} onClick={onClose}>დახურვა</button>
          <button type="button" className={s.btn} disabled={busy || note === (quote.adminNote || '')} onClick={() => save({ adminNote: note })}>
            შენიშვნის შენახვა
          </button>
        </div>
      </aside>
    </>
  );
}

export default function QuotesPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const openId = params.get('open') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [pageSize, setPageSize] = usePageSize('quotes');
  const [query, setQuery] = useState(params.get('q') || '');
  const search = useDebounced(query.trim());
  const [fetched, setFetched] = useState(null);

  const setParam = useCallback((changes) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k); });
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    if (search !== (params.get('q') || '')) setParam({ q: search, page: '' });
  }, [search, params, setParam]);

  const { data, error, loading, reload } = useServerList(
    '/api/quotes',
    { status, q: params.get('q') || '', page, pageSize },
    'მოთხოვნები ვერ ჩაიტვირთა',
  );

  const row = openId ? data?.items.find((q) => q.id === openId) : null;
  const open = !openId ? null : (fetched?.id === openId ? fetched : row) || null;

  useEffect(() => {
    if (!openId || !data || data.items.some((q) => q.id === openId)) return;
    api.get(`/api/quotes/${openId}`).then((r) => setFetched(r.data)).catch(() => {});
  }, [openId, data]);

  const counts = data?.counts || {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const saved = (u) => { setFetched(u); reload(); };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>კორპორატიული მოთხოვნები</h1>
          <p className={s.sub}>/corporate გვერდის ფორმიდან შემოსული შეთავაზების მოთხოვნები</p>
        </div>
        <button type="button" className={s.btnGhost} onClick={reload}>↻ განახლება</button>
      </div>

      <div className={s.tabs}>
        <button type="button" className={`${s.tab} ${!status ? s.tabOn : ''}`} onClick={() => setParam({ status: '', page: '' })}>
          ყველა <span className={s.tabCount}>{all}</span>
        </button>
        {QUOTE_STATUSES.map((st) => (
          <button key={st.key} type="button" className={`${s.tab} ${status === st.key ? s.tabOn : ''}`} onClick={() => setParam({ status: st.key, page: '' })}>
            {st.label} <span className={s.tabCount}>{counts[st.key] || 0}</span>
          </button>
        ))}
      </div>

      <div className={s.toolbar}>
        <input className={s.search} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ძებნა: ნომერი, სახელი, კომპანია, კონტაქტი…" />
      </div>

      {error && <div className={s.error}>{error}</div>}
      {!data && !error && <div className={s.loading}>იტვირთება…</div>}
      {data && data.items.length === 0 && <div className={s.empty}>მოთხოვნები ვერ მოიძებნა.</div>}

      {data?.items.length > 0 && (
        <div className={`${s.tableWrap} ${loading ? s.tableBusy : ''}`}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>ნომერი</th>
                <th>თარიღი</th>
                <th>კლიენტი</th>
                <th>მოთხოვნა</th>
                <th className={s.right}>სავარაუდო</th>
                <th>სტატუსი</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((q) => (
                <tr key={q.id} className={s.clickRow} onClick={() => setParam({ open: q.id })}>
                  <td className={`${s.strong} ${s.nowrap}`}>{q.number}</td>
                  <td className={s.nowrap}>{shortDate(q.createdAt, true)}</td>
                  <td>
                    <div>{q.name}{q.company ? ` · ${q.company}` : ''}</div>
                    <div className={s.muted} style={{ fontSize: 12 }}>{q.contact}</div>
                  </td>
                  <td>
                    {[PRODUCTS[q.product], q.quantity && `${q.quantity} ცალი`].filter(Boolean).join(' · ')}
                    {q.logoFile && <span className={s.muted} style={{ fontSize: 12 }}> · ლოგოთი</span>}
                  </td>
                  <td className={`${s.num} ${s.right}`}>{q.estimate != null ? gel(q.estimate) : '—'}</td>
                  <td><span className={`${s.badge} ${s[`tone-${STATUS[q.status]?.tone}`]}`}>{STATUS[q.status]?.label ?? q.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(n) => setParam({ page: n > 1 ? String(n) : '' })} onPageSize={(n) => { setPageSize(n); setParam({ page: '' }); }} />}

      {open && <QuoteDrawer key={open.id} quote={open} onClose={() => setParam({ open: '' })} onSaved={saved} />}
    </div>
  );
}
