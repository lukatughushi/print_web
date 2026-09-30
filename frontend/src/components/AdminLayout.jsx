import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import styles from './AdminLayout.module.css';
import logo from '../assets/prenta/LOGO_PRENTA.png';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/admin/orders', label: 'Orders', icon: '📦' },
  { to: '/admin/products', label: 'Products', icon: '👕' },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/banners', label: 'ბანერები', icon: '🖼️' },
  { to: '/admin/settings', label: 'საიტის კონტენტი', icon: '⚙️' },
];

// Access is enforced by <ProtectedRoute roles={['admin']}> in App.jsx.
export default function AdminLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src={logo} alt="PRENTA" style={{height:'32px', objectFit:'contain'}} />
          <span className={styles.brandSub}>Admin Panel</span>
        </div>
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <NavLink to="/" className={styles.backLink}>
            ← Back to site
          </NavLink>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
