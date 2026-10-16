import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/auth-context';
import logo from '../assets/prenta/logo_prenta.webp';
import s from './AdminLayout.module.css';

const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  orders: 'M6 2h12l3 5v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7l3-5zM3 7h18M9 11a3 3 0 0 0 6 0',
  products: 'M8 3 4 5 2 9l3 2 1-1v11h12V10l1 1 3-2-2-4-4-2c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  quotes: 'M3 21V7l9-4 9 4v14M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01',
  constructor: 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586M11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  logs: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8M8 9h2',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};

const NAV = [
  { to: '/admin/dashboard', label: 'მიმოხილვა', icon: 'dashboard' },
  { to: '/admin/orders', label: 'შეკვეთები', icon: 'orders' },
  { to: '/admin/quotes', label: 'კორპორატიული', icon: 'quotes' },
  { to: '/admin/products', label: 'პროდუქტები', icon: 'products' },
  { to: '/admin/constructor', label: 'კონსტრუქტორი', icon: 'constructor' },
  { to: '/admin/users', label: 'მომხმარებლები', icon: 'users' },
  { to: '/admin/settings', label: 'პარამეტრები', icon: 'settings' },
  { to: '/admin/logs', label: 'ჟურნალი', icon: 'logs' },
];

/** Change-password dialog for the signed-in admin (POST /api/me/password). */
function PasswordDialog({ onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', repeat: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = (k) => (e) => { setError(''); setForm((f) => ({ ...f, [k]: e.target.value })); };

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8) return setError('ახალი პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს');
    if (form.newPassword !== form.repeat) return setError('პაროლები არ ემთხვევა');
    setBusy(true);
    try {
      await api.post('/api/me/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.code === 'WRONG_PASSWORD' ? 'მიმდინარე პაროლი არასწორია' : 'პაროლი ვერ შეიცვალა');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.dialogBackdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className={s.dialog} onSubmit={submit} role="dialog" aria-modal="true" aria-label="პაროლის შეცვლა">
        <h2 className={s.dialogTitle}>პაროლის შეცვლა</h2>
        {done ? (
          <>
            <p className={s.dialogOk}>პაროლი შეიცვალა.</p>
            <div className={s.dialogActions}>
              <button type="button" className={s.dialogPrimary} onClick={onClose}>დახურვა</button>
            </div>
          </>
        ) : (
          <>
            <label className={s.dialogField}>
              <span>მიმდინარე პაროლი</span>
              <input type="password" value={form.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" autoFocus />
            </label>
            <label className={s.dialogField}>
              <span>ახალი პაროლი (მინ. 8 სიმბოლო)</span>
              <input type="password" value={form.newPassword} onChange={set('newPassword')} autoComplete="new-password" />
            </label>
            <label className={s.dialogField}>
              <span>გაიმეორე ახალი პაროლი</span>
              <input type="password" value={form.repeat} onChange={set('repeat')} autoComplete="new-password" />
            </label>
            {error && <p className={s.dialogError}>{error}</p>}
            <div className={s.dialogActions}>
              <button type="button" className={s.dialogGhost} onClick={onClose}>გაუქმება</button>
              <button type="submit" className={s.dialogPrimary} disabled={busy || !form.currentPassword || !form.newPassword}>
                {busy ? 'ინახება…' : 'შეცვლა'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

// Access is enforced by <ProtectedRoute roles={['admin']}> in App.jsx.
export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the user menu on an outside click.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const signOut = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className={s.layout}>
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <img src={logo} alt="" />
          <div>
            <div className={s.brandName}>PRENTA</div>
            <div className={s.brandSub}>ადმინ პანელი</div>
          </div>
        </div>

        <nav className={s.nav}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `${s.link} ${isActive ? s.linkOn : ''}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={ICONS[item.icon]} />
              </svg>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

      </aside>

      <main className={s.main}>
        {/* Top-right: open the storefront, who is signed in, sign out. */}
        <header className={s.topbar}>
          <Link to="/" className={s.topIcon} title="საიტის ნახვა" aria-label="საიტის ნახვა">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 4h18v12H3zM8 20h8M12 16v4" />
            </svg>
          </Link>
          {user && (
            <div className={s.meWrap} ref={menuRef}>
              <button type="button" className={s.me} onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
                <span className={s.avatar}>{(user.name || user.email || '?').slice(0, 1).toUpperCase()}</span>
                <span className={s.meText}>
                  <span className={s.meName}>{user.name}</span>
                  <span className={s.meMail}>{user.email}</span>
                </span>
                <svg className={s.meChev} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {menuOpen && (
                <div className={s.menu} role="menu">
                  <div className={s.menuHead}>
                    <span className={s.meName}>{user.name}</span>
                    <span className={s.meMail}>{user.email}</span>
                  </div>
                  <button type="button" role="menuitem" className={s.menuItem} onClick={() => { setMenuOpen(false); setPwOpen(true); }}>
                    პაროლის შეცვლა
                  </button>
                  <button type="button" role="menuitem" className={`${s.menuItem} ${s.menuDanger}`} onClick={signOut}>
                    გასვლა
                  </button>
                </div>
              )}
            </div>
          )}
        </header>
        {pwOpen && <PasswordDialog onClose={() => setPwOpen(false)} />}
        <Outlet />
      </main>
    </div>
  );
}
