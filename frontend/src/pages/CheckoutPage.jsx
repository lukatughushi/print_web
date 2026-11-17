import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import useCartStore from '../store/cartStore';
import { useAuth } from '../context/auth-context';
import { kidsSizesFor, money, priceOf, shippingFor } from '../lib/catalog';
import s from './storefront.module.css';
import c from './Checkout.module.css';
import GoogleSignIn from '../components/GoogleSignIn';
import ProfessionInput from '../components/ProfessionInput';

const googleSignInAvailable = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
import { useI18n } from '../i18n/i18n-context';
import { productName } from '../i18n/products';

const PAY_OPTS = [
  ['card', 'ბარათით, Apple Pay ან Google Pay'],
  ['transfer', 'გადახდა საბანკო ანგარიშზე გადმორიცხვით'],
];

// Checkout steps, one screen each. "account" is skipped when already signed in.
const STEPS = [
  ['name', 'სახელი'],
  ['account', 'ანგარიში'],
  ['details', 'მიწოდება'],
  ['pay', 'გადახდა'],
];

// A phone number: 9–15 digits, optionally starting with +; spaces, dashes and brackets allowed.
const cleanPhone = (v) => v.replace(/[\s\-()]/g, '');
const PHONE_RE = /^\+?\d{9,15}$/;

// What the customer typed, kept for this tab while they sign in on another page.
const DRAFT_KEY = 'checkoutDraft';
const EMPTY_FORM = { name: '', phone: '', city: '', addr: '', profession: '' };
function readDraft() {
  try { return { ...EMPTY_FORM, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY)) }; } catch { return EMPTY_FORM; }
}
function saveDraft(draft) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage off */ }
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); sessionStorage.removeItem(PENDING_KEY); } catch { /* storage off */ }
}

// An order placed but not yet paid online, so trying the payment again
// doesn't create a second order (only while the total is unchanged).
const PENDING_KEY = 'checkoutPendingOrder';
function readPending(total) {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY));
    return p && Math.abs(p.total - total) < 0.005 ? p : null;
  } catch { return null; }
}

// Custom design for one cart line: layer data, and per side (front / back)
// a mockup showing the placement plus a print-ready PNG of the artwork.
async function buildDesign(item) {
  const canvas = typeof item.canvasJson === 'string' ? JSON.parse(item.canvasJson) : item.canvasJson;
  let printUrl = null;
  let backPrintUrl = null;
  try {
    // Loaded on demand: shirtTexture pulls in three.js, which the rest of
    // the storefront doesn't need.
    const { renderPrintFile } = await import('../lib/shirtTexture');
    // Front artwork is the top-level images/texts; the back has its own.
    // Only the clean print area is printed (see the 3D viewer).
    printUrl = await renderPrintFile(canvas, canvas?.printSafe?.front);
    if (canvas?.back) backPrintUrl = await renderPrintFile(canvas.back, canvas?.printSafe?.back);
  } catch {
    // The order still carries the layers; admins can re-create the print file.
  }
  return {
    canvasJson: canvas,
    ...(item.previewUrl ? { previewUrl: item.previewUrl } : {}),
    ...(printUrl ? { printUrl } : {}),
    ...(backPrintUrl ? { backPrintUrl } : {}),
    ...(item.backPreviewUrl ? { backPreviewUrl: item.backPreviewUrl } : {}),
    ...(canvas?.model ? { model: canvas.model } : {}),
  };
}

// Shop products plus the constructor's own (which may be hidden from the
// shop); a constructor product that is switched off counts as unavailable.
async function fetchLiveCatalog() {
  const [productsRes, ctorRes, settingsRes] = await Promise.all([
    api.get('/api/products'),
    api.get('/api/products/constructor'),
    api.get('/api/settings'),
  ]);
  const ctor = (ctorRes.data || []).filter((p) => p.constructorEnabled !== false);
  const ids = new Set(ctor.map((p) => p.id));
  return { products: [...ctor, ...(productsRes.data || []).filter((p) => !ids.has(p.id))], settings: settingsRes.data };
}

