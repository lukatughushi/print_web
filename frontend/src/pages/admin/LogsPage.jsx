import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { STATUS_BY_KEY, getErrorMessage, shortDate } from './adminShared';
import Pager from './Pager';
import { usePageSize } from './useServerList';
import s from './Admin.module.css';

const GROUPS = [
  ['', 'ყველა'],
  ['auth', 'შესვლები'],
  ['order', 'შეკვეთები'],
  ['quote', 'კორპორატიული'],
  ['product', 'პროდუქტები'],
  ['settings', 'პარამეტრები'],
  ['user', 'როლები'],
  ['file', 'ფაილები'],
  ['account', 'ანგარიშები'],
  ['design', 'დიზაინები'],
];

const ACTION_LABELS = {
  'auth.login': 'შესვლა',
  'auth.register': 'რეგისტრაცია',
  'order.create': 'ახალი შეკვეთა',
  'order.update': 'შეკვეთის შეცვლა',
  'quote.create': 'კორპორატიული მოთხოვნა',
  'quote.update': 'მოთხოვნის შეცვლა',
  'product.create': 'პროდუქტის დამატება',
  'product.update': 'პროდუქტის რედაქტირება',
  'product.delete': 'პროდუქტის წაშლა',
  'settings.update': 'პარამეტრების შეცვლა',
  'user.role': 'როლის შეცვლა',
  'file.upload': 'ფაილის ატვირთვა',
  'file.delete': 'ფაილის წაშლა',
  'account.profile': 'პროფილის შეცვლა',
  'account.password': 'პაროლის შეცვლა',
  'account.favorites': 'რჩეულების სინქრონი',
  'media.upload': 'სურათი ბიბლიოთეკაში',
  'media.delete': 'სურათის წაშლა ბიბლიოთეკიდან',
  'design.create': 'დიზაინის შენახვა',
  'design.update': 'დიზაინის განახლება',
  'design.rename': 'დიზაინის გადარქმევა',
  'design.delete': 'დიზაინის წაშლა',
  other: 'სხვა',
};

const FIELD_LABELS = {
  name: 'სახელი', price: 'ფასი', oldPrice: 'ძველი ფასი', isActive: 'ხილვადობა', colors: 'ფერები',
  sizes: 'ზომები', category: 'კატეგორია', description: 'აღწერა', material: 'მასალა', gender: 'ვისთვის',
  newArrival: '„ახალი“', image: 'ფოტო', title: 'სათაური', subtitle: 'ქვესათაური', ctaText: 'ღილაკი',
  ctaLink: 'ბმული', phone: 'ტელეფონი', city: 'ქალაქი', address: 'მისამართი', tab: 'პროდუქტის ტიპი', productId: 'პროდუქტი', color: 'ფერი', ids: 'სია', currentPassword: 'პაროლი', newPassword: 'ახალი პაროლი', adminNote: 'შენიშვნა', status: 'სტატუსი', role: 'როლი',
  announcementText: 'ანონსი', announcementActive: 'ანონსის ჩვენება', heroTitle: 'ბანერის სათაური',
  heroSubtitle: 'ბანერის ტექსტი', shippingFee: 'მიწოდების ფასი', freeShipThreshold: 'უფასო მიწოდება',
  contactPhone: 'ტელეფონი', contactEmail: 'ელფოსტა', contactAddress: 'მისამართი',
};

const QUOTE_LABELS = { NEW: 'ახალი', CONTACTED: 'დაკავშირებული', WON: 'შეთანხმებული', LOST: 'უარი' };

/** One readable line describing what the entry did. */
function describe(log) {
  const d = log.details || {};
  switch (log.action) {
    case 'auth.login':
      return log.ok ? 'წარმატებით შევიდა' : 'არასწორი ელფოსტა ან პაროლი';
    case 'auth.register':
      return d.name ? `ახალი ანგარიში: ${d.name}` : 'ახალი ანგარიში';
    case 'order.create':
      return [d.customerName, d.phone, Array.isArray(d.items) && `${d.items.length} პროდუქტი`].filter(Boolean).join(' · ');
    case 'order.update':
      if (d.status) return `სტატუსი → ${STATUS_BY_KEY[d.status]?.label ?? d.status}`;
      return d.adminNote !== undefined ? 'შიდა შენიშვნა შეიცვალა' : '';
    case 'quote.create':
      return [d.name, d.company, d.quantity && `${d.quantity} ცალი`].filter(Boolean).join(' · ');
    case 'quote.update':
      if (d.status) return `სტატუსი → ${QUOTE_LABELS[d.status] ?? d.status}`;
      return d.adminNote !== undefined ? 'შიდა შენიშვნა შეიცვალა' : '';
    case 'user.role':
      return d.role === 'admin' ? 'დაინიშნა ადმინად' : 'მოეხსნა ადმინობა';
    case 'product.update':
      if (Object.keys(d).length === 1 && 'isActive' in d) return d.isActive ? 'გამოჩნდა მაღაზიაში' : 'დაიმალა მაღაზიიდან';
      return Object.keys(d).map((k) => FIELD_LABELS[k] ?? k).join(', ');
    case 'product.create':
      return d.name || '';
    default:
      return Object.keys(d).map((k) => FIELD_LABELS[k] ?? k).join(', ');
  }
}

