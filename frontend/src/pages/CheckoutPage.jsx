import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import useCartStore from '../store/cartStore';
import { useAuth } from '../context/auth-context';
import { kidsSizesFor, money, priceOf, shippingFor } from '../lib/catalog';
import s from './storefront.module.css';
import BackLink from '../components/BackLink';
import PaymentMarks from '../components/PaymentMarks';
import { settingText } from '../lib/settingText';
import c from './Checkout.module.css';
import { useI18n } from '../i18n/i18n-context';
import { productName } from '../i18n/products';

// Online only, through Bank of Georgia.
const PAY_OPTS = [
  ['card', 'ბარათით გადახდა'],
];

// A phone number: 9–15 digits, optionally starting with + (spaces allowed while typing).
const cleanPhone = (v) => v.replace(/\s/g, '');
const PHONE_RE = /^\+?\d{9,15}$/;

// What the customer typed, kept for this tab (e.g. a trip back to the cart).
// method: 'courier' | 'pickup'; zone (courier only): 'tbilisi' | 'region'.
const DRAFT_KEY = 'checkoutDraft';
const EMPTY_FORM = { name: '', phone: '', method: 'courier', zone: 'tbilisi', city: '', addr: '' };
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
// doesn't create a second order (only while the total is unchanged). For a
// customer without an account it also holds the order's key.
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

/** A radio-style choice row, as used for payment. */
function Choice({ on, onPick, children }) {
  return (
    <div
      className={`${s.payOpt} ${on ? s.payOptActive : ''}`}
      onClick={onPick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } }}
      role="radio"
      aria-checked={on}
      tabIndex={0}
    >
      <span className={`${s.radio} ${on ? s.radioOn : ''}`} />
      {children}
    </div>
  );
}

/**
 * Checkout on one screen: name, phone, delivery (courier in Tbilisi or to the
 * regions, or pickup at the studio) and payment. No account needed; a
 * signed-in customer gets the fields filled from the account.
 */
