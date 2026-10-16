import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import useCartStore from '../store/cartStore';
import { COLORS, money, shippingFor, starterProduct } from '../lib/catalog';
import { ProductImage } from '../components/ProductCard';
import s from './storefront.module.css';
import { useI18n } from '../i18n/i18n-context';
import { productName } from '../i18n/products';

// A constructor line with at least one image or text on it.
function hasDesign(item) {
  if (!item.canvasJson) return false;
  try {
    const d = typeof item.canvasJson === 'string' ? JSON.parse(item.canvasJson) : item.canvasJson;
    return [d.images, d.texts, d.back?.images, d.back?.texts].some((list) => list?.length > 0);
  } catch {
    return false;
  }
}

// Cart lines keep the garment colour as a hex value; the catalogue keys it by name.
const colorKey = (hex) =>
  Object.keys(COLORS).find((k) => COLORS[k].hex.toLowerCase() === String(hex || '').toLowerCase()) ?? 'white';

export default function CartPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { items, removeItem, setQty } = useCartStore();
  const [settings, setSettings] = useState({ currency: '₾', freeShipThreshold: 150 });
  const [studioPath, setStudioPath] = useState('/design/start');
  const [productsById, setProductsById] = useState({});

  useEffect(() => {
    api.get('/api/settings').then((r) => r.data && setSettings((v) => ({ ...v, ...r.data }))).catch(() => {});
    api.get('/api/products')
      .then((r) => {
        if (!Array.isArray(r.data)) return;
        const starter = starterProduct(r.data);
        if (starter) setStudioPath(`/design/${starter.id}`);
        setProductsById(Object.fromEntries(r.data.map((p) => [p.id, p])));
      })
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
          <h1 className={s.h1} style={{ marginBottom: 24 }}>{t('კალათა')}</h1>
          <div className={s.emptyCard}>
            <h2>{t('კალათა ცარიელია')}</h2>
            <p>{t('დაიწყე შენი დიზაინით ან აირჩიე მზა პროდუქტი.')}</p>
            <div className={s.emptyActions}>
              <button className={s.btnPrimary} onClick={() => navigate(studioPath)}>{t('კონსტრუქტორი')}</button>
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
        <h1 className={s.h1} style={{ marginBottom: 24 }}>{t('კალათა')}</h1>

        <div className={s.twoCol}>
          <div className={s.lines}>
            {items.map((it, i) => (
              <div key={i} className={s.line}>
                <div className={s.lineThumb}>
                  {it.previewUrl
                    ? <img src={it.previewUrl} alt={productName(it.productName, lang)} />
                    : productsById[it.productId]
                      ? <ProductImage product={productsById[it.productId]} color={colorKey(it.shirtColor)} className={s.lineProductImg} />
                      : <span className={s.muted}>PRENTA</span>}
                </div>
                <div className={s.lineInfo}>
                  <div className={s.lineTitle}>{it.productName ? productName(it.productName, lang) : t('ჩემი დიზაინი')}</div>
                  {it.size && <div className={s.lineMeta}>{t('ზომა:')} {it.size}</div>}
                  {hasDesign(it) && <div className={s.lineMeta}>{t('შენი დიზაინით')}</div>}
                  <div className={s.lineMeta}>{money(it.basePrice, cur)} / {t('ცალი')}</div>
                </div>
                <div className={s.lineRight}>
                  <div className={s.price} style={{ marginBottom: 8 }}>
                    {money((it.basePrice || 0) * (it.quantity || 1), cur)}
                  </div>
                  <div className={`${s.qty} ${s.qtySm}`}>
                    <button type="button" onClick={() => setQty(i, (it.quantity || 1) - 1)} aria-label={t('კლება')}>−</button>
                    <span>{it.quantity || 1}</span>
                    <button type="button" onClick={() => setQty(i, (it.quantity || 1) + 1)} aria-label={t('მატება')}>+</button>
                  </div>
                  <button className={s.lineRemove} onClick={() => removeItem(i)}>{t('წაშლა')}</button>
                </div>
              </div>
            ))}
          </div>

          <div className={s.summary}>
            <div className={s.summaryRow}><span>{t('პროდუქცია')}</span><span>{money(subtotal, cur)}</span></div>
            <div className={s.summaryRow}><span>{t('მიწოდება')}</span><span>{shipping ? money(shipping, cur) : t('უფასო')}</span></div>
            <div className={s.summaryTotal}>
              <b>{t('ჯამი')}</b>
              <span>{money(total, cur)}</span>
            </div>
            <button className={`${s.btnDark} ${s.summaryBtn}`} onClick={() => navigate('/checkout')}>
              {t('შეკვეთის გაფორმება')}
            </button>
            <div className={s.summaryNote}>
              {subtotal >= freeFrom
                ? t('მიწოდება უფასოა')
                : t('კიდევ {amount} უფასო მიწოდებამდე', { amount: money(freeFrom - subtotal, cur) })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
