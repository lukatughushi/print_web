import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../lib/api';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COLORS,
  GENDERS,
  SIZE_ORDER,
  priceOf,
  productImg,
} from '../../lib/catalog';
import { ProductImage } from '../../components/ProductCard';
import { gel, getErrorMessage, uploadImage } from './adminShared';
import s from './Admin.module.css';

const EMPTY = {
  name: '',
  category: CATEGORIES[0].code,
  description: '',
  price: '',
  oldPrice: '',
  colors: ['white', 'black'],
  sizes: ['S', 'M', 'L', 'XL'],
  material: '',
  gender: 'unisex',
  newArrival: false,
  isActive: true,
  image: '',
};

// Accessories are one size (see catalog seed).
const ONE_SIZE = new Set(['BAG', 'CAP', 'MUG']);

function toForm(p) {
  return {
    name: p.name ?? '',
    category: p.category ?? CATEGORIES[0].code,
    description: p.description ?? '',
    price: String(priceOf(p) || ''),
    oldPrice: p.oldPrice ? String(p.oldPrice) : '',
    colors: p.colors ?? [],
    sizes: p.sizes ?? [],
    material: p.material ?? '',
    gender: p.gender ?? 'unisex',
    newArrival: !!p.newArrival,
    isActive: p.isActive !== false,
    image: p.image ?? '',
  };
}

