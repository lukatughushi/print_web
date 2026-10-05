import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import logo from '../assets/prenta/logo_prenta.webp';
import s from './AdminLayout.module.css';

const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  orders: 'M6 2h12l3 5v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7l3-5zM3 7h18M9 11a3 3 0 0 0 6 0',
  products: 'M8 3 4 5 2 9l3 2 1-1v11h12V10l1 1 3-2-2-4-4-2c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  banners: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};

const NAV = [
  { to: '/admin/dashboard', label: 'მიმოხილვა', icon: 'dashboard' },
  { to: '/admin/orders', label: 'შეკვეთები', icon: 'orders' },
  { to: '/admin/products', label: 'პროდუქტები', icon: 'products' },
  { to: '/admin/users', label: 'მომხმარებლები', icon: 'users' },
  { to: '/admin/banners', label: 'ბანერები', icon: 'banners' },
  { to: '/admin/settings', label: 'პარამეტრები', icon: 'settings' },
];

// Access is enforced by <ProtectedRoute roles={['admin']}> in App.jsx.
export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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

        <div className={s.foot}>
          {user && (
            <div className={s.me}>
              <span className={s.avatar}>{(user.name || user.email || '?').slice(0, 1).toUpperCase()}</span>
              <span className={s.meText}>
                <span className={s.meName}>{user.name}</span>
                <span className={s.meMail}>{user.email}</span>
              </span>
            </div>
          )}
          <NavLink to="/" className={s.footLink}>← საიტზე დაბრუნება</NavLink>
          <button type="button" className={s.footBtn} onClick={signOut}>გასვლა</button>
        </div>
      </aside>

      <main className={s.main}>
        <Outlet />
      </main>
    </div>
  );
}
