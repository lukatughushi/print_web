import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import useCartStore from '../store/cartStore';
import { CATEGORY_LABELS, CATEGORY_EN, productImg, money } from '../lib/catalog';
import catTshirt from '../assets/prenta/cat_tshirt.png';
import mainHoodie from '../assets/prenta/main_hoode.png';
import mainBag from '../assets/prenta/main_bag.png';
import s from './storefront.module.css';

const FALLBACK = { TSHIRT: catTshirt, HOODIE: mainHoodie, BAG: mainBag };

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((st) => st.addItem);

  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState({ currency: '₾' });
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    api.get(`/api/products/${id}`)
      .then((r) => {
        setProduct(r.data);
        setSize(r.data?.sizes?.[Math.floor((r.data.sizes.length - 1) / 2)] || r.data?.sizes?.[0] || 'M');
      })
      .catch(() => setError('პროდუქტი ვერ მოიძებნა.'));
    api.get('/api/settings').then((r) => r.data && setSettings((v) => ({ ...v, ...r.data }))).catch(() => {});
  }, [id]);

  if (error) {
    return (
      <main className={s.page}>
        <div className={s.wrapNarrow}>
          <div className={s.back} onClick={() => navigate('/shop')}>← მაღაზიაში დაბრუნება</div>
          <div className={s.status}>{error}</div>
        </div>
      </main>
    );
  }
  if (!product) {
    return <main className={s.page}><div className={s.wrapNarrow}><div className={s.status}>იტვირთება…</div></div></main>;
  }

  const addToCart = () => {
    addItem({
      productId: product.id,
      productName: product.name,
      basePrice: product.basePrice,
      size,
      quantity: qty,
      shirtColor: '',
      canvasJson: null,
      previewUrl: '',
    });
    navigate('/cart');
  };

  return (
    <main className={s.page}>
      <div className={s.wrapNarrow}>
        <div className={s.back} onClick={() => navigate('/shop')}>← მაღაზიაში დაბრუნება</div>

        <div className={s.detailGrid}>
          <div className={s.detailTile}>
            <img
              src={productImg(product) || FALLBACK[product.category] || catTshirt}
              alt={product.name}
              onError={(e) => { e.currentTarget.src = FALLBACK[product.category] || catTshirt; }}
            />
          </div>

          <div>
            <div className={s.kicker}>{CATEGORY_LABELS[product.category] || product.category}</div>
            <h1 className={s.detailTitle}>{product.name}</h1>
            <div className={s.kicker} style={{ marginBottom: 16 }}>{CATEGORY_EN[product.category] || product.category}</div>
            <div className={s.detailPrice}>{money(product.basePrice * qty, settings.currency)}</div>

            <p className={s.detailText}>
              100% ბამბა, 190 გრ/მ². DTF ბეჭდვა — არ სკდება და არ ცვივა 50+ რეცხვის შემდეგ.
              მიწოდება 2–3 სამუშაო დღეში.
            </p>

            {product.sizes?.length > 0 && (
              <>
                <div className={s.fieldLabel}>ზომა</div>
                <div className={s.sizeRow}>
                  {product.sizes.map((z) => (
                    <div
                      key={z}
                      className={`${s.pill} ${size === z ? s.pillActive : ''}`}
                      onClick={() => setSize(z)}
                      role="button"
                      tabIndex={0}
                    >
                      {z}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className={s.fieldLabel}>რაოდენობა</div>
            <div className={`${s.qty}`} style={{ marginBottom: 28 }}>
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="კლება">−</button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="მატება">+</button>
            </div>

            <div className={s.actions}>
              <button className={s.btnDark} onClick={addToCart}>კალათაში დამატება</button>
              <button className={s.btnOutline} onClick={() => navigate(`/design/${product.id}`)}>დიზაინის შეცვლა</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
