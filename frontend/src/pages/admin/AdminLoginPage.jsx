import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { getErrorMessage } from '../../lib/api';
import styles from './AdminLoginPage.module.css';
import logo from '../../assets/prenta/LOGO_PRENTA.png';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout, isAdmin } = useAuth();
  const from = location.state?.from?.pathname || '/admin/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAdmin) return <Navigate to={from} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);

      if (user.role !== 'admin') {
        logout();
        setError('არ გაქვს ადმინის წვდომა');
        return;
      }

      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'შესვლა ვერ მოხერხდა'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src={logo} alt="PRENTA" style={{height:'56px', objectFit:'contain'}} />
        </div>
        <div className={styles.divider} />
        <div className={styles.subtitle}>Admin Panel</div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>პაროლი</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? '...' : 'შესვლა'}
          </button>

          {error && <div className={styles.error}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
