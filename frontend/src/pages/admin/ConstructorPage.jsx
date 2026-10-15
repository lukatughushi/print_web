import { useEffect, useState } from 'react';
import api from '../../lib/api';
import {
  BUILTIN_COLOR_KEYS,
  COLORS,
  KIDS_SIZES,
  kidsSizesFor,
  priceOf,
  registerColors,
  SIZE_ORDER,
  unregisterColor,
} from '../../lib/catalog';
import { gel, getErrorMessage } from './adminShared';
import s from './Admin.module.css';

// Constructor tabs that order a real product, in the constructor's order.
const TABS = [
  ['TSHIRT', 'მაისური'],
  ['POLO', 'პოლო'],
  ['LONGSLEEVE', 'გრძელმკლავიანი მაისური'],
  ['POLO_LONGSLEEVE', 'გრძელმკლავიანი პოლო'],
  ['HOODIE', 'ჰუდი ჯიბით'],
  ['ZIP_HOODIE', 'ჰუდი ელვით'],
  ['BAG', 'ჩანთა'],
  ['CAP', 'კეპი'],
  ['MUG', 'ჭიქა'],
];
const ONE_SIZE = new Set(['BAG', 'CAP', 'MUG']);
const HEX_RE = /^#?[0-9a-f]{6}$/i;

const formOf = (p) => ({
  price: String(priceOf(p) || ''),
  colors: p.colors || [],
  sizes: p.sizes || [],
  kidsSizes: kidsSizesFor(p),
  inStock: p.inStock !== false,
});

const unique = (list) => [...new Set(list)];

/** A colour as a button-like chip; × removes it. */
function ColorChip({ colorKey, onRemove, busy }) {
  const c = COLORS[colorKey];
  if (!c) return null;
  return (
    <span className={s.colorChip}>
      <span className={s.colorChipDot} style={{ background: c.hex }} />
      {c.name}
      {onRemove && (
        <button type="button" className={s.colorChipX} onClick={onRemove} disabled={busy} aria-label={`წაშლა: ${c.name}`} title="წაშლა">
          ×
        </button>
      )}
    </span>
  );
}

/** Colour picker plus a hex code field, kept in sync, and a name. */
function NewColorRow({ onAdd, busy, cta = 'დამატება' }) {
  const [hex, setHex] = useState('#3366cc');
  const [code, setCode] = useState('#3366cc');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const typeCode = (value) => {
    setCode(value);
    setError('');
    if (HEX_RE.test(value)) setHex(`#${value.replace('#', '').toLowerCase()}`);
  };
  const pick = (value) => {
    setHex(value);
    setCode(value);
    setError('');
  };
  const submit = async () => {
    if (!HEX_RE.test(code)) return setError('კოდი ასე უნდა იყოს: #RRGGBB, მაგ. #FF6699');
    if (!name.trim()) return setError('ჩაწერე ფერის სახელი');
    const ok = await onAdd({ hex, name: name.trim() });
    if (ok) setName('');
  };

  return (
    <div className={s.field}>
      <div className={s.chipsPick} style={{ alignItems: 'center' }}>
        <input type="color" value={hex} onChange={(e) => pick(e.target.value)} aria-label="ფერის არჩევა" className={s.colorInput} />
        <input
          className={s.input}
          style={{ maxWidth: 120, fontFamily: 'monospace' }}
          value={code}
          maxLength={7}
          onChange={(e) => typeCode(e.target.value)}
          aria-label="ფერის კოდი"
          placeholder="#RRGGBB"
        />
        <input
          className={s.input}
          style={{ maxWidth: 200 }}
          value={name}
          maxLength={40}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder="სახელი, მაგ. ვარდისფერი"
        />
        <button type="button" className={`${s.btnGhost} ${s.btnSm}`} onClick={submit} disabled={busy}>{cta}</button>
      </div>
      {error && <span className={s.hint} style={{ color: '#B3263C' }}>{error}</span>}
    </div>
  );
}

