import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { CATEGORY_LABELS, CATEGORY_EN, productImg, money } from '../lib/catalog';
import catTshirt from '../assets/prenta/cat_tshirt.png';
import mainHoodie from '../assets/prenta/main_hoode.png';
import mainBag from '../assets/prenta/main_bag.png';
import s from './storefront.module.css';

const FALLBACK = { TSHIRT: catTshirt, HOODIE: mainHoodie, BAG: mainBag };

export default function ShopPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState(null); // null = loading
  const [filter, setFilter] = useState('all');
  const [settings, setSettings] = useState({ currency: '₾' });

  useEffect(() => {
    api.get('/api/products').then((r) => setProducts(Array.isArray(r.data) ? r.data : [])).catch(() => setProducts([]));
    api.get('/api/settings').then((r) => r.data && setSettings((v) => ({ ...v, ...r.data }))).catch(() => {});
  }, []);

  const categories = useMemo(() => {
    const set = new Set((products || []).map((p) => p.category));
    return ['all', ...set];
  }, [products]);

  const shown = (products || []).filter((p) => filter === 'all' || p.category === filter);

  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <h1 className={s.h1}>მაღაზია</h1>
        <p className={s.lead}>მზა დიზაინები — შეუკვეთე პირდაპირ ან გახსენი კონსტრუქტორში და შეცვალე.</p>

        {products && products.length > 0 && (
          <div className={s.filters}>
            {categories.map((c) => (
              <div
                key={c}
                className={`${s.pill} ${filter === c ? s.pillActive : ''}`}
                onClick={() => setFilter(c)}
                role="button"
                tabIndex={0}
              >
                {c === 'all' ? 'ყველა' : CATEGORY_LABELS[c] || c}
              </div>
            ))}
          </div>
        )}

        {products === null && <div className={s.status}>იტვირთება…</div>}
        {products && products.length === 0 && <div className={s.status}>პროდუქცია ჯერ არ არის დამატებული.</div>}

        <div className={s.grid}>
          {shown.map((p) => (
            <div key={p.id} className={s.card} onClick={() => navigate(`/product/${p.id}`)} role="button" tabIndex={0}>
              <div className={s.tile}>
                <img
                  src={productImg(p) || FALLBACK[p.category] || catTshirt}
                  alt={p.name}
                  onError={(e) => { e.currentTarget.src = FALLBACK[p.category] || catTshirt; }}
                />
              </div>
              <div className={s.cardBody}>
                <div className={s.cardTitle}>{p.name}</div>
                <div className={s.cardEn}>{CATEGORY_EN[p.category] || p.category}</div>
                <div className={s.cardFoot}>
                  <span className={s.price}>{money(p.basePrice, settings.currency)}</span>
                  <span className={s.muted}>{CATEGORY_LABELS[p.category] || p.category}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
