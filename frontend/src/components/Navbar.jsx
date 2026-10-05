import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import useCartStore from '../store/cartStore';
import useFavStore from '../store/favStore';
import { useAuth } from '../context/auth-context';
import api from '../lib/api';
import logo from '../assets/prenta/logo_prenta.webp';
import s from './Navbar.module.css';

export default function Navbar() {
  const cartCount = useCartStore((st) => st.items.reduce((sum, it) => sum + (it.quantity || 1), 0));
  const favCount = useFavStore((st) => st.ids.length);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();

  // "კონსტრუქტორი" opens the first available product in the constructor.
  const [firstProductId, setFirstProductId] = useState(null);
  useEffect(() => {
    api.get('/api/products')
      .then((r) => setFirstProductId(Array.isArray(r.data) && r.data[0] ? r.data[0].id : null))
      .catch(() => {});
  }, []);
  const studioPath = firstProductId ? `/design/${firstProductId}` : '/';
  const studioActive = pathname.startsWith('/design');
  const shopActive = pathname.startsWith('/shop') || pathname.startsWith('/product');

  return (
    <header className={s.header}>
      <div className={s.inner}>

        {/* ── Logo ──────────────────────────────────────────── */}
        <Link to="/" className={s.brand}>
          <img src={logo} alt="Prenta" className={s.logo} />
          <span className={s.wordmark}>PRENTA</span>
        </Link>

        {/* ── Nav links ─────────────────────────────────────── */}
        <nav className={s.nav}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `${s.link} ${isActive ? s.linkActive : ''}`}
          >
            მთავარი
          </NavLink>
          <button
            type="button"
            className={`${s.link} ${shopActive ? s.linkActive : ''}`}
            onClick={() => navigate('/shop')}
          >
            მაღაზია
          </button>
          <button
            type="button"
            className={`${s.link} ${studioActive ? s.linkActive : ''}`}
            onClick={() => navigate(studioPath)}
          >
            კონსტრუქტორი
          </button>
          <Link to="/shop#corporate" className={s.link}>კორპორატიული</Link>
        </nav>

        {/* ── Cart ──────────────────────────────────────────── */}
        <div className={s.right}>
          <NavLink
            to={isAuthenticated ? '/account' : '/login'}
            className={({ isActive }) => `${s.link} ${isActive ? s.linkActive : ''}`}
          >
            {isAuthenticated ? 'ანგარიში' : 'შესვლა'}
          </NavLink>
          <Link to="/shop?fav=1" className={s.iconBtn} aria-label="რჩეულები" title="რჩეულები">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
            </svg>
            {favCount > 0 && <span className={s.favBadge}>{favCount}</span>}
          </Link>
          <Link to="/cart" className={s.cart} aria-label="კალათა">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 7h14l-1.5 12h-11z" /><path d="M9 7a3 3 0 0 1 6 0" />
            </svg>
            <span className={s.cartLabel}>კალათა</span>
            <span className={s.badge}>{cartCount}</span>
          </Link>
        </div>

      </div>
    </header>
  );
}
