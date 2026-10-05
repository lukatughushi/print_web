import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import useCartStore from '../store/cartStore';
import { money, priceOf, shippingFor } from '../lib/catalog';
import s from './storefront.module.css';

const PAY_OPTS = [
  ['cash', 'გადახდა კურიერთან'],
  ['card', 'ბარათით ონლაინ'],
  ['bog', 'ბანკის განვადება'],
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Custom design for one cart line: layer data, preview, and a print-ready PNG.
async function buildDesign(item) {
  const canvas = typeof item.canvasJson === 'string' ? JSON.parse(item.canvasJson) : item.canvasJson;
  let printUrl = null;
  try {
    // Loaded on demand: shirtTexture pulls in three.js, which the rest of
    // the storefront doesn't need.
    const { renderPrintFile } = await import('../lib/shirtTexture');
    printUrl = await renderPrintFile(canvas);
  } catch {
    // The order still carries the layers; admins can re-create the print file.
  }
  return {
    canvasJson: canvas,
    ...(item.previewUrl ? { previewUrl: item.previewUrl } : {}),
    ...(printUrl ? { printUrl } : {}),
    ...(canvas?.model ? { model: canvas.model } : {}),
  };
}

async function fetchLiveCatalog() {
  const [productsRes, settingsRes] = await Promise.all([
    api.get('/api/products'),
    api.get('/api/settings'),
  ]);
  return { products: productsRes.data || [], settings: settingsRes.data };
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, clear, updateItem, removeItem } = useCartStore();

  const [settings, setSettings] = useState({ currency: '₾', freeShipThreshold: 150 });
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', addr: '' });
  const [pay, setPay] = useState('cash');
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
      if (p.sizes.length === 1 && it.size !== p.sizes[0]) {
        updateItem(i, { size: p.sizes[0] });
      }
    });

    const sizesById = Object.fromEntries(products.map((p) => [p.id, p.sizes]));
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
      setError('შეავსე ყველა ველი — სახელი, ტელეფონი, ქალაქი და მისამართი.');
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setError('შეიყვანე სწორი ელ. ფოსტა.');
      return;
    }
    if (hasUnavailable) {
      setError('წაშალე კალათიდან პროდუქტები, რომლებიც აღარ იყიდება.');
      return;
    }
    if (needsSize) {
      setError('აირჩიე ზომა მონიშნული პროდუქტებისთვის.');
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
      setDone({ orderNo: data.number || `PR-${data.id.slice(-6).toUpperCase()}` });
      clear();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'PRICE_CHANGED') {
        // A price changed after this page loaded: show the new total and let the customer confirm again.
        await fetchLiveCatalog().then(applyLivePrices).catch(() => {});
        setError('ფასები განახლდა. გადაამოწმე ახალი ჯამი და დაადასტურე შეკვეთა ხელახლა.');
      } else if (code === 'INVALID_SIZE') {
        // Sizes changed after this page loaded: reload them so the affected line asks for a new size.
        await fetchLiveCatalog().then(applyLivePrices).catch(() => {});
        setError('ზოგიერთი ზომა აღარ არის ხელმისაწვდომი. აირჩიე ახალი ზომა.');
      } else {
        setError(getErrorMessage(err, 'შეკვეთის გაფორმება ვერ მოხერხდა. სცადე ხელახლა.'));
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
          <h1 className={s.h1}>შეკვეთა მიღებულია</h1>
          <p className={s.doneText}>
            შეკვეთის ნომერი <strong>{done.orderNo}</strong>. დაგიკავშირდებით {form.phone} ნომერზე დადასტურებისთვის.
          </p>
          <p className={s.doneText} style={{ color: '#8A98A6', marginBottom: 30 }}>
            მიწოდება 2–3 სამუშაო დღეში · {form.city}
          </p>
          <button className={s.btnDark} onClick={() => navigate('/shop')}>გაგრძელება</button>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className={s.page}>
        <div className={s.wrapMid}>
          <h1 className={s.h1}>შეკვეთის გაფორმება</h1>
          <div className={s.emptyCard}>
            <h2>კალათა ცარიელია</h2>
            <p>დაამატე პროდუქტი შეკვეთის გასაფორმებლად.</p>
            <div className={s.emptyActions}>
              <button className={s.btnOutline} onClick={() => navigate('/shop')}>მაღაზია</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <div className={s.wrapMid}>
        <div className={s.back} onClick={() => navigate('/cart')}>← კალათა</div>
        <h1 className={s.h1} style={{ marginBottom: 24 }}>შეკვეთის გაფორმება</h1>

        <div className={s.twoCol}>
          <div className={s.formCard}>
            <div className={s.formGrid}>
              <label className={s.field}>სახელი და გვარი
                <input className={s.input} value={form.name} onChange={set('name')} placeholder="ნინო ბერიძე" />
              </label>
              <label className={s.field}>ტელეფონი
                <input className={s.input} value={form.phone} onChange={set('phone')} placeholder="+995 5xx xx xx xx" />
              </label>
              <label className={s.field}>ელ. ფოსტა
                <input className={s.input} type="email" value={form.email} onChange={set('email')} placeholder="nino@example.com" />
              </label>
              <label className={s.field}>ქალაქი
                <input className={s.input} value={form.city} onChange={set('city')} placeholder="თბილისი" />
              </label>
              <label className={s.field}>მისამართი
                <input className={s.input} value={form.addr} onChange={set('addr')} placeholder="ჭავჭავაძის 12, ბ. 4" />
              </label>
            </div>

            <div className={s.fieldLabel} style={{ marginTop: 6 }}>გადახდა</div>
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
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {priceCheck.changed.length > 0 && (
              <div className={s.formNotice}>
                ზოგიერთი პროდუქტის ფასი განახლდა:
                {priceCheck.changed.map((c, i) => (
                  <div key={i}>{c.name}: {money(c.from, cur)} → <b>{money(c.to, cur)}</b></div>
                ))}
              </div>
            )}

            {hasUnavailable && (
              <div className={s.formError}>
                ზოგიერთი პროდუქტი აღარ იყიდება. წაშალე ის შეკვეთიდან გასაგრძელებლად.
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
                ? 'იგზავნება…'
                : priceCheck.status === 'loading'
                  ? 'ფასები მოწმდება…'
                  : `შეკვეთის დადასტურება · ${money(total, cur)}`}
            </button>
          </div>

          <div className={s.summary}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>შეკვეთა</div>
            {items.map((it, i) => (
              priceCheck.unavailableIds.includes(it.productId) ? (
                <div key={i} className={s.summaryRow}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#C8395A' }}>
                    {(it.productName || 'ჩემი დიზაინი')} — აღარ იყიდება
                  </span>
                  <button type="button" className={s.lineRemove} style={{ marginTop: 0 }} onClick={() => removeItem(i)}>
                    წაშლა
                  </button>
                </div>
              ) : (
                <div key={i}>
                  <div className={s.summaryRow}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(it.productName || 'ჩემი დიზაინი')} × {it.quantity || 1}
                    </span>
                    <span>{money((it.basePrice || 0) * (it.quantity || 1), cur)}</span>
                  </div>
                  {hasBadSize(it) && (
                    <label className={s.summaryRow} style={{ color: '#C8395A', fontSize: 13 }}>
                      <span>ზომა {it.size} აღარ არის — აირჩიე:</span>
                      <select value="" onChange={(e) => updateItem(i, { size: e.target.value })}>
                        <option value="" disabled>—</option>
                        {sizeOptionsFor(it).map((z) => <option key={z} value={z}>{z}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              )
            ))}
            <div className={s.summaryRow} style={{ marginTop: 12 }}><span>მიწოდება</span><span>{shipping ? money(shipping, cur) : 'უფასო'}</span></div>
            <div className={s.summaryTotal}>
              <b>ჯამი</b>
              <span>{money(total, cur)}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
