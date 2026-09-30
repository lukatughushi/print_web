import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthCard, Field, FormError, SubmitButton } from '../components/AuthCard';
import { useAuth } from '../context/auth-context';
import { getErrorMessage } from '../lib/api';

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/account';

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to={from} replace />;

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // Mirrors the backend RegisterDto rules so users get instant feedback.
    if (form.name.trim().length < 2) return setError('სახელი უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს');
    if (form.password.length < 8) return setError('პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს');
    if (form.password !== form.confirm) return setError('პაროლები არ ემთხვევა');

    setLoading(true);
    try {
      await register({ name: form.name.trim(), email: form.email, password: form.password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'რეგისტრაცია ვერ მოხერხდა'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="რეგისტრაცია"
      subtitle="შექმენი ანგარიში"
      footer={
        <>
          უკვე გაქვს ანგარიში?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-coral hover:text-navy!">
            შესვლა
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormError message={error} />
        <Field label="სახელი" id="name" name="name" autoComplete="name"
          value={form.name} onChange={update} required autoFocus />
        <Field label="ელ-ფოსტა" id="email" name="email" type="email" autoComplete="email"
          value={form.email} onChange={update} required />
        <Field label="პაროლი" id="password" name="password" type="password" autoComplete="new-password"
          value={form.password} onChange={update} required minLength={8} />
        <Field label="გაიმეორე პაროლი" id="confirm" name="confirm" type="password" autoComplete="new-password"
          value={form.confirm} onChange={update} required />
        <SubmitButton loading={loading}>რეგისტრაცია</SubmitButton>
      </form>
    </AuthCard>
  );
}
