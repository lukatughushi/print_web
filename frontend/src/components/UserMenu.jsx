import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { avatarColor, initialsOf } from '../lib/userBadge';
import s from './Navbar.module.css';
import { useI18n } from '../i18n/i18n-context';

const ITEMS = [
  { to: '/account', label: 'ჩემი ანგარიში' },
  { to: '/account?tab=designs', label: 'ჩემი დიზაინები' },
  { to: '/account?tab=media', label: 'ჩემი სურათები' },
  { to: '/account?tab=orders', label: 'შეკვეთები' },
  { to: '/shop?fav=1', label: 'რჩეულები' },
];

/** Initials avatar of the signed-in user, with the account menu. */
export default function UserMenu() {
  const { t } = useI18n();
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  // Close on navigation, outside click and Escape.
  const [lastLocation, setLastLocation] = useState(pathname + search);
  if (lastLocation !== pathname + search) {
    setLastLocation(pathname + search);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Leave first: signing out on a protected page would otherwise bounce to /login.
  const signOut = () => {
    navigate('/');
    logout();
  };

  return (
    <div className={s.userMenu} ref={ref}>
      <button
        type="button"
        className={`${s.avatar} ${open || pathname === '/account' ? s.avatarOn : ''}`}
        style={{ background: avatarColor(user) }}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${user.name} — ${user.email}`}
      >
        {initialsOf(user)}
      </button>
      {open && (
        <div className={s.menu} role="menu">
          <div className={s.menuHead}>
            <span className={s.menuAvatar} style={{ background: avatarColor(user) }}>{initialsOf(user)}</span>
            <span className={s.menuWho}>
              <span className={s.menuName}>{user.name}</span>
              <span className={s.menuEmail}>{user.email}</span>
            </span>
          </div>
          {ITEMS.map((it) => (
            <Link key={it.to} to={it.to} className={s.menuItem} role="menuitem">{t(it.label)}</Link>
          ))}
          {isAdmin && <Link to="/admin/dashboard" className={s.menuItem} role="menuitem">{t('ადმინ პანელი')}</Link>}
          <button type="button" className={`${s.menuItem} ${s.menuOut}`} role="menuitem" onClick={signOut}>{t('გასვლა')}</button>
        </div>
      )}
    </div>
  );
}
