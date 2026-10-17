import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthCard, Field, FormError, SubmitButton } from '../components/AuthCard';
import { useAuth } from '../context/auth-context';
import api, { getErrorMessage } from '../lib/api';
import { useI18n } from '../i18n/i18n-context';

const linkCls = 'font-semibold text-coral hover:text-navy!';

function Notice({ children }) {
  return <p className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{children}</p>;
}

/** /verify-email?token=… — opened from the sign-up e-mail; signs in. */
export function VerifyEmailPage() {
  const { t } = useI18n();
  const { startSession } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    api.post('/api/auth/verify-email', { token: params.get('token') || '' })
      .then(({ data }) => {
        startSession(data);
        navigate('/account', { replace: true });
      })
      .catch((err) => setError(getErrorMessage(err, t('ბმული არასწორია ან ვადაგასულია'))));
  }, [params, startSession, navigate, t]);

  return (
    <AuthCard
      title={t('ელფოსტის დადასტურება')}
      subtitle={error ? '' : t('მოწმდება…')}
      footer={<Link to="/login" className={linkCls}>{t('შესვლა')}</Link>}
    >
      <FormError message={error} />
    </AuthCard>
  );
}

/** /forgot-password — asks for the e-mail and sends a reset link. */
export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, t('ვერ გაიგზავნა')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title={t('პაროლის აღდგენა')}
      subtitle={t('ჩაწერე ელფოსტა და გამოგიგზავნით ბმულს')}
      footer={<Link to="/login" className={linkCls}>{t('შესვლაზე დაბრუნება')}</Link>}
    >
      {sent ? (
        <Notice>{t('თუ ეს ელფოსტა რეგისტრირებულია, ბმული უკვე გამოგზავნილია. შეამოწმე Spam საქაღალდეც.')}</Notice>
      ) : (
        <form onSubmit={submit} noValidate>
          <FormError message={error} />
          <Field label={t('ელ-ფოსტა')} id="email" name="email" type="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <SubmitButton loading={loading}>{t('ბმულის გაგზავნა')}</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}

/** /reset-password?token=… — sets a new password from the e-mailed link. */
export function ResetPasswordPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError(t('პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს'));
    if (form.password !== form.confirm) return setError(t('პაროლები არ ემთხვევა'));
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token: params.get('token') || '', password: form.password });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, t('ბმული არასწორია ან ვადაგასულია')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title={t('ახალი პაროლი')}
      subtitle={t('ჩაწერე ახალი პაროლი')}
      footer={<Link to="/login" className={linkCls}>{t('შესვლა')}</Link>}
    >
      {done ? (
        <Notice>{t('პაროლი შეიცვალა — ახლა შეგიძლია შეხვიდე.')}</Notice>
      ) : (
        <form onSubmit={submit} noValidate>
          <FormError message={error} />
          <Field label={t('ახალი პაროლი')} id="password" name="password" type="password" autoComplete="new-password"
            value={form.password} onChange={update} required minLength={8} autoFocus />
          <Field label={t('გაიმეორე პაროლი')} id="confirm" name="confirm" type="password" autoComplete="new-password"
            value={form.confirm} onChange={update} required />
          <SubmitButton loading={loading}>{t('პაროლის შენახვა')}</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}

/** /confirm-password?token=… — confirms a password change from the account. */
export function ConfirmPasswordPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [state, setState] = useState({ done: false, error: '' });
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    api.post('/api/auth/confirm-password', { token: params.get('token') || '' })
      .then(() => setState({ done: true, error: '' }))
      .catch((err) => setState({ done: false, error: getErrorMessage(err, t('ბმული არასწორია ან ვადაგასულია')) }));
  }, [params, t]);

  return (
    <AuthCard
      title={t('პაროლის შეცვლა')}
      subtitle={state.done || state.error ? '' : t('მოწმდება…')}
      footer={<Link to="/account" className={linkCls}>{t('ანგარიშზე დაბრუნება')}</Link>}
    >
      <FormError message={state.error} />
      {state.done && <Notice>{t('პაროლი შეიცვალა.')}</Notice>}
    </AuthCard>
  );
}

/** "Check your e-mail" with a resend button (sign-up and blocked sign-in). */
export function CheckEmail({ email }) {
  const { t } = useI18n();
  const [state, setState] = useState('idle'); // idle | busy | sent

  const resend = async () => {
    setState('busy');
    try {
      await api.post('/api/auth/resend-verification', { email });
    } finally {
      setState('sent');
    }
  };

  return (
    <div>
      <Notice>
        {t('დადასტურების ბმული გამოგზავნილია მისამართზე')} <b>{email}</b>. {t('გახსენი მეილი და დააჭირე ბმულს. შეამოწმე Spam საქაღალდეც.')}
      </Notice>
      <button
        type="button"
        onClick={resend}
        disabled={state !== 'idle'}
        className="w-full cursor-pointer rounded-full border border-[#DED7CF] bg-white px-6 py-3 font-semibold text-navy transition hover:border-navy disabled:cursor-default disabled:opacity-60"
      >
        {state === 'sent' ? t('ბმული ხელახლა გაიგზავნა') : state === 'busy' ? '...' : t('ბმულის ხელახლა გაგზავნა')}
      </button>
    </div>
  );
}
