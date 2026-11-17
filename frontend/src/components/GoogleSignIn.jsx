import { useEffect, useRef, useState } from 'react';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/auth-context';
import { useI18n } from '../i18n/i18n-context';

// The OAuth client id from Google Cloud Console (public; set in Vercel and .env).
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let scriptPromise = null;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  scriptPromise ??= new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT_URL;
    el.async = true;
    el.onload = () => resolve(window.google);
    el.onerror = () => { scriptPromise = null; reject(new Error('Google script failed')); };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

/**
 * Google's own "Continue with Google" button. Its ID token is checked by the
 * server, which signs the customer in (creating the account the first time).
 */
export default function GoogleSignIn({ onSignedIn }) {
  const { t, lang } = useI18n();
  const { startSession } = useAuth();
  const box = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // The latest callbacks, so the button isn't rebuilt on every render.
  const latest = useRef({});
  useEffect(() => { latest.current = { onSignedIn, startSession, t }; });

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let dead = false;
    loadGoogle().then((google) => {
      if (dead || !box.current) return;
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          setBusy(true);
          setError('');
          try {
            const { data } = await api.post('/api/auth/google', { credential });
            const user = latest.current.startSession(data);
            latest.current.onSignedIn?.(user);
          } catch (err) {
            setError(getErrorMessage(err, latest.current.t('Google-ით შესვლა ვერ მოხერხდა')));
          } finally {
            setBusy(false);
          }
        },
      });
      google.accounts.id.renderButton(box.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        locale: lang === 'ka' ? 'ka' : lang,
        width: Math.min(box.current.clientWidth || 320, 400),
      });
    }).catch(() => !dead && setError(latest.current.t('Google-ით შესვლა ვერ ჩაიტვირთა')));
    return () => { dead = true; };
  }, [lang]);

  if (!CLIENT_ID) return null;
  return (
    <div>
      <div ref={box} style={{ minHeight: 44, opacity: busy ? 0.5 : 1 }} />
      {busy && <div style={{ fontSize: 13, color: '#8A98A6', marginTop: 8 }}>{t('შესვლა…')}</div>}
      {error && <div style={{ fontSize: 13, color: '#C8395A', marginTop: 8 }}>{error}</div>}
    </div>
  );
}
