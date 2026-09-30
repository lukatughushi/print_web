import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import useCartStore from '../store/cartStore';
import { useAuth } from '../context/auth-context';
import api from '../lib/api';
import logo from '../assets/prenta/LOGO_PRENTA.png';
import s from './Navbar.module.css';

export default function Navbar() {
  const cartCount = useCartStore((st) => st.items.reduce((sum, it) => sum + (it.quantity || 1), 0));
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
        </nav>

        {/* ── Cart ──────────────────────────────────────────── */}
        <div className={s.right}>
          <NavLink
            to={isAuthenticated ? '/account' : '/login'}
            className={({ isActive }) => `${s.link} ${isActive ? s.linkActive : ''}`}
          >
            {isAuthenticated ? 'ანგარიში' : 'შესვლა'}
          </NavLink>
          <Link to="/cart" className={s.cart} aria-label="კალათა">
            <span>კალათა</span>
            {cartCount > 0 && <span className={s.badge}>{cartCount}</span>}
          </Link>
        </div>

      </div>
    </header>
  );
}
