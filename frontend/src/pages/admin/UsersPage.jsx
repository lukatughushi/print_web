import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../context/auth-context';
import { gel, getErrorMessage, shortDate } from './adminShared';
import Pager from './Pager';
import useServerList, { useDebounced, usePageSize } from './useServerList';
import s from './Admin.module.css';

export default function UsersPage() {
  const { user: me } = useAuth();
  const [query, setQuery] = useState('');
  const search = useDebounced(query.trim());
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('users');
  const [actionError, setActionError] = useState('');

  const { data, setData, error: loadError, loading } = useServerList(
    '/api/admin/users',
    { q: search, role, page, pageSize },
    'მომხმარებლები ვერ ჩაიტვირთა',
  );
  const error = actionError || loadError;
  const users = data?.items ?? null;
  const shown = users ?? [];

  const setUserStatus = async (u, disabled) => {
    const msg = disabled
      ? `${u.name}-ს ანგარიში გაითიშოს? ვეღარ შევა და მიმდინარე სესიაც დაიხურება.`
      : `${u.name}-ს ანგარიში ისევ ჩაირთოს?`;
    if (!window.confirm(msg)) return;
    try {
      const { data: updated } = await api.patch(`/api/admin/users/${u.id}/status`, { disabled });
      setData((d) => d && ({ ...d, items: d.items.map((x) => (x.id === u.id ? { ...x, disabled: updated.disabled } : x)) }));
    } catch (e) {
      setActionError(getErrorMessage(e, 'სტატუსი ვერ შეიცვალა'));
    }
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>მომხმარებლები</h1>
          <p className={s.sub}>{data ? `${data.total} ${role || search ? 'ნაპოვნი' : 'რეგისტრირებული'}` : ' '}</p>
        </div>
      </div>

      <div className={s.toolbar}>
        <input className={s.search} type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="ძებნა: სახელი ან ელფოსტა…" />
        <select className={s.select} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">ყველა როლი</option>
          <option value="user">მომხმარებელი</option>
          <option value="admin">ადმინი</option>
        </select>
      </div>

      {error && <div className={s.error}>{error}</div>}
      {!users && !error && <div className={s.loading}>იტვირთება…</div>}
      {users && shown.length === 0 && <div className={s.empty}>მომხმარებლები ვერ მოიძებნა.</div>}

      {shown.length > 0 && (
        <div className={`${s.tableWrap} ${loading ? s.tableBusy : ''}`}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>სახელი</th>
                <th>როლი</th>
                <th className={s.right}>შეკვეთები</th>
                <th className={s.right}>დახარჯა</th>
                <th>ბოლო შეკვეთა</th>
                <th>რეგისტრაცია</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={s.strong}>{u.name}</div>
                    <div className={s.muted} style={{ fontSize: 12 }}>{u.email}</div>
                  </td>
                  <td>
                    <span className={`${s.badge} ${u.role === 'admin' ? s['tone-pink'] : s['tone-grey']}`}>
                      {u.role === 'admin' ? 'ადმინი' : 'მომხმარებელი'}
                    </span>
                    {u.disabled && <span className={`${s.badge} ${s['tone-red']}`} style={{ marginLeft: 6 }}>გათიშული</span>}
                    {u.emailVerified === false && <span className={`${s.badge} ${s['tone-grey']}`} style={{ marginLeft: 6 }}>მეილი დაუდასტურებელი</span>}
                  </td>
                  <td className={`${s.num} ${s.right}`}>
                    {u.orders ? <Link className={s.link} to={`/admin/orders?q=${encodeURIComponent(u.email)}`}>{u.orders}</Link> : 0}
                  </td>
                  <td className={`${s.num} ${s.right}`}>{gel(u.spent)}</td>
                  <td className={s.nowrap}>{shortDate(u.lastOrderAt)}</td>
                  <td className={s.nowrap}>{shortDate(u.createdAt)}</td>
                  <td className={s.nowrap} style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {u.id !== me?.id && (
                      u.disabled
                        ? <button type="button" className={`${s.btnGhost} ${s.btnSm}`} onClick={() => setUserStatus(u, false)}>ჩართვა</button>
                        : <button type="button" className={`${s.btnDanger} ${s.btnSm}`} onClick={() => setUserStatus(u, true)}>გათიშვა</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}
    </div>
  );
}
