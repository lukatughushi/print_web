import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import useCartStore from '../store/cartStore';
import { useAuth } from '../context/auth-context';
import { useI18n } from '../i18n/i18n-context';
import s from './storefront.module.css';

// While the bank is still settling, ask again for up to about half a minute.
const POLL_MS = 2500;
const POLL_TRIES = 12;

/**
 * Where Bank of Georgia sends the customer after paying (?order=<id>, plus
 * &failed=1 on the fail route). The result always comes from the server,
 * which reads it from the bank.
 */
export default function PaymentResultPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderId = params.get('order') || '';
  const { status: authStatus, isAuthenticated } = useAuth();
  const clearCart = useCartStore((st) => st.clear);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [stillPending, setStillPending] = useState(false);

  const load = useCallback(() => api.get(`/api/payments/bog/${orderId}/status`).then((r) => r.data), [orderId]);

  useEffect(() => {
    if (authStatus !== 'ready') return undefined;
    if (!isAuthenticated || !orderId) return undefined;
    let dead = false;
    let tries = 0;
    let timer = 0;
    const tick = () => load().then((data) => {
      if (dead) return;
      setOrder(data);
      if (data.paymentStatus === 'paid') {
        clearCart();
        try { sessionStorage.removeItem('checkoutDraft'); sessionStorage.removeItem('checkoutPendingOrder'); } catch { /* storage off */ }
      } else if (data.paymentStatus === 'pending' && ++tries < POLL_TRIES) {
        timer = window.setTimeout(tick, POLL_MS);
      } else if (data.paymentStatus === 'pending') {
        setStillPending(true);
      }
    }).catch((err) => !dead && setError(getErrorMessage(err, t('გადახდის სტატუსი ვერ შემოწმდა.'))));
    tick();
    return () => { dead = true; window.clearTimeout(timer); };
  }, [authStatus, isAuthenticated, orderId, load, clearCart, t]);

  const retry = async () => {
    setRetrying(true);
    setError('');
    try {
      const { data } = await api.post(`/api/payments/bog/${orderId}/start`);
      window.location.assign(data.redirectUrl);
    } catch (err) {
      setError(getErrorMessage(err, t('გადახდის გვერდი ვერ გაიხსნა. სცადე ხელახლა.')));
      setRetrying(false);
    }
  };

  const status = order?.paymentStatus;
  const missing = authStatus === 'ready' && (!isAuthenticated || !orderId);
  let body;
  if (error || missing) {
    body = (
      <>
        <h1 className={s.h1}>{t('რაღაც ვერ გამოვიდა')}</h1>
        <p className={s.doneText}>{error || t('შეკვეთა ვერ მოიძებნა.')}</p>
        <button className={s.btnDark} onClick={() => navigate('/account')}>{t('ჩემი შეკვეთები')}</button>
      </>
    );
  } else if (status === 'paid') {
    body = (
      <>
        <div className={s.doneIcon}>✓</div>
        <h1 className={s.h1}>{t('გადახდა მიღებულია')}</h1>
        <p className={s.doneText}>
          {t('შეკვეთის ნომერი')} <strong>{order.number}</strong>. {t('დაგიკავშირდებით {phone} ნომერზე დადასტურებისთვის.', { phone: order.phone })}
        </p>
        <p className={s.doneText} style={{ color: '#8A98A6', marginBottom: 30 }}>{t('მიწოდება 2–3 სამუშაო დღეში')}</p>
        <button className={s.btnDark} onClick={() => navigate('/shop')}>{t('გაგრძელება')}</button>
      </>
    );
  } else if (status === 'failed' || status === 'unpaid' || (status === 'pending' && params.get('failed'))) {
    body = (
      <>
        <h1 className={s.h1}>{t('გადახდა არ შედგა')}</h1>
        <p className={s.doneText}>
          {t('შეკვეთა {number} შენახულია, მაგრამ გადახდა ვერ მოხერხდა. სცადე ხელახლა.', { number: order.number })}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
          <button className={s.btnPrimary} onClick={retry} disabled={retrying}>
            {retrying ? t('იხსნება…') : t('ხელახლა გადახდა')}
          </button>
          <button className={s.btnOutline} onClick={() => navigate('/checkout')}>{t('უკან შეკვეთაზე')}</button>
        </div>
      </>
    );
  } else if (stillPending) {
    body = (
      <>
        <h1 className={s.h1}>{t('გადახდა ჯერ მუშავდება')}</h1>
        <p className={s.doneText}>{t('ბანკს პასუხისთვის მეტი დრო სჭირდება. შეკვეთის სტატუსს ანგარიშის გვერდზე ნახავ.')}</p>
        <button className={s.btnDark} onClick={() => navigate('/account')}>{t('ჩემი შეკვეთები')}</button>
      </>
    );
  } else {
    body = (
      <>
        <h1 className={s.h1}>{t('გადახდა მოწმდება…')}</h1>
        <p className={s.doneText}>{t('ბანკიდან პასუხს ველოდებით, ეს რამდენიმე წამს გასტანს.')}</p>
      </>
    );
  }

  return (
    <main className={s.page}>
      <div className={s.done}>{body}</div>
    </main>
  );
}