function targetLink(log) {
  if (!log.targetId || !log.ok) return null;
  if (log.action.startsWith('order.')) return `/admin/orders?open=${log.targetId}`;
  if (log.action.startsWith('quote.')) return `/admin/quotes?open=${log.targetId}`;
  return null;
}

export default function LogsPage() {
  const [group, setGroup] = useState('');
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('logs');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (group) params.set('action', group);
    if (failed) params.set('failed', '1');
    if (search) params.set('q', search);
    api.get(`/api/admin/logs?${params}`)
      .then((r) => { setData(r.data); setError(''); })
      .catch((e) => setError(getErrorMessage(e, 'ჟურნალი ვერ ჩაიტვირთა')));
  }, [group, failed, search, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const pick = (setter) => (value) => { setter(value); setPage(1); };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>ჟურნალი</h1>
          <p className={s.sub}>ვინ როდის შევიდა და რა შეცვალა — ბოლო 180 დღე</p>
        </div>
        <button type="button" className={s.btnGhost} onClick={load}>↻ განახლება</button>
      </div>

      <div className={s.tabs}>
        {GROUPS.map(([key, label]) => (
          <button key={key || 'all'} type="button" className={`${s.tab} ${group === key ? s.tabOn : ''}`} onClick={() => pick(setGroup)(key)}>
            {label}
          </button>
        ))}
      </div>

      <form className={s.toolbar} onSubmit={(e) => { e.preventDefault(); setSearch(query.trim()); setPage(1); }}>
        <input className={s.search} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ძებნა: ელფოსტა ან IP მისამართი… (Enter)" />
        <button
          type="button"
          className={s.switchLabel}
          style={{ border: 0, background: 'none', padding: 0, font: 'inherit' }}
          onClick={() => pick(setFailed)(!failed)}
          aria-pressed={failed}
        >
          <span className={`${s.switch} ${failed ? s.switchOn : ''}`} /> მხოლოდ შეცდომები
        </button>
      </form>

      {error && <div className={s.error}>{error}</div>}
      {!data && !error && <div className={s.loading}>იტვირთება…</div>}
      {data && data.items.length === 0 && <div className={s.empty}>ჩანაწერები ვერ მოიძებნა.</div>}

      {data?.items.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>დრო</th>
                <th>ვინ</th>
                <th>მოქმედება</th>
                <th>დეტალები</th>
                <th>IP</th>
                <th>შედეგი</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => {
                const link = targetLink(log);
                return (
                  <tr key={log.id}>
                    <td className={s.nowrap}>{shortDate(log.createdAt, true)}</td>
                    <td>
                      <div>{log.actorEmail || <span className={s.muted}>სტუმარი</span>}</div>
                      {log.actorRole === 'admin' && <div className={s.muted} style={{ fontSize: 11.5 }}>ადმინი</div>}
                    </td>
                    <td className={s.nowrap}>{ACTION_LABELS[log.action] ?? log.action}</td>
                    <td style={{ maxWidth: 360 }}>
                      {describe(log) || <span className={s.muted}>—</span>}
                      {link && <> · <Link className={s.link} to={link}>გახსნა</Link></>}
                    </td>
                    <td className={`${s.nowrap} ${s.muted}`} style={{ fontSize: 12.5 }}>{log.ip || '—'}</td>
                    <td>
                      {log.ok
                        ? <span className={`${s.badge} ${s['tone-green']}`}>✓ წარმატება</span>
                        : <span className={`${s.badge} ${s['tone-pink']}`} title={log.error}>შეცდომა {log.status}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}
    </div>
  );
}
