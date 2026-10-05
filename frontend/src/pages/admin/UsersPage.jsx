import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../context/auth-context';
import { gel, getErrorMessage, shortDate } from './adminShared';
import s from './Admin.module.css';

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/admin/users')
      .then((r) => setUsers(r.data))
      .catch((e) => setError(getErrorMessage(e, 'მომხმარებლები ვერ ჩაიტვირთა')));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users || []).filter((u) =>
      (!role || u.role === role) &&
      (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)));
  }, [users, query, role]);

  const setUserRole = async (u, next) => {
    const msg = next === 'admin'
      ? `${u.name}-ს მიეცეს ადმინ პანელზე სრული წვდომა?`
      : `${u.name}-ს მოეხსნას ადმინის უფლებები?`;
    if (!window.confirm(msg)) return;
    try {
      const { data } = await api.patch(`/api/admin/users/${u.id}/role`, { role: next });
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, role: data.role } : x)));
    } catch (e) {
      setError(getErrorMessage(e, 'როლი ვერ შეიცვალა'));
    }
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>მომხმარებლები</h1>
          <p className={s.sub}>{users ? `${users.length} რეგისტრირებული` : ' '}</p>
        </div>
      </div>

      <div className={s.toolbar}>
        <input className={s.search} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ძებნა: სახელი ან ელფოსტა…" />
        <select className={s.select} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">ყველა როლი</option>
          <option value="user">მომხმარებელი</option>
          <option value="admin">ადმინი</option>
        </select>
      </div>

      {error && <div className={s.error}>{error}</div>}
      {!users && !error && <div className={s.loading}>იტვირთება…</div>}
      {users && shown.length === 0 && <div className={s.empty}>მომხმარებლები ვერ მოიძებნა.</div>}

      {shown.length > 0 && (
        <div className={s.tableWrap}>
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
                  </td>
                  <td className={`${s.num} ${s.right}`}>
                    {u.orders ? <Link className={s.link} to={`/admin/orders?q=${encodeURIComponent(u.email)}`}>{u.orders}</Link> : 0}
                  </td>
                  <td className={`${s.num} ${s.right}`}>{gel(u.spent)}</td>
                  <td className={s.nowrap}>{shortDate(u.lastOrderAt)}</td>
                  <td className={s.nowrap}>{shortDate(u.createdAt)}</td>
                  <td className={s.nowrap}>
                    {u.id !== me?.id && (
                      u.role === 'admin'
                        ? <button type="button" className={`${s.btnDanger} ${s.btnSm}`} onClick={() => setUserRole(u, 'user')}>ადმინობის მოხსნა</button>
                        : <button type="button" className={`${s.btnGhost} ${s.btnSm}`} onClick={() => setUserRole(u, 'admin')}>ადმინად დანიშვნა</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