function ProductForm({ product, onClose, onSaved }) {
  const [form, setForm] = useState(product ? toForm(product) : EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (key, value) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }));

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      set('image', await uploadImage(file));
    } catch (err) {
      setError(getErrorMessage(err, 'ფოტო ვერ აიტვირთა'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const price = Number(form.price);
    const oldPrice = form.oldPrice === '' ? null : Number(form.oldPrice);
    if (!form.name.trim()) return setError('ჩაწერე სახელი');
    if (!(price >= 0) || form.price === '') return setError('ჩაწერე სწორი ფასი');
    if (oldPrice !== null && !(oldPrice > price)) return setError('ძველი ფასი ახალზე მეტი უნდა იყოს (ან დატოვე ცარიელი)');

    const order = SIZE_ORDER;
    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      price,
      oldPrice,
      colors: Object.keys(COLORS).filter((c) => form.colors.includes(c)),
      sizes: ONE_SIZE.has(form.category) ? [] : order.filter((z) => form.sizes.includes(z)),
      material: form.material.trim(),
      gender: form.gender,
      newArrival: form.newArrival,
      isActive: form.isActive,
      image: form.image || '',
    };

    setBusy(true);
    setError('');
    try {
      const { data } = product
        ? await api.patch(`/api/products/${product.id}`, payload)
        : await api.post('/api/products', payload);
      onSaved(data, !product);
    } catch (err) {
      setError(getErrorMessage(err, 'შენახვა ვერ მოხერხდა'));
      setBusy(false);
    }
  };

  const preview = { ...form, id: product?.id ?? 'new', category: form.category, image: form.image };
  const oneSize = ONE_SIZE.has(form.category);

  return (
    <>
      <div className={s.backdrop} onClick={onClose} aria-hidden="true" />
      <form className={s.drawer} onSubmit={submit} role="dialog" aria-label="პროდუქტი">
        <div className={s.drawerHead}>
          <h2 className={s.drawerTitle}>{product ? 'პროდუქტის რედაქტირება' : 'ახალი პროდუქტი'}</h2>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="დახურვა">✕</button>
        </div>

        <div className={s.drawerBody}>
          {error && <div className={s.error}>{error}</div>}

          <div className={s.card}>
            <div className={s.upload}>
              <div className={s.uploadPreview} style={{ position: 'relative' }}>
                <ProductImage product={preview} color={form.colors[0] || 'white'} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className={s.hint}>
                  {form.image ? 'საკუთარი ფოტო' : 'ფოტოს გარეშე — მაღაზიაში კატეგორიის სურათი ჩანს არჩეულ ფერში'}
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className={`${s.btnGhost} ${s.btnSm}`} disabled={busy} onClick={() => fileRef.current?.click()}>
                    {form.image ? 'ფოტოს შეცვლა' : 'ფოტოს ატვირთვა'}
                  </button>
                  {form.image && (
                    <button type="button" className={`${s.btnDanger} ${s.btnSm}`} onClick={() => set('image', '')}>მოხსნა</button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickImage} />
              </div>
            </div>
          </div>

          <div className={`${s.card} ${s.section}`}>
            <div className={s.field}>
              <label className={s.label} htmlFor="p-name">სახელი</label>
              <input id="p-name" className={s.input} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="მაგ. მაისური „თბილისი“" />
            </div>
            <div className={s.formGrid}>
              <div className={s.field}>
                <label className={s.label} htmlFor="p-cat">კატეგორია</label>
                <select id="p-cat" className={s.input} value={form.category} onChange={(e) => set('category', e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="p-gender">ვისთვის</label>
                <select id="p-gender" className={s.input} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                  {Object.entries(GENDERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className={s.formGrid}>
              <div className={s.field}>
                <label className={s.label} htmlFor="p-price">ფასი (₾)</label>
                <input id="p-price" className={s.input} type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} />
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="p-old">ძველი ფასი (₾)</label>
                <input id="p-old" className={s.input} type="number" min="0" step="0.01" value={form.oldPrice} onChange={(e) => set('oldPrice', e.target.value)} placeholder="ფასდაკლებისთვის" />
              </div>
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="p-mat">მასალა</label>
              <input id="p-mat" className={s.input} value={form.material} onChange={(e) => set('material', e.target.value)} placeholder="მაგ. 100% ბამბა" />
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="p-desc">აღწერა</label>
              <textarea id="p-desc" className={s.textarea} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
          </div>

          <div className={`${s.card} ${s.section}`}>
            <div className={s.field}>
              <span className={s.label}>ფერები</span>
              <div className={s.chipsPick}>
                {Object.entries(COLORS).map(([key, c]) => (
                  <button
                    key={key}
                    type="button"
                    title={c.name}
                    aria-label={c.name}
                    aria-pressed={form.colors.includes(key)}
                    className={`${s.colorPick} ${form.colors.includes(key) ? s.colorPickOn : ''}`}
                    onClick={() => toggle('colors', key)}
                  >
                    <span style={{ background: c.hex }} />
                  </button>
                ))}
              </div>
            </div>
            <div className={s.field}>
              <span className={s.label}>ზომები</span>
              {oneSize ? (
                <span className={s.hint}>ამ კატეგორიას ერთი ზომა აქვს</span>
              ) : (
                <div className={s.chipsPick}>
                  {SIZE_ORDER.map((z) => (
                    <button
                      key={z}
                      type="button"
                      aria-pressed={form.sizes.includes(z)}
                      className={`${s.chipPick} ${form.sizes.includes(z) ? s.chipPickOn : ''}`}
                      onClick={() => toggle('sizes', z)}
                    >
                      {z}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`${s.card} ${s.section}`}>
            <button type="button" className={s.switchLabel} style={{ border: 0, background: 'none', padding: 0, font: 'inherit' }} onClick={() => set('isActive', !form.isActive)}>
              <span className={`${s.switch} ${form.isActive ? s.switchOn : ''}`} /> ჩანს მაღაზიაში
            </button>
            <button type="button" className={s.switchLabel} style={{ border: 0, background: 'none', padding: 0, font: 'inherit' }} onClick={() => set('newArrival', !form.newArrival)}>
              <span className={`${s.switch} ${form.newArrival ? s.switchOn : ''}`} /> „ახალი“ ნიშანი
            </button>
          </div>
        </div>

        <div className={s.drawerFoot}>
          <button type="button" className={s.btnGhost} onClick={onClose}>გაუქმება</button>
          <button type="submit" className={s.btnPrimary} disabled={busy}>{busy ? 'ინახება…' : 'შენახვა'}</button>
        </div>
      </form>
    </>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState('');
  const [editing, setEditing] = useState(null); // product | 'new' | null

  useEffect(() => {
    api.get('/api/admin/products')
      .then((r) => setProducts(r.data))
      .catch((e) => setError(getErrorMessage(e, 'პროდუქტები ვერ ჩაიტვირთა')));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products || []).filter((p) => {
      if (category && p.category !== category) return false;
      if (visibility === 'on' && !p.isActive) return false;
      if (visibility === 'off' && p.isActive) return false;
      if (visibility === 'sale' && !(p.oldPrice > priceOf(p))) return false;
      return !q || p.name.toLowerCase().includes(q);
    });
  }, [products, query, category, visibility]);

  const replace = (p) => setProducts((list) => list.map((x) => (x.id === p.id ? p : x)));

  const toggleActive = async (p) => {
    replace({ ...p, isActive: !p.isActive });
    try {
      const { data } = await api.patch(`/api/products/${p.id}`, { isActive: !p.isActive });
      replace(data);
    } catch (e) {
      replace(p);
      setError(getErrorMessage(e, 'ვერ შეიცვალა'));
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`წავშალო „${p.name}“? ეს შეუქცევადია. (დამალვა „ჩანს მაღაზიაში“ გადამრთველითაც შეიძლება.)`)) return;
    try {
      await api.delete(`/api/products/${p.id}`);
      setProducts((list) => list.filter((x) => x.id !== p.id));
    } catch (e) {
      setError(getErrorMessage(e, 'წაშლა ვერ მოხერხდა'));
    }
  };

  const saved = (p, isNew) => {
    setProducts((list) => (isNew ? [p, ...list] : list.map((x) => (x.id === p.id ? p : x))));
    setEditing(null);
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>პროდუქტები</h1>
          <p className={s.sub}>{products ? `${products.filter((p) => p.isActive).length} ჩანს მაღაზიაში · სულ ${products.length}` : ' '}</p>
        </div>
        <button type="button" className={s.btnPrimary} onClick={() => setEditing('new')}>+ ახალი პროდუქტი</button>
      </div>

      <div className={s.toolbar}>
        <input className={s.search} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ძებნა სახელით…" />
        <select className={s.select} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">ყველა კატეგორია</option>
          {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <select className={s.select} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="">ყველა</option>
          <option value="on">ჩანს მაღაზიაში</option>
          <option value="off">დამალული</option>
          <option value="sale">ფასდაკლებით</option>
        </select>
      </div>

      {error && <div className={s.error}>{error}</div>}
      {!products && !error && <div className={s.loading}>იტვირთება…</div>}
      {products && shown.length === 0 && <div className={s.empty}>პროდუქტები ვერ მოიძებნა.</div>}

      {shown.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>პროდუქტი</th>
                <th>კატეგორია</th>
                <th className={s.right}>ფასი</th>
                <th>ფერები</th>
                <th>ზომები</th>
                <th>მაღაზიაში</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className={s.prodCell}>
                      <div className={s.thumb}>
                        {productImg(p) ? <img src={productImg(p)} alt="" /> : <ProductImage product={p} color={p.colors?.[0] || 'white'} />}
                      </div>
                      <div>
                        <div className={s.strong}>{p.name}</div>
                        <div className={s.muted} style={{ fontSize: 12 }}>
                          {[p.material, p.newArrival && 'ახალი'].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={s.nowrap}>{CATEGORY_LABELS[p.category] ?? p.category}</td>
                  <td className={`${s.num} ${s.right}`}>
                    <span className={s.strong}>{gel(priceOf(p))}</span>
                    {p.oldPrice > priceOf(p) && <span className={s.old}>{gel(p.oldPrice)}</span>}
                  </td>
                  <td>
                    <div className={s.dots}>
                      {(p.colors || []).map((c) => <span key={c} className={s.dot} title={COLORS[c]?.name} style={{ background: COLORS[c]?.hex || c }} />)}
                    </div>
                  </td>
                  <td className={s.nowrap}>{p.sizes?.length ? `${p.sizes[0]}–${p.sizes[p.sizes.length - 1]}` : 'ერთი ზომა'}</td>
                  <td>
                    <button type="button" className={`${s.switch} ${p.isActive ? s.switchOn : ''}`} onClick={() => toggleActive(p)} aria-pressed={p.isActive} aria-label="ჩანს მაღაზიაში" />
                  </td>
                  <td className={s.nowrap}>
                    <button type="button" className={`${s.btnGhost} ${s.btnSm}`} onClick={() => setEditing(p)}>რედაქტირება</button>{' '}
                    <button type="button" className={s.iconBtn} onClick={() => remove(p)} aria-label="წაშლა" title="წაშლა">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ProductForm
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
