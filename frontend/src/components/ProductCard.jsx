import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CATEGORY_BY_CODE,
  COLORS,
  isOnSale,
  money,
  priceOf,
  productImg,
} from '../lib/catalog';
import useCartStore from '../store/cartStore';
import useFavStore from '../store/favStore';
import useToast from '../store/toastStore';
import s from './ProductCard.module.css';

const MAX_SWATCHES = 6;

// Garment picture for a product in a given colour. Products without their own
// photo use the category's neutral cut-out, tinted by a masked colour layer.
export function ProductImage({ product, color, className = '' }) {
  const cat = CATEGORY_BY_CODE[product.category];
  const own = productImg(product);
  const [failed, setFailed] = useState(false);

  if (own && !failed) {
    return (
      <div className={`${s.media} ${className}`}>
        <img className={s.photo} src={own} alt={product.name} loading="lazy" onError={() => setFailed(true)} />
      </div>
    );
  }

  const img = cat?.img;
  const swatch = COLORS[color];
  const tinted = cat?.tint && swatch && color !== 'white';

  return (
    <div className={`${s.media} ${className}`}>
      {img && (
        <img
          className={`${s.cutout} ${cat?.tint && color === 'white' ? s.white : ''}`}
          src={img}
          alt={product.name}
          loading="lazy"
        />
      )}
      {tinted && (
        <span
          className={s.tint}
          style={{
            backgroundColor: swatch.tint || swatch.hex,
            WebkitMaskImage: `url(${img})`,
            maskImage: `url(${img})`,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

// Stable per-product starting colour, so the grid shows a mix of colours
// instead of mostly the first (usually white) one.
function defaultColorIndex(id = '', count = 1) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % count;
}

function HeartIcon({ filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

export default function ProductCard({ product, currency = '₾' }) {
  const colors = product.colors?.length ? product.colors : ['white'];
  const [color, setColor] = useState(() => colors[defaultColorIndex(product.id, colors.length)]);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((st) => st.addItem);
  const fav = useFavStore((st) => st.ids.includes(product.id));
  const toggleFav = useFavStore((st) => st.toggle);
  const toast = useToast((st) => st.show);

  const cat = CATEGORY_BY_CODE[product.category];
  const price = priceOf(product);
  const sale = isOnSale(product);
  const discount = sale ? Math.round((1 - price / product.oldPrice) * 100) : 0;
  const href = `/product/${product.id}?color=${color}`;

  const addToCart = () => {
    const sizes = product.sizes || [];
    addItem({
      productId: product.id,
      productName: product.name,
      basePrice: price,
      size: sizes[Math.floor((sizes.length - 1) / 2)] || '',
      quantity: 1,
      shirtColor: COLORS[color]?.hex || '',
      canvasJson: null,
      previewUrl: '',
    });
    setAdded(true);
    toast(`${product.name} — კალათაში დაემატა`);
  };

  return (
    <article className={s.card}>
      <Link to={href} className={s.tile} tabIndex={-1} aria-hidden="true">
        <ProductImage product={product} color={color} />
        <span className={s.badges}>
          {product.newArrival && <span className={s.badge}>ახალი</span>}
          {sale && <span className={`${s.badge} ${s.badgeSale}`}>-{discount}%</span>}
        </span>
      </Link>
      <button
        type="button"
        className={`${s.fav} ${fav ? s.favOn : ''}`}
        onClick={() => toggleFav(product.id)}
        aria-label={fav ? 'რჩეულებიდან ამოღება' : 'რჩეულებში დამატება'}
        aria-pressed={fav}
      >
        <HeartIcon filled={fav} />
      </button>

      <div className={s.body}>
        <div className={s.cat}>{cat?.label || product.category}</div>
        <Link to={href} className={s.name} title={product.name}>{product.name}</Link>
        {colors.length > 1 && (
          <div className={s.swatches}>
            {colors.slice(0, MAX_SWATCHES).map((c) => (
              <button
                key={c}
                type="button"
                title={COLORS[c]?.name || c}
                aria-label={COLORS[c]?.name || c}
                aria-pressed={c === color}
                className={`${s.swatch} ${c === color ? s.swatchActive : ''}`}
                style={{ background: COLORS[c]?.hex || c }}
                onClick={() => setColor(c)}
              />
            ))}
            {colors.length > MAX_SWATCHES && <span className={s.more}>+{colors.length - MAX_SWATCHES}</span>}
          </div>
        )}
        <div className={s.priceRow}>
          <span className={s.price}>{money(price, currency)}</span>
          {sale && <span className={s.oldPrice}>{money(product.oldPrice, currency)}</span>}
          <button
            type="button"
            className={`${s.add} ${added ? s.added : ''}`}
            onClick={addToCart}
            aria-label="კალათაში დამატება"
            title="კალათაში დამატება"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d={added ? 'M5 12l5 5 9-10' : 'M12 5v14M5 12h14'} />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