export default function CheckoutPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { items, clear, updateItem, removeItem } = useCartStore();

  const [settings, setSettings] = useState({ currency: '₾', freeShipThreshold: 150 });
  const [form, setForm] = useState(readDraft);
  const [step, setStep] = useState(() => (readDraft().name ? 1 : 0));
  const { user, status: authStatus, refreshUser } = useAuth();
  const [remember, setRemember] = useState(true);

  useEffect(() => { saveDraft(form); }, [form]);

  // Signed in: pre-fill empty fields from the account once it is known.
  const [filledFor, setFilledFor] = useState(null);
  if (user && filledFor !== user.id) {
    setFilledFor(user.id);
    setForm((f) => ({
      name: f.name || user.name || '',
      phone: f.phone || user.phone || '',
      city: f.city || user.city || '',
      addr: f.addr || user.address || '',
      profession: f.profession || user.profession || '',
    }));
  }

  // The account step is only for signing in: skip it once signed in, and
  // return to it if the session ends (an order needs an account).
  const stepKey = STEPS[step][0];
  if (stepKey === 'account' && user) setStep(2);
  if (step > 1 && !user && authStatus === 'ready') setStep(1);
  const detailsChanged = !!user && (
    form.phone.trim() !== (user.phone || '') || form.city.trim() !== (user.city || '') || form.addr.trim() !== (user.address || '')
  );
  const [pay, setPay] = useState('card');
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(null); // { orderNo }

  // Cart prices are snapshots from when each item was added. Re-read the live
  // catalog so the total shown here is what the server will charge.
  // status: 'loading' | 'ok' | 'error' (network failure — the server still verifies).
  // sizesById: each product's currently offered sizes, to catch sizes removed since the item was added.
  const [priceCheck, setPriceCheck] = useState({ status: 'loading', changed: [], unavailableIds: [], sizesById: {} });

  const applyLivePrices = useCallback(({ products, settings: liveSettings }) => {
    if (liveSettings) setSettings((v) => ({ ...v, ...liveSettings }));

    const live = Object.fromEntries(products.map((p) => [p.id, p]));
    const changed = [];
    const unavailableIds = [];

    useCartStore.getState().items.forEach((it, i) => {
      const p = live[it.productId];
      if (!p) {
        unavailableIds.push(it.productId);
        return;
      }
      const livePrice = priceOf(p);
      if (livePrice !== it.basePrice) {
        changed.push({ name: p.name, from: it.basePrice, to: livePrice });
        updateItem(i, { basePrice: livePrice, productName: p.name });
      }
      // With only one size on offer there is nothing to ask the customer.
      if (p.sizes.length === 1 && it.size !== p.sizes[0] && !kidsSizesFor(p).includes(it.size)) {
        updateItem(i, { size: p.sizes[0] });
      }
    });

    const sizesById = Object.fromEntries(products.map((p) => [p.id, p.sizes.length ? [...p.sizes, ...kidsSizesFor(p)] : p.sizes]));
    setPriceCheck({ status: 'ok', changed, unavailableIds, sizesById });
  }, [updateItem]);

  useEffect(() => {
    fetchLiveCatalog()
      .then(applyLivePrices)
      .catch(() => setPriceCheck({ status: 'error', changed: [], unavailableIds: [], sizesById: {} }));
  }, [applyLivePrices]);

  const hasUnavailable = items.some((it) => priceCheck.unavailableIds.includes(it.productId));

  // Sizes the product no longer offers; the customer picks a new one in the summary.
  const sizeOptionsFor = (it) => priceCheck.sizesById[it.productId];
  const hasBadSize = (it) => {
    const sizes = sizeOptionsFor(it);
    // Products without sizes (cap, bag, mug) are one size.
    return Boolean(sizes?.length) && !sizes.includes(it.size);
  };
  const needsSize = items.some(hasBadSize);

  const cur = settings.currency || '₾';
  const subtotal = items.reduce((sum, it) => sum + (it.basePrice || 0) * (it.quantity || 1), 0);
  const shipping = shippingFor(subtotal, settings);
  const total = subtotal + shipping;

  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setError(''); };

  const goTo = (next) => { setError(''); setStep(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const nextFromName = () => {
    if (form.name.trim().length < 2) { setError(t('ჩაწერე, როგორ მოგმართოთ.')); return; }
    goTo(user ? 2 : 1);
  };
  const nextFromDetails = () => {
    if (!PHONE_RE.test(cleanPhone(form.phone))) { setError(t('ჩაწერე სწორი ტელეფონის ნომერი.')); return; }
    if (!form.city.trim() || form.addr.trim().length < 3) { setError(t('ჩაწერე ქალაქი და მისამართი.')); return; }
    goTo(3);
  };
  const professionChanged = !!user && form.profession.trim() !== (user.profession || '');

  const placeOrder = async () => {
    if (!user) { goTo(1); return; }
    if (hasUnavailable) {
      setError(t('წაშალე კალათიდან პროდუქტები, რომლებიც აღარ იყიდება.'));
      return;
    }
    if (needsSize) {
      setError(t('აირჩიე ზომა მონიშნული პროდუქტებისთვის.'));
      return;
    }
    setPlacing(true);
    setError('');
    // On success the page either shows the confirmation or leaves for the bank.

    try {
      let order = pay === 'card' ? readPending(total) : null;
      if (!order) {
        const orderItems = await Promise.all(items.map(async (it) => ({
          productId: it.productId,
          size: it.size || '',
          quantity: it.quantity || 1,
          ...(it.shirtColor ? { color: it.shirtColor } : {}),
          ...(it.canvasJson ? { design: await buildDesign(it) } : {}),
        })));

        const payload = {
          items: orderItems,
          customerName: form.name.trim(),
          address: `${form.city.trim()}, ${form.addr.trim()}`,
          phone: cleanPhone(form.phone),
          payment: pay,
          // The server refuses the order (409) if its own total differs.
          expectedTotal: total,
        };

        const { data } = await api.post('/api/orders', payload);
        order = { id: data.id, number: data.number || `PR-${data.id.slice(-6).toUpperCase()}`, total };
        const profile = {
          ...(detailsChanged && remember ? { phone: form.phone.trim(), city: form.city.trim(), address: form.addr.trim() } : {}),
          ...(professionChanged ? { profession: form.profession.trim() } : {}),
        };
        if (Object.keys(profile).length) {
          api.patch('/api/me/profile', profile).then(() => refreshUser()).catch(() => {});
        }
      }

      // Card: pay on Bank of Georgia's page; it sends the customer back to
      // /checkout/paid. The cart stays until the payment goes through.
      if (pay === 'card') {
        try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(order)); } catch { /* storage off */ }
        try {
          const { data: payment } = await api.post(`/api/payments/bog/${order.id}/start`);
          window.location.assign(payment.redirectUrl);
          return; // leaving the page; keep the button disabled
        } catch (err) {
          // Online payment not set up (local development): the order stands as placed.
          if (err.response?.data?.code !== 'BOG_DISABLED') {
            setError(getErrorMessage(err, t('გადახდის გვერდი ვერ გაიხსნა. სცადე ხელახლა.')));
            setPlacing(false);
            return;
          }
        }
      }
      setDone({ orderNo: order.number });
      clear();
      clearDraft();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'PRICE_CHANGED') {
        // A price changed after this page loaded: show the new total and let the customer confirm again.
        await fetchLiveCatalog().then(applyLivePrices).catch(() => {});
        setError(t('ფასები განახლდა. გადაამოწმე ახალი ჯამი და დაადასტურე შეკვეთა ხელახლა.'));
      } else if (code === 'INVALID_SIZE') {
        // Sizes changed after this page loaded: reload them so the affected line asks for a new size.
        await fetchLiveCatalog().then(applyLivePrices).catch(() => {});
        setError(t('ზოგიერთი ზომა აღარ არის ხელმისაწვდომი. აირჩიე ახალი ზომა.'));
      } else {
        setError(getErrorMessage(err, t('შეკვეთის გაფორმება ვერ მოხერხდა. სცადე ხელახლა.')));
      }
      setPlacing(false);
    }
  };

  if (done) {
    return (
      <main className={s.page}>
        <div className={s.done}>
          <div className={s.doneIcon}>✓</div>
          <h1 className={s.h1}>{t('შეკვეთა მიღებულია')}</h1>
          <p className={s.doneText}>
            {t('შეკვეთის ნომერი')} <strong>{done.orderNo}</strong>. {t('დაგიკავშირდებით {phone} ნომერზე დადასტურებისთვის.', { phone: form.phone })}
          </p>
          <p className={s.doneText} style={{ color: '#8A98A6', marginBottom: 30 }}>
            {t('მიწოდება 2–3 სამუშაო დღეში')} · {form.city}
          </p>
          <button className={s.btnDark} onClick={() => navigate('/shop')}>{t('გაგრძელება')}</button>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className={s.page}>
        <div className={s.wrapMid}>
          <h1 className={s.h1}>{t('შეკვეთის გაფორმება')}</h1>
          <div className={s.emptyCard}>
            <h2>{t('კალათა ცარიელია')}</h2>
            <p>{t('დაამატე პროდუქტი შეკვეთის გასაფორმებლად.')}</p>
            <div className={s.emptyActions}>
              <button className={s.btnOutline} onClick={() => navigate('/shop')}>{t('მაღაზია')}</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <div className={s.wrapMid}>
        <div className={s.back} onClick={() => (step === 0 ? navigate('/cart') : goTo(step === 2 && user ? 0 : step - 1))}>
          {step === 0 ? t('← კალათა') : t('← უკან')}
        </div>
        <h1 className={s.h1} style={{ marginBottom: 20 }}>{t('შეკვეთის გაფორმება')}</h1>

        <ol className={c.steps}>
          {STEPS.map(([key, label], i) => (
            <li key={key} className={`${c.step} ${i < step ? c.stepDone : ''} ${i === step ? c.stepNow : ''}`}>
              <span className={c.stepLabel}>{i + 1}. {t(label)}</span>
            </li>
          ))}
        </ol>

        <div className={s.twoCol}>
          <div className={s.formCard}>
          {stepKey === 'name' && (
            <form className={s.formCard} style={{ padding: 0, border: 0 }} onSubmit={(e) => { e.preventDefault(); nextFromName(); }}>
              <h2 className={c.title}>{t('როგორ მოგმართოთ?')}</h2>
              <input
                className={s.input}
                value={form.name}
                onChange={set('name')}
                placeholder={t('მაგ. ნინო')}
                maxLength={80}
                autoFocus
                autoComplete="given-name"
              />
              {error && <div className={s.formError}>{error}</div>}
              <div className={c.actions}>
                <button type="submit" className={s.btnPrimary}>{t('გაგრძელება')}</button>
              </div>
            </form>
          )}

          {stepKey === 'account' && (
            <>
              <h2 className={c.title}>{t('{name}, შედი ანგარიშზე', { name: form.name.trim() })}</h2>
              <p className={c.hint}>{t('ანგარიშით შეკვეთის სტატუსს ნახავ და შემდეგ ჯერზე ველები თავისით შეივსება.')}</p>
              {authStatus === 'loading' ? (
                <div className={c.hint}>{t('იტვირთება…')}</div>
              ) : (
                <>
                  <GoogleSignIn onSignedIn={() => goTo(2)} />
                  {googleSignInAvailable && <div className={c.or}>{t('ან')}</div>}
                  <div className={c.actions}>
                    <button type="button" className={s.btnOutline} onClick={() => navigate('/login', { state: { from: location } })}>
                      {t('შესვლა ელფოსტით')}
                    </button>
                    <button type="button" className={c.linkBtn} onClick={() => navigate('/register', { state: { from: location } })}>
                      {t('ახალი ანგარიში')}
                    </button>
                  </div>
                </>
              )}
              {error && <div className={s.formError}>{error}</div>}
            </>
          )}

          {stepKey === 'details' && (
            <form className={s.formCard} style={{ padding: 0, border: 0 }} onSubmit={(e) => { e.preventDefault(); nextFromDetails(); }}>
              <h2 className={c.title}>{t('სად მოგიტანოთ?')}</h2>
              {user && <div className={c.signedIn}>{t('ანგარიში: {email}', { email: user.email })}</div>}
              <div className={s.formGrid}>
                <label className={s.field}>{t('ტელეფონი')}
                  <input className={s.input} type="tel" value={form.phone} onChange={set('phone')} placeholder="+995 5xx xx xx xx" autoComplete="tel" />
                </label>
                <label className={s.field}>{t('ქალაქი')}
                  <input className={s.input} value={form.city} onChange={set('city')} placeholder={t('თბილისი')} autoComplete="address-level2" />
                </label>
                <label className={s.field}>{t('მისამართი')}
                  <input className={s.input} value={form.addr} onChange={set('addr')} placeholder={t('ჭავჭავაძის 12, ბ. 4')} autoComplete="street-address" />
                </label>
              </div>
              {detailsChanged && (
                <label className={s.rememberRow}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  {t('ტელეფონი და მისამართი ანგარიშზე შევინახო შემდეგი შეკვეთისთვის')}
                </label>
              )}

              <label className={s.field}>{t('რა სფეროს წარმომადგენელი ხარ? (არასავალდებულო)')}
                <ProfessionInput
                  className={s.input}
                  value={form.profession}
                  onChange={(v) => setForm((f) => ({ ...f, profession: v }))}
                  placeholder={t('დაიწყე აკრეფა, მაგ. დიზაინერი')}
                />
              </label>

              {error && <div className={s.formError}>{error}</div>}
              <div className={c.actions}>
                <button type="submit" className={s.btnPrimary}>{t('გაგრძელება')}</button>
              </div>
            </form>
          )}

          {stepKey === 'pay' && (
          <>
            <h2 className={c.title}>{t('გადახდა')}</h2>
            <div className={c.signedIn}>
              {form.name.trim()} · {form.phone.trim()} · {form.city.trim()}, {form.addr.trim()}
            </div>
            <div className={s.payList}>
              {PAY_OPTS.map(([k, label]) => (
                <div
                  key={k}
                  className={`${s.payOpt} ${pay === k ? s.payOptActive : ''}`}
                  onClick={() => setPay(k)}
                  role="button"
                  tabIndex={0}
                >
                  <span className={`${s.radio} ${pay === k ? s.radioOn : ''}`} />
                  <span>{t(label)}</span>
                </div>
              ))}
            </div>

            {priceCheck.changed.length > 0 && (
              <div className={s.formNotice}>
                {t('ზოგიერთი პროდუქტის ფასი განახლდა:')}
                {priceCheck.changed.map((c, i) => (
                  <div key={i}>{c.name}: {money(c.from, cur)} → <b>{money(c.to, cur)}</b></div>
                ))}
              </div>
            )}

            {hasUnavailable && (
              <div className={s.formError}>
                {t('ზოგიერთი პროდუქტი აღარ იყიდება. წაშალე ის შეკვეთიდან გასაგრძელებლად.')}
              </div>
            )}

            {error && <div className={s.formError}>{error}</div>}

            <button
              className={s.btnPrimary}
              style={{ justifyContent: 'center' }}
              onClick={placeOrder}
              disabled={placing || priceCheck.status === 'loading' || hasUnavailable || needsSize}
            >
              {placing
                ? t('იგზავნება…')
                : priceCheck.status === 'loading'
                  ? t('ფასები მოწმდება…')
                  : `${t('შეკვეთის დადასტურება')} · ${money(total, cur)}`}
            </button>
            <p className={c.hint} style={{ margin: 0, fontSize: 13 }}>
              {t('შეკვეთის დადასტურებით ეთანხმები')} <Link to="/terms" target="_blank">{t('წესებსა და პირობებს')}</Link>{' '}
              {t('და')} <Link to="/privacy" target="_blank">{t('კონფიდენციალურობის პოლიტიკას')}</Link>.
            </p>
          </>
          )}
          </div>

          <div className={s.summary}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>{t('შეკვეთა')}</div>
            {items.map((it, i) => (
              priceCheck.unavailableIds.includes(it.productId) ? (
                <div key={i} className={s.summaryRow}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#C8395A' }}>
                    {it.productName ? productName(it.productName, lang) : t('ჩემი დიზაინი')} — {t('აღარ იყიდება')}
                  </span>
                  <button type="button" className={s.lineRemove} style={{ marginTop: 0 }} onClick={() => removeItem(i)}>
                    {t('წაშლა')}
                  </button>
                </div>
              ) : (
                <div key={i}>
                  <div className={s.summaryRow}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.productName ? productName(it.productName, lang) : t('ჩემი დიზაინი')} × {it.quantity || 1}
                    </span>
                    <span>{money((it.basePrice || 0) * (it.quantity || 1), cur)}</span>
                  </div>
                  {hasBadSize(it) && (
                    <label className={s.summaryRow} style={{ color: '#C8395A', fontSize: 13 }}>
                      <span>{t('ზომა {size} აღარ არის — აირჩიე:', { size: it.size })}</span>
                      <select value="" onChange={(e) => updateItem(i, { size: e.target.value })}>
                        <option value="" disabled>—</option>
                        {sizeOptionsFor(it).map((z) => <option key={z} value={z}>{z}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              )
            ))}
            <div className={s.summaryRow} style={{ marginTop: 12 }}><span>{t('მიწოდება')}</span><span>{shipping ? money(shipping, cur) : t('უფასო')}</span></div>
            <div className={s.summaryTotal}>
              <b>{t('ჯამი')}</b>
              <span>{money(total, cur)}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
