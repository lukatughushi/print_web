import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthCard, Field, FormError, SubmitButton } from '../components/AuthCard';
import { useAuth } from '../context/auth-context';
import { getErrorMessage } from '../lib/api';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/account';

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
      setError(getErrorMessage(err, 'შესვლა ვერ მოხერხდა'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="შესვლა"
      subtitle="შედი შენს ანგარიშზე"
      footer={
        <>
          არ გაქვს ანგარიში?{' '}
          <Link to="/register" state={location.state} className="font-semibold text-coral hover:text-navy!">
            რეგისტრაცია
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormError message={error} />
        <Field label="ელ-ფოსტა" id="email" name="email" type="email" autoComplete="email"
          value={form.email} onChange={update} required autoFocus />
        <Field label="პაროლი" id="password" name="password" type="password" autoComplete="current-password"
          value={form.password} onChange={update} required />
        <SubmitButton loading={loading}>შესვლა</SubmitButton>
      </form>
    </AuthCard>
  );
}
