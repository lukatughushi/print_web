import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import useCartStore from '../store/cartStore';
import { useAuth } from '../context/auth-context';
import { kidsSizesFor, money, priceOf, shippingFor } from '../lib/catalog';
import s from './storefront.module.css';
import { useI18n } from '../i18n/i18n-context';
import { productName } from '../i18n/products';

const PAY_OPTS = [
  ['card', 'გადახდა ბარათით'],
  ['transfer', 'გადახდა საბანკო ანგარიშზე გადმორიცხვით'],
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const { items, clear, updateItem, removeItem } = useCartStore();

  const [settings, setSettings] = useState({ currency: '₾', freeShipThreshold: 150 });
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', addr: '' });
  const { user, refreshUser } = useAuth();
  const [remember, setRemember] = useState(true);

  // Signed in: pre-fill empty fields from the account once it is known.
  const [filledFor, setFilledFor] = useState(null);
  if (user && filledFor !== user.id) {
    setFilledFor(user.id);
    setForm((f) => ({
      name: f.name || user.name || '',
      phone: f.phone || user.phone || '',
      email: f.email || user.email || '',
      city: f.city || user.city || '',
      addr: f.addr || user.address || '',
    }));
  }
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

  const placeOrder = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.city.trim() || !form.addr.trim()) {
      setError(t('შეავსე ყველა ველი — სახელი, ტელეფონი, ქალაქი და მისამართი.'));
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setError(t('შეიყვანე სწორი ელ. ფოსტა.'));
      return;
    }
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

    try {
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
        customerEmail: form.email.trim(),
        address: `${form.city}, ${form.addr}`,
        phone: form.phone.trim(),
        payment: pay,
        // The server refuses the order (409) if its own total differs.
        expectedTotal: total,
      };

      const { data } = await api.post('/api/orders', payload);
      if (detailsChanged && remember) {
        api.patch('/api/me/profile', { phone: form.phone.trim(), city: form.city.trim(), address: form.addr.trim() })
          .then(() => refreshUser())
          .catch(() => {});
      }
      setDone({ orderNo: data.number || `PR-${data.id.slice(-6).toUpperCase()}` });
      clear();
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
    } finally {
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
        <div className={s.back} onClick={() => navigate('/cart')}>{t('← კალათა')}</div>
        <h1 className={s.h1} style={{ marginBottom: 24 }}>{t('შეკვეთის გაფორმება')}</h1>

        <div className={s.twoCol}>
          <div className={s.formCard}>
            <div className={s.formGrid}>
              <label className={s.field}>{t('სახელი და გვარი')}
                <input className={s.input} value={form.name} onChange={set('name')} placeholder={t('ნინო ბერიძე')} />
              </label>
              <label className={s.field}>{t('ტელეფონი')}
                <input className={s.input} value={form.phone} onChange={set('phone')} placeholder="+995 5xx xx xx xx" />
              </label>
              <label className={s.field}>{t('ელ. ფოსტა')}
                <input className={s.input} type="email" value={form.email} onChange={set('email')} placeholder="nino@example.com" />
              </label>
              <label className={s.field}>{t('ქალაქი')}
                <input className={s.input} value={form.city} onChange={set('city')} placeholder={t('თბილისი')} />
              </label>
              <label className={s.field}>{t('მისამართი')}
                <input className={s.input} value={form.addr} onChange={set('addr')} placeholder={t('ჭავჭავაძის 12, ბ. 4')} />
              </label>
            </div>
            {detailsChanged && (
              <label className={s.rememberRow}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                {t('ტელეფონი და მისამართი ანგარიშზე შევინახო შემდეგი შეკვეთისთვის')}
              </label>
            )}

            <div className={s.fieldLabel} style={{ marginTop: 6 }}>{t('გადახდა')}</div>
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
