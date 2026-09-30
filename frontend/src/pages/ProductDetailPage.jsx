import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import useCartStore from '../store/cartStore';
import { CATEGORY_BY_CODE, COLORS, GENDERS, isOnSale, money, priceOf } from '../lib/catalog';
import { ProductImage } from '../components/ProductCard';
import s from './storefront.module.css';

// Categories the design constructor has a tab for (see DesignPage CATEGORIES).
const DESIGNABLE = new Set(['TSHIRT', 'HOODIE', 'BAG', 'CAP']);

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((st) => st.addItem);
  const [searchParams] = useSearchParams();

  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState({ currency: '₾' });
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [color, setColor] = useState(searchParams.get('color') || '');

  useEffect(() => {
    api.get(`/api/products/${id}`)
      .then((r) => {
        setProduct(r.data);
        setSize(r.data?.sizes?.[Math.floor((r.data.sizes.length - 1) / 2)] || r.data?.sizes?.[0] || '');
        setColor((c) => (r.data?.colors?.includes(c) ? c : r.data?.colors?.[0] || 'white'));
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

  const cat = CATEGORY_BY_CODE[product.category];
  const price = priceOf(product);
  const sale = isOnSale(product);

  const addToCart = () => {
    addItem({
      productId: product.id,
      productName: product.name,
      basePrice: price,
      size,
      quantity: qty,
      shirtColor: COLORS[color]?.hex || '',
      canvasJson: null,
      previewUrl: '',
    });
    navigate('/cart');
  };

  return (
    <main className={s.page}>
      <div className={s.wrapNarrow}>
        <nav className={s.crumbs}>
          <Link to="/">მთავარი</Link> / <Link to="/shop">მაღაზია</Link>
          {cat && <> / <Link to={`/shop?cat=${cat.code}`}>{cat.label}</Link></>}
        </nav>

        <div className={s.detailGrid}>
          <div className={s.detailTile}>
            <ProductImage product={product} color={color} />
            {sale && <span className={s.detailBadge}>-{Math.round((1 - price / product.oldPrice) * 100)}%</span>}
          </div>

          <div>
            <div className={s.kicker}>{cat?.label || product.category}</div>
            <h1 className={s.detailTitle}>{product.name}</h1>
            <div className={s.detailPriceRow}>
              <span className={s.detailPrice}>{money(price * qty, settings.currency)}</span>
              {sale && <span className={s.detailOld}>{money(product.oldPrice * qty, settings.currency)}</span>}
            </div>

            <p className={s.detailText}>
              {product.description || 'DTF ბეჭდვა — არ სკდება და არ ცვივა 50+ რეცხვის შემდეგ.'}
            </p>

            <dl className={s.specs}>
              {product.material && <><dt>მასალა</dt><dd>{product.material}</dd></>}
              {product.gender && <><dt>ვისთვის</dt><dd>{GENDERS[product.gender] || product.gender}</dd></>}
              <dt>მიწოდება</dt><dd>2–3 სამუშაო დღე</dd>
            </dl>

            {product.colors?.length > 0 && (
              <>
                <div className={s.fieldLabel}>ფერი: <span className={s.fieldValue}>{COLORS[color]?.name || color}</span></div>
                <div className={s.colorRow}>
                  {product.colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={COLORS[c]?.name || c}
                      aria-label={COLORS[c]?.name || c}
                      aria-pressed={c === color}
                      className={`${s.colorSwatch} ${c === color ? s.colorSwatchActive : ''}`}
                      style={{ background: COLORS[c]?.hex || c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </>
            )}

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
              {DESIGNABLE.has(product.category) && (
                <button className={s.btnOutline} onClick={() => navigate(`/design/${product.id}`)}>დიზაინის შექმნა</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
