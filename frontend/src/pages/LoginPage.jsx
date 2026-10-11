import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthCard, Field, FormError, SubmitButton } from '../components/AuthCard';
import { useAuth } from '../context/auth-context';
import { getErrorMessage } from '../lib/api';
import { useI18n } from '../i18n/i18n-context';

export default function LoginPage() {
  const { t } = useI18n();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromLoc = location.state?.from;
  const from = fromLoc?.pathname ? `${fromLoc.pathname}${fromLoc.search || ''}` : '/account';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to={from} replace />;

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, t('შესვლა ვერ მოხერხდა')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title={t('შესვლა')}
      subtitle={t('შედი შენს ანგარიშზე')}
      footer={
        <>
          {t('არ გაქვს ანგარიში?')}{' '}
          <Link to="/register" state={location.state} className="font-semibold text-coral hover:text-navy!">
            {t('რეგისტრაცია')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormError message={error} />
        <Field label={t('ელ-ფოსტა')} id="email" name="email" type="email" autoComplete="email"
          value={form.email} onChange={update} required autoFocus />
        <Field label={t('პაროლი')} id="password" name="password" type="password" autoComplete="current-password"
          value={form.password} onChange={update} required />
        <SubmitButton loading={loading}>{t('შესვლა')}</SubmitButton>
      </form>
    </AuthCard>
  );
}
