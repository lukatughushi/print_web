import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import useCartStore from '../store/cartStore';
import { money, shippingFor } from '../lib/catalog';
import s from './storefront.module.css';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, removeItem, setQty } = useCartStore();
  const [settings, setSettings] = useState({ currency: '₾', freeShipThreshold: 150 });
  const [studioPath, setStudioPath] = useState('/shop');

  useEffect(() => {
    api.get('/api/settings').then((r) => r.data && setSettings((v) => ({ ...v, ...r.data }))).catch(() => {});
    api.get('/api/products')
      .then((r) => { if (Array.isArray(r.data) && r.data[0]) setStudioPath(`/design/${r.data[0].id}`); })
      .catch(() => {});
  }, []);

  const subtotal = items.reduce((sum, it) => sum + (it.basePrice || 0) * (it.quantity || 1), 0);
  const freeFrom = settings.freeShipThreshold ?? 150;
  const shipping = shippingFor(subtotal, settings);
  const total = subtotal + shipping;
  const cur = settings.currency || '₾';

  if (items.length === 0) {
    return (
      <main className={s.page}>
        <div className={s.wrapMid}>
          <h1 className={s.h1}>კალათა</h1>
          <div className={s.emptyCard}>
            <h2>კალათა ცარიელია</h2>
            <p>დაიწყე შენი დიზაინით ან აირჩიე მზა პროდუქტი.</p>
            <div className={s.emptyActions}>
              <button className={s.btnPrimary} onClick={() => navigate(studioPath)}>კონსტრუქტორი</button>
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
        <h1 className={s.h1} style={{ marginBottom: 24 }}>კალათა</h1>

        <div className={s.twoCol}>
          <div className={s.lines}>
            {items.map((it, i) => (
              <div key={i} className={s.line}>
                <div className={s.lineThumb}>
                  {it.previewUrl
                    ? <img src={it.previewUrl} alt={it.productName} />
                    : <span className={s.muted}>PRENTA</span>}
                </div>
                <div className={s.lineInfo}>
                  <div className={s.lineTitle}>{it.productName || 'ჩემი დიზაინი'}</div>
                  <div className={s.lineMeta}>ზომა: {it.size || '—'}</div>
                  <div className={s.lineMeta}>{money(it.basePrice, cur)} / ცალი</div>
                </div>
                <div className={s.lineRight}>
                  <div className={s.price} style={{ marginBottom: 8 }}>
                    {money((it.basePrice || 0) * (it.quantity || 1), cur)}
                  </div>
                  <div className={`${s.qty} ${s.qtySm}`}>
                    <button type="button" onClick={() => setQty(i, (it.quantity || 1) - 1)} aria-label="კლება">−</button>
                    <span>{it.quantity || 1}</span>
                    <button type="button" onClick={() => setQty(i, (it.quantity || 1) + 1)} aria-label="მატება">+</button>
                  </div>
                  <button className={s.lineRemove} onClick={() => removeItem(i)}>წაშლა</button>
                </div>
              </div>
            ))}
          </div>

          <div className={s.summary}>
            <div className={s.summaryRow}><span>პროდუქცია</span><span>{money(subtotal, cur)}</span></div>
            <div className={s.summaryRow}><span>მიწოდება</span><span>{shipping ? money(shipping, cur) : 'უფასო'}</span></div>
            <div className={s.summaryTotal}>
              <b>ჯამი</b>
              <span>{money(total, cur)}</span>
            </div>
            <button className={`${s.btnDark} ${s.summaryBtn}`} onClick={() => navigate('/checkout')}>
              შეკვეთის გაფორმება
            </button>
            <div className={s.summaryNote}>
              {subtotal >= freeFrom
                ? 'მიწოდება უფასოა'
                : `კიდევ ${money(freeFrom - subtotal, cur)} უფასო მიწოდებამდე`}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
