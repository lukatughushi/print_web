import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/auth-context';
import { getErrorMessage } from './adminShared';
import { useDebounced } from './useServerList';
import s from './Admin.module.css';

const ROLES = [
  { key: 'admin', label: 'ადმინი', about: 'სრული წვდომა ადმინ პანელზე: შეკვეთები, პროდუქტები, კონსტრუქტორი, მომხმარებლები, პარამეტრები.', tone: 'tone-pink' },
  { key: 'user', label: 'მომხმარებელი', about: 'მაღაზია, კონსტრუქტორი, შეკვეთები და საკუთარი ანგარიში. ადმინ პანელს ვერ ხედავს.', tone: 'tone-grey' },
];
const LABEL = Object.fromEntries(ROLES.map((r) => [r.key, r.label]));

/** Who has which role, and assigning a role to any user. */
export default function RolesPage() {
  const { user: me } = useAuth();
  const [admins, setAdmins] = useState(null);
  const [userCount, setUserCount] = useState(null);
  const [query, setQuery] = useState('');
  const search = useDebounced(query.trim());
  const [found, setResults] = useState([]);
  // Results only count for a search of 2+ characters.
  const results = search.length >= 2 ? found : [];
  const [picked, setPicked] = useState({}); // user id → chosen role
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAdmins = () =>
    Promise.all([
      api.get('/api/admin/users', { params: { role: 'admin', pageSize: 100 } }),
      api.get('/api/admin/users', { params: { role: 'user', pageSize: 1 } }),
    ])
      .then(([a, u]) => { setAdmins(a.data.items || []); setUserCount(u.data.total ?? 0); })
      .catch((e) => setError(getErrorMessage(e, 'როლები ვერ ჩაიტვირთა')));

  useEffect(() => { loadAdmins(); }, []);

  useEffect(() => {
    if (search.length < 2) return undefined;
    let live = true;
    api.get('/api/admin/users', { params: { q: search, pageSize: 8 } })
      .then((r) => live && setResults(r.data.items || []))
      .catch(() => live && setResults([]));
    return () => { live = false; };
  }, [search]);

  const assign = async (u, role) => {
    if (role === u.role) return;
    if (role === 'admin' && !window.confirm(`${u.name}-ს მიეცეს ადმინ პანელზე სრული წვდომა?`)) return;
    setBusy(u.id);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch(`/api/admin/users/${u.id}/role`, { role });
      setResults((list) => list.map((x) => (x.id === u.id ? { ...x, role: data.role } : x)));
      setNotice(`${u.name} — ახლა ${LABEL[data.role]}`);
      await loadAdmins();
    } catch (e) {
      setError(getErrorMessage(e, 'როლი ვერ შეიცვალა'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>როლები</h1>
          <p className={s.sub}>ვის რა უფლება აქვს და როლის მინიჭება</p>
        </div>
      </div>

      {error && <div className={s.error}>{error}</div>}
      {notice && <div className={s.success}>{notice}</div>}

      <div className={`${s.card} ${s.section}`}>
        <h2 className={s.sectionTitle}>როლის მინიჭება</h2>
        <input
          className={s.search}
          style={{ flex: "none" }}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="მოძებნე მომხმარებელი: სახელი ან ელფოსტა…"
        />
        {search.length >= 2 && results.length === 0 && <span className={s.hint}>ვერაფერი მოიძებნა</span>}
        {results.length > 0 && (
          <div className={s.rows}>
            {results.map((u) => {
              const role = picked[u.id] ?? u.role;
              const self = u.id === me?.id;
              return (
                <div key={u.id} className={s.row} style={{ flexWrap: 'wrap' }}>
                  <div className={s.rowMain}>
                    <div className={s.rowName}>{u.name}</div>
                    <div className={s.rowSub}>{u.email}{u.disabled ? ' · გათიშული' : ''}</div>
                  </div>
                  <select
                    className={s.select}
                    value={role}
                    disabled={self || busy === u.id}
                    onChange={(e) => setPicked((p) => ({ ...p, [u.id]: e.target.value }))}
                    aria-label={`${u.name} — როლი`}
                  >
                    {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                  <button
                    type="button"
                    className={`${s.btnPrimary} ${s.btnSm}`}
                    disabled={self || busy === u.id || role === u.role}
                    onClick={() => assign(u, role)}
                    title={self ? 'საკუთარ როლს ვერ შეცვლი' : undefined}
                  >
                    {busy === u.id ? '…' : 'მინიჭება'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {ROLES.map((r) => (
        <div key={r.key} className={`${s.card} ${s.section}`}>
          <div className={s.head}>
            <h2 className={s.sectionTitle}>
              <span className={`${s.badge} ${s[r.tone]}`}>{r.label}</span>
            </h2>
            <span className={s.hint}>
              {r.key === 'admin' ? `${admins?.length ?? '…'} ადმინი` : `${userCount ?? '…'} მომხმარებელი`}
            </span>
          </div>
          <span className={s.hint}>{r.about}</span>
          {r.key === 'admin' && admins && (
            <div className={s.rows}>
              {admins.map((u) => (
                <div key={u.id} className={s.row}>
                  <div className={s.rowMain}>
                    <div className={s.rowName}>{u.name}{u.id === me?.id ? ' (შენ)' : ''}</div>
                    <div className={s.rowSub}>{u.email}{u.disabled ? ' · გათიშული' : ''}</div>
                  </div>
                  {u.id !== me?.id && (
                    <button
                      type="button"
                      className={`${s.btnDanger} ${s.btnSm}`}
                      disabled={busy === u.id}
                      onClick={() => window.confirm(`${u.name}-ს მოეხსნას ადმინის უფლებები?`) && assign(u, 'user')}
                    >
                      ადმინობის მოხსნა
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