/** Size chips that toggle, plus a field to add a size of your own. */
function SizePicker({ options, value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const toggle = (z) => onChange(value.includes(z) ? value.filter((v) => v !== z) : [...value, z]);
  const add = () => {
    const z = draft.trim();
    if (z && !value.includes(z)) onChange([...value, z]);
    setDraft('');
  };
  return (
    <>
      <div className={s.chipsPick}>
        {unique([...options, ...value]).map((z) => (
          <button
            key={z}
            type="button"
            aria-pressed={value.includes(z)}
            className={`${s.chipPick} ${value.includes(z) ? s.chipPickOn : ''}`}
            onClick={() => toggle(z)}
          >
            {z}
          </button>
        ))}
      </div>
      <div className={s.chipsPick}>
        <input
          className={s.input}
          style={{ maxWidth: 200 }}
          value={draft}
          maxLength={20}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <button type="button" className={`${s.btnGhost} ${s.btnSm}`} onClick={add} disabled={!draft.trim()}>დამატება</button>
      </div>
    </>
  );
}

/** One constructor tab's product (the newest active product of its
 *  category, as the constructor picks it), folded by default. */
function TabCard({ label, product, onSaved, addPaletteColor }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => (product ? formOf(product) : null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (!product) {
    return (
      <div className={s.card}>
        <div className={s.foldHead}>
          <span className={s.foldTitle}>{label}</span>
          <span className={s.hint}>აქტიური პროდუქტი არ არის — დაამატე „პროდუქტების“ გვერდზე</span>
        </div>
      </div>
    );
  }

  const category = product.category;
  const oneSize = ONE_SIZE.has(category);
  const change = (patch) => {
    setNotice('');
    setForm((f) => ({ ...f, ...patch }));
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(formOf(product));
  const freeColors = Object.keys(COLORS).filter((k) => !form.colors.includes(k));

  const addNewColor = async (color) => {
    const key = await addPaletteColor(color);
    if (key) setForm((f) => (f.colors.includes(key) ? f : { ...f, colors: [...f.colors, key] }));
    return Boolean(key);
  };

  const save = async () => {
    const price = Number(form.price);
    if (form.price === '' || !(price >= 0)) return setError('ჩაწერე სწორი ფასი');
    setBusy(true);
    setError('');
    try {
      const { data } = await api.patch(`/api/products/${product.id}`, {
        price,
        inStock: form.inStock,
        colors: form.colors.filter((c) => COLORS[c]),
        sizes: oneSize ? [] : [...SIZE_ORDER.filter((z) => form.sizes.includes(z)), ...form.sizes.filter((z) => !SIZE_ORDER.includes(z))],
        kidsSizes: oneSize ? [] : [...KIDS_SIZES.filter((z) => form.kidsSizes.includes(z)), ...form.kidsSizes.filter((z) => !KIDS_SIZES.includes(z))],
      });
      onSaved(data);
      setForm(formOf(data));
      setNotice('შენახულია — კონსტრუქტორში მაშინვე ჩანს.');
    } catch (err) {
      setError(getErrorMessage(err, 'შენახვა ვერ მოხერხდა'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.card}>
      <button type="button" className={s.foldHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={s.foldTitle}>{label}</span>
        <span className={s.foldMeta}>
          {gel(priceOf(product))}
          {product.inStock === false && <span className={s.foldOut}>მარაგში არ არის</span>}
          {dirty && <span className={s.foldDirty}>შეუნახავი</span>}
        </span>
        <span className={`${s.foldChevron} ${open ? s.foldChevronOpen : ''}`} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className={`${s.section} ${s.foldBody}`}>
          {error && <div className={s.error}>{error}</div>}
          {notice && <div className={s.success}>{notice}</div>}

          <button
            type="button"
            className={s.switchLabel}
            style={{ border: 0, background: 'none', padding: 0, font: 'inherit', alignSelf: 'flex-start' }}
            onClick={() => change({ inStock: !form.inStock })}
            aria-pressed={form.inStock}
          >
            <span className={`${s.switch} ${form.inStock ? s.switchOn : ''}`} />
            {form.inStock ? 'მარაგშია' : 'მარაგში არ არის — შეკვეთა გათიშულია'}
          </button>

          <div className={s.field} style={{ maxWidth: 220 }}>
            <label className={s.label} htmlFor={`c-price-${category}`}>ფასი (₾)</label>
            <input
              id={`c-price-${category}`}
              className={s.input}
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => change({ price: e.target.value })}
            />
          </div>

          <div className={s.field}>
            <span className={s.label}>ფერები</span>
            <div className={s.chipsPick}>
              {form.colors.filter((k) => COLORS[k]).map((k) => (
                <ColorChip key={k} colorKey={k} onRemove={() => change({ colors: form.colors.filter((c) => c !== k) })} />
              ))}
              {form.colors.filter((k) => COLORS[k]).length === 0 && (
                <span className={s.hint}>ფერი არ არის — კონსტრუქტორი სტანდარტულ ფერებს აჩვენებს.</span>
              )}
            </div>
            {freeColors.length > 0 && (
              <select
                className={s.input}
                style={{ maxWidth: 260 }}
                value=""
                onChange={(e) => e.target.value && change({ colors: [...form.colors, e.target.value] })}
                aria-label="პალიტრიდან ფერის დამატება"
              >
                <option value="">+ ფერი პალიტრიდან…</option>
                {freeColors.map((k) => <option key={k} value={k}>{COLORS[k].name}</option>)}
              </select>
            )}
            <span className={s.hint}>ან შექმენი ახალი ფერი — ამრჩევით ან კოდით:</span>
            <NewColorRow onAdd={addNewColor} busy={busy} />
          </div>

          {oneSize ? (
            <div className={s.field}>
              <span className={s.label}>ზომები</span>
              <span className={s.hint}>ამ პროდუქტს ერთი ზომა აქვს</span>
            </div>
          ) : (
            <>
              <div className={s.field}>
                <span className={s.label}>ზომები</span>
                <SizePicker options={SIZE_ORDER} value={form.sizes} onChange={(sizes) => change({ sizes })} placeholder="ახალი ზომა, მაგ. 4XL" />
              </div>
              <div className={s.field}>
                <span className={s.label}>ბავშვის ზომები</span>
                <SizePicker options={KIDS_SIZES} value={form.kidsSizes} onChange={(kidsSizes) => change({ kidsSizes })} placeholder="მაგ. 3XL (16 წ.)" />
                {form.kidsSizes.length === 0 && <span className={s.hint}>არცერთი არ არის მონიშნული — კონსტრუქტორში ბავშვის ზომები არ ჩანს.</span>}
              </div>
            </>
          )}

          <div className={s.formFoot}>
            <button type="button" className={s.btnGhost} onClick={() => { setForm(formOf(product)); setError(''); }} disabled={busy || !dirty}>გაუქმება</button>
            <button type="button" className={s.btnPrimary} onClick={save} disabled={busy || !dirty}>{busy ? 'ინახება…' : 'შენახვა'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConstructorPage() {
  const [products, setProducts] = useState(null);
  const [customColors, setCustomColors] = useState([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/api/products'), api.get('/api/settings')])
      .then(([p, st]) => {
        const colors = st.data?.customColors || [];
        registerColors(colors);
        setCustomColors(colors);
        setProducts(Array.isArray(p.data) ? p.data : []);
      })
      .catch((e) => setError(getErrorMessage(e, 'მონაცემები ვერ ჩაიტვირთა')));
  }, []);

  if (error && !products) return <div className={s.error}>{error}</div>;
  if (!products) return <div className={s.loading}>იტვირთება…</div>;

  const savePalette = async (next) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.patch('/api/settings', { customColors: next });
      const list = data.customColors || [];
      registerColors(list);
      setCustomColors(list);
      return true;
    } catch (err) {
      setError(getErrorMessage(err, 'ფერი ვერ შეინახა'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Adds a colour to the palette (or finds the same shade already there);
  // resolves to its key, or null on failure.
  const addPaletteColor = async ({ hex, name }) => {
    const existing = Object.keys(COLORS).find((k) => COLORS[k].hex.toLowerCase() === hex.toLowerCase());
    if (existing) return existing;
    const key = `c-${hex.slice(1).toLowerCase()}`;
    return (await savePalette([...customColors, { key, name, hex: hex.toLowerCase() }])) ? key : null;
  };

  const removePaletteColor = async (key) => {
    if (await savePalette(customColors.filter((c) => c.key !== key))) unregisterColor(key);
  };

  const onSaved = (updated) => setProducts((list) => list.map((p) => (p.id === updated.id ? updated : p)));

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>კონსტრუქტორი</h1>
          <p className={s.sub}>მარაგი, ფასები, ფერები და ზომები — რასაც მყიდველი კონსტრუქტორში ხედავს</p>
        </div>
      </div>

      {error && <div className={s.error}>{error}</div>}

      <div className={s.card}>
        <button type="button" className={s.foldHead} onClick={() => setPaletteOpen((v) => !v)} aria-expanded={paletteOpen}>
          <span className={s.foldTitle}>ფერების პალიტრა</span>
          <span className={s.foldMeta}>{Object.keys(COLORS).length} ფერი</span>
          <span className={`${s.foldChevron} ${paletteOpen ? s.foldChevronOpen : ''}`} aria-hidden="true">▾</span>
        </button>
        {paletteOpen && (
          <div className={`${s.section} ${s.foldBody}`}>
            <span className={s.hint}>
              ყველა ფერი, რომლის მონიშვნაც პროდუქტზე შეიძლება. შენ მიერ დამატებულს × შლის; ჩაშენებულ ფერებს ვერ წაშლი, მაგრამ პროდუქტზე შეგიძლია არ მონიშნო.
            </span>
            <div className={s.chipsPick}>
              {Object.keys(COLORS).map((k) => (
                <ColorChip key={k} colorKey={k} busy={busy} onRemove={BUILTIN_COLOR_KEYS.includes(k) ? null : () => removePaletteColor(k)} />
              ))}
            </div>
            <NewColorRow onAdd={async (c) => Boolean(await addPaletteColor(c))} busy={busy} cta="ფერის დამატება" />
          </div>
        )}
      </div>

      {TABS.map(([category, label]) => (
        <TabCard
          key={category}
          label={label}
          product={products.find((p) => p.category === category)}
          onSaved={onSaved}
          addPaletteColor={addPaletteColor}
        />
      ))}
    </div>
  );
}