export default function CheckoutPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { items, clear, updateItem, removeItem } = useCartStore();
  const { user, refreshUser } = useAuth();

  const [settings, setSettings] = useState({ currency: '₾' });
  const [form, setForm] = useState(readDraft);
  const [pay, setPay] = useState('card');
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(null); // { orderNo }

  useEffect(() => { saveDraft(form); }, [form]);

  // Signed in: fill empty fields from the account once it is known.
  const [filledFor, setFilledFor] = useState(null);
  if (user && filledFor !== user.id) {
    setFilledFor(user.id);
    setForm((f) => ({
      ...f,
      name: f.name || user.name || '',
      phone: f.phone || user.phone || '',
      city: f.city || user.city || '',
      addr: f.addr || user.address || '',
    }));
  }

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

  // The server's delivery method: 'tbilisi' | 'region' | 'pickup'.
  const delivery = form.method === 'pickup' ? 'pickup' : form.zone;
  const cur = settings.currency || '₾';
  const subtotal = items.reduce((sum, it) => sum + (it.basePrice || 0) * (it.quantity || 1), 0);
  // Fees, threshold and pickup text come from the server; until they arrive
  // nothing is guessed (no built-in fee flashes first).
  const known = settings.shippingFee !== undefined;
  const WAIT = '…';
  const shipping = shippingFor(subtotal, settings, delivery);
  const total = subtotal + shipping;
  const feeText = (zone) => {
    if (!known) return WAIT;
    const fee = shippingFor(subtotal, settings, zone);
    return fee ? money(fee, cur) : t('უფასო');
  };
  const shippingText = known ? (shipping ? money(shipping, cur) : t('უფასო')) : WAIT;
  const totalText = known ? money(total, cur) : WAIT;
  // Admin's pickup text (address, hours…), else the contact address.
  const studioAddress = !known ? WAIT : (settingText(settings, 'pickupText', lang, t)
    || settingText(settings, 'contactAddress', lang, t));
  const city = form.zone === 'tbilisi' ? t('თბილისი') : form.city.trim();

  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setError(''); };
  const pick = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(''); };

  const check = () => {
    if (form.name.trim().length < 2) return t('ჩაწერე სახელი.');
    if (!PHONE_RE.test(cleanPhone(form.phone))) return t('ჩაწერე სწორი ტელეფონის ნომერი.');
    if (delivery === 'region' && form.city.trim().length < 2) return t('ჩაწერე ქალაქი ან სოფელი.');
    if (delivery !== 'pickup' && form.addr.trim().length < 3) return t('ჩაწერე მიწოდების მისამართი.');
    if (hasUnavailable) return t('წაშალე კალათიდან პროდუქტები, რომლებიც აღარ იყიდება.');
    if (needsSize) return t('აირჩიე ზომა მონიშნული პროდუქტებისთვის.');
    return '';
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    const problem = check();
    if (problem) { setError(problem); return; }
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
          phone: cleanPhone(form.phone),
          delivery,
          ...(delivery === 'pickup' ? {} : { address: `${city}, ${form.addr.trim()}` }),
          payment: pay,
          // The server refuses the order (409) if its own total differs.
          expectedTotal: total,
        };

        const { data } = await api.post('/api/orders', payload);
        order = { id: data.id, number: data.number || `PR-${data.id.slice(-6).toUpperCase()}`, total, key: data.guestKey || '' };

        // A signed-in customer's first phone / address go on the account for next time.
        if (user) {
          const profile = {
            ...(!user.phone ? { phone: cleanPhone(form.phone) } : {}),
            ...(delivery !== 'pickup' && !user.address ? { city, address: form.addr.trim() } : {}),
          };
          if (Object.keys(profile).length) api.patch('/api/me/profile', profile).then(() => refreshUser()).catch(() => {});
        }
      }

      // Card: pay on Bank of Georgia's page; it sends the customer back to
      // /checkout/paid. The cart stays until the payment goes through.
      if (pay === 'card') {
        try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(order)); } catch { /* storage off */ }
        try {
          const headers = order.key ? { 'X-Order-Key': order.key } : {};
          const { data: payment } = await api.post(`/api/payments/bog/${order.id}/start`, null, { headers });
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
            {delivery === 'pickup'
              ? [t('გატანა სტუდიიდან'), studioAddress].filter(Boolean).join(' · ')
              : `${t('მიწოდება 2–3 სამუშაო დღეში')} · ${city}`}
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
        <BackLink to="/cart">{t('კალათა')}</BackLink>
        <h1 className={s.h1} style={{ marginBottom: 20 }}>{t('შეკვეთის გაფორმება')}</h1>

        <div className={s.twoCol}>
          <form className={s.formCard} onSubmit={placeOrder} noValidate>
            <div className={s.formGrid}>
              <label className={s.field}>{t('სახელი და გვარი')}
                <input
                  className={s.input}
                  value={form.name}
                  onChange={set('name')}
                  placeholder={t('მაგ. ნინო ბერიძე')}
                  maxLength={80}
                  autoComplete="name"
                />
              </label>
              <label className={s.field}>{t('ტელეფონი')}
                <input className={s.input} type="tel" value={form.phone} onChange={set('phone')} placeholder="+995 5xx xx xx xx" autoComplete="tel" />
              </label>
            </div>
            <p className={c.hint} style={{ margin: '-6px 0 0', fontSize: 13 }}>{t('საკმარისია მხოლოდ სახელიც.')}</p>

            <div className={c.group}>{t('მიწოდება')}</div>
            <div className={s.payList} role="radiogroup" aria-label={t('მიწოდება')}>
              <Choice on={form.method === 'courier'} onPick={() => pick({ method: 'courier' })}>
                <span>{t('საკურიერო მომსახურება')}</span>
              </Choice>
              {form.method === 'courier' && (
                <div className={c.sub}>
                  <div className={s.payList} role="radiogroup" aria-label={t('საკურიერო მომსახურება')}>
                    <Choice on={form.zone === 'tbilisi'} onPick={() => pick({ zone: 'tbilisi' })}>
                      <span className={c.grow}>{t('თბილისში')}</span><span className={c.fee}>{feeText('tbilisi')}</span>
                    </Choice>
                    <Choice on={form.zone === 'region'} onPick={() => pick({ zone: 'region' })}>
                      <span className={c.grow}>{t('რეგიონებში')}</span><span className={c.fee}>{feeText('region')}</span>
                    </Choice>
                  </div>
                  <div className={s.formGrid}>
                    {form.zone === 'region' && (
                      <label className={s.field}>{t('ქალაქი / სოფელი')}
                        <input className={s.input} value={form.city} onChange={set('city')} autoComplete="address-level2" />
                      </label>
                    )}
                    <label className={s.field}>{t('მისამართი')}
                      <input className={s.input} value={form.addr} onChange={set('addr')} autoComplete="street-address" />
                    </label>
                  </div>
                </div>
              )}
              <Choice on={form.method === 'pickup'} onPick={() => pick({ method: 'pickup' })}>
                <span className={c.grow}>{t('ადგილიდან გატანა')}</span><span className={c.fee}>{known ? t('უფასო') : WAIT}</span>
              </Choice>
              {form.method === 'pickup' && studioAddress && (
                <div className={c.sub}><div className={c.signedIn} style={{ whiteSpace: 'pre-line' }}>{studioAddress}</div></div>
              )}
            </div>

            <div className={c.group}>{t('გადახდა')}</div>
            <div className={s.payList} role="radiogroup" aria-label={t('გადახდა')}>
              {PAY_OPTS.map(([k, label]) => (
                <Choice key={k} on={pay === k} onPick={() => setPay(k)}>
                  <span className={c.grow}>{t(label)}</span>
                  {k === 'card' && <PaymentMarks />}
                </Choice>
              ))}
            </div>

            {priceCheck.changed.length > 0 && (
              <div className={s.formNotice}>
                {t('ზოგიერთი პროდუქტის ფასი განახლდა:')}
                {priceCheck.changed.map((ch, i) => (
                  <div key={i}>{ch.name}: {money(ch.from, cur)} → <b>{money(ch.to, cur)}</b></div>
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
              type="submit"
              className={s.btnPrimary}
              style={{ justifyContent: 'center' }}
              disabled={placing || priceCheck.status === 'loading' || hasUnavailable || needsSize}
            >
              {placing
                ? t('იგზავნება…')
                : priceCheck.status === 'loading'
                  ? t('ფასები მოწმდება…')
                  : `${t('შეკვეთის დადასტურება')} · ${totalText}`}
            </button>
            <p className={c.hint} style={{ margin: 0, fontSize: 13 }}>
              {t('შეკვეთის დადასტურებით ეთანხმები')} <Link to="/terms" target="_blank">{t('წესებსა და პირობებს')}</Link>{' '}
              {t('და')} <Link to="/privacy" target="_blank">{t('კონფიდენციალურობის პოლიტიკას')}</Link>.
            </p>
          </form>

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
            <div className={s.summaryRow} style={{ marginTop: 12 }}>
              <span>{delivery === 'pickup' ? t('ადგილიდან გატანა') : t('მიწოდება')}</span>
              <span>{shippingText}</span>
            </div>
            <div className={s.summaryTotal}>
              <b>{t('ჯამი')}</b>
              <span>{totalText}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
