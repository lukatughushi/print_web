import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import {
  CATEGORIES,
  CATEGORY_BY_CODE,
  COLORS,
  SIZE_ORDER,
  isOnSale,
  priceOf,
} from '../lib/catalog';
import ProductCard, { ProductImage } from '../components/ProductCard';
import SiteFooter from '../components/SiteFooter';
import useFavStore from '../store/favStore';
import corpImg from '../assets/prenta/main_hoode.webp';
import s from './ShopPage.module.css';

// Layout follows src/acrhi/Prenta Shop.dc.html.

const PAGE_SIZE = 20;

// Accessories have no sizes; they filter as "ერთი ზომა".
const ONE_SIZE = 'ONE';
const sizesOf = (p) => (p.sizes?.length ? p.sizes : [ONE_SIZE]);
const sizeLabel = (z) => (z === ONE_SIZE ? 'ერთი ზომა' : z);

const SORTS = [
  { key: 'pop', label: 'პოპულარული' },
  { key: 'new', label: 'ახალი' },
  { key: 'asc', label: 'ფასი ↑' },
  { key: 'desc', label: 'ფასი ↓' },
];

/* ── URL ⇄ filter state ─────────────────────────────────── */

function readFilters(params) {
  const list = (k) => (params.get(k) || '').split(',').filter(Boolean);
  return {
    cat: list('cat'),
    color: list('color'),
    size: list('size'),
    max: params.get('max') ? Number(params.get('max')) : null,
    sale: params.get('sale') === '1',
    fresh: params.get('new') === '1',
    fav: params.get('fav') === '1',
    q: params.get('q') || '',
    sort: params.get('sort') || 'pop',
    page: Math.max(1, Number(params.get('page')) || 1),
  };
}

// Does product `p` pass every filter except the facet named in `skip`?
function matches(p, f, favIds, skip) {
  if (skip !== 'cat' && f.cat.length && !f.cat.includes(p.category)) return false;
  if (skip !== 'color' && f.color.length && !(p.colors || []).some((c) => f.color.includes(c))) return false;
  if (skip !== 'size' && f.size.length && !sizesOf(p).some((z) => f.size.includes(z))) return false;
  if (f.max !== null && priceOf(p) > f.max) return false;
  if (f.sale && !isOnSale(p)) return false;
  if (f.fresh && !p.newArrival) return false;
  if (f.fav && !favIds.includes(p.id)) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const cat = CATEGORY_BY_CODE[p.category];
    const hay = `${p.name} ${cat?.label || ''} ${cat?.en || ''} ${p.material || ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

// "Popular" order: alternate categories so each page shows a bit of everything.
function interleave(list) {
  const byCat = new Map();
  list.forEach((p) => {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category).push(p);
  });
  const queues = CATEGORIES.map((c) => byCat.get(c.code) || []);
  byCat.forEach((items, code) => { if (!CATEGORY_BY_CODE[code]) queues.push(items); });
  const out = [];
  for (let i = 0; out.length < list.length; i++) {
    queues.forEach((q) => { if (q[i]) out.push(q[i]); });
  }
  return out;
}

function sortProducts(list, sort) {
  const arr = [...list];
  switch (sort) {
    case 'new':
      return arr.sort((a, b) => Number(!!b.newArrival) - Number(!!a.newArrival));
    case 'asc':
      return arr.sort((a, b) => priceOf(a) - priceOf(b));
    case 'desc':
      return arr.sort((a, b) => priceOf(b) - priceOf(a));
    default:
      return interleave(arr);
  }
}

// Page numbers with gaps: 1 … 4 5 6 … 10
function pageList(page, total) {
  const set = new Set([1, total, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push(`gap-${n}`);
    out.push(n);
  });
  return out;
}

/* ── Small pieces ───────────────────────────────────────── */

function Toggle({ on, label, onChange }) {
  return (
    <button type="button" className={s.toggle} onClick={onChange} aria-pressed={on}>
      <span className={`${s.track} ${on ? s.trackOn : ''}`}><span className={s.knob} /></span>
      <span>{label}</span>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8F9C" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/* ── Page ───────────────────────────────────────────────── */

export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const favIds = useFavStore((st) => st.ids);
  const [products, setProducts] = useState(null); // null = loading
  const [settings, setSettings] = useState({ currency: '₾' });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    api.get('/api/products').then((r) => setProducts(Array.isArray(r.data) ? r.data : [])).catch(() => setProducts([]));
    api.get('/api/settings').then((r) => r.data && setSettings((v) => ({ ...v, ...r.data }))).catch(() => {});
  }, []);

  // /shop#corporate (header link) scrolls to the corporate block.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash, products]);

  // Lock page scroll behind the mobile filter drawer.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  const f = useMemo(() => readFilters(params), [params]);
  const all = useMemo(() => products || [], [products]);

  // Any filter change goes back to page 1.
  const update = (changes, keepPage = false) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => {
      const value = Array.isArray(v) ? v.join(',') : v === true ? '1' : v === false || v === null ? '' : String(v);
      if (value === '') next.delete(k);
      else next.set(k, value);
    });
    if (!keepPage) next.delete('page');
    setParams(next, { replace: true });
  };

  const toggle = (key, value) => {
    const cur = f[key];
    update({ [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] });
  };

  const clearAll = () => setParams(new URLSearchParams(f.sort !== 'pop' ? { sort: f.sort } : {}), { replace: true });

  const goPage = (n) => {
    update({ page: n > 1 ? n : '' }, true);
    const el = document.getElementById('shop');
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
  };

  // Price slider bounds from the catalogue (rounded to 10 ₾).
  const [priceMin, priceMax] = useMemo(() => {
    const prices = all.map(priceOf).filter((n) => n > 0);
    if (!prices.length) return [0, 200];
    return [Math.floor(Math.min(...prices) / 10) * 10, Math.ceil(Math.max(...prices) / 10) * 10];
  }, [all]);
  const maxPrice = f.max !== null ? Math.min(f.max, priceMax) : priceMax;

  const catCounts = useMemo(() => {
    const map = {};
    all.forEach((p) => { if (matches(p, f, favIds, 'cat')) map[p.category] = (map[p.category] || 0) + 1; });
    return map;
  }, [all, f, favIds]);

  const availableSizes = useMemo(() => {
    const set = new Set(all.flatMap(sizesOf));
    return [...SIZE_ORDER.filter((z) => set.has(z)), ...[...set].filter((z) => !SIZE_ORDER.includes(z) && z !== ONE_SIZE), ...(set.has(ONE_SIZE) ? [ONE_SIZE] : [])];
  }, [all]);

  const availableColors = useMemo(() => {
    const set = new Set(all.flatMap((p) => p.colors || []));
    return Object.keys(COLORS).filter((c) => set.has(c));
  }, [all]);

  const results = useMemo(() => sortProducts(all.filter((p) => matches(p, f, favIds)), f.sort), [all, f, favIds]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(f.page, pageCount);
  const pageItems = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Active filter chips.
  const chips = [
    ...f.cat.map((v) => ({ key: `cat-${v}`, label: CATEGORY_BY_CODE[v]?.label || v, clear: () => toggle('cat', v) })),
    ...f.color.map((v) => ({ key: `color-${v}`, label: COLORS[v]?.name || v, clear: () => toggle('color', v) })),
    ...f.size.map((v) => ({ key: `size-${v}`, label: sizeLabel(v), clear: () => toggle('size', v) })),
    ...(f.max !== null && f.max < priceMax ? [{ key: 'max', label: `≤ ${f.max} ₾`, clear: () => update({ max: null }) }] : []),
    ...(f.sale ? [{ key: 'sale', label: 'ფასდაკლებით', clear: () => update({ sale: false }) }] : []),
    ...(f.fresh ? [{ key: 'new', label: 'მხოლოდ ახალი', clear: () => update({ new: false }) }] : []),
    ...(f.fav ? [{ key: 'fav', label: 'რჩეულები', clear: () => update({ fav: false }) }] : []),
    ...(f.q ? [{ key: 'q', label: `„${f.q}“`, clear: () => update({ q: '' }) }] : []),
  ];

  const singleCat = f.cat.length === 1 ? CATEGORY_BY_CODE[f.cat[0]] : null;
  const title = f.fav ? 'რჩეულები' : singleCat ? singleCat.label : 'ყველა პროდუქტი';
  const startDesign = () => {
    const first = all.find((p) => p.category === 'TSHIRT') || all[0];
    navigate(first ? `/design/${first.id}` : '/');
  };

  return (
    <div className={s.page}>

      {/* ── Shop ─────────────────────────────────────────── */}
      <main id="shop" className={s.shop}>
        <div className={s.head}>
          <div>
            <nav className={s.crumbs} aria-label="breadcrumb">
              <Link to="/">მთავარი</Link><span>/</span><span className={s.crumbCur}>მაღაზია</span>
            </nav>
            <h2 className={s.h2}>{title}</h2>
          </div>
          {products && <span className={s.total}>{results.length} პროდუქტი</span>}
        </div>

        <div className={s.catStrip}>
          <button
            type="button"
            className={`${s.catTile} ${f.cat.length === 0 ? s.catTileOn : ''}`}
            onClick={() => update({ cat: [] })}
          >
            <span className={s.catImg}><span className={s.catAll}>ALL</span></span>
            <span className={s.catLabel}>ყველა</span>
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.code}
              type="button"
              className={`${s.catTile} ${singleCat?.code === c.code ? s.catTileOn : ''}`}
              onClick={() => update({ cat: [c.code] })}
            >
              <span className={s.catImg}>
                <ProductImage product={{ category: c.code, name: c.label }} color={c.swatch} className={s.catPic} />
              </span>
              <span className={s.catLabel}>{c.label}</span>
            </button>
          ))}
        </div>

        <div className={s.layout}>
          {drawerOpen && <div className={s.backdrop} onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

          <aside className={`${s.aside} ${drawerOpen ? s.asideOpen : ''}`} aria-label="ფილტრები">
            <div className={s.asideHead}>
              <span className={s.asideTitle}>ფილტრები</span>
              <div className={s.asideActions}>
                {chips.length > 0 && <button type="button" className={s.clearBtn} onClick={clearAll}>გასუფთავება</button>}
                <button type="button" className={s.closeBtn} onClick={() => setDrawerOpen(false)} aria-label="დახურვა">×</button>
              </div>
            </div>

            <div className={s.group}>
              <div className={s.groupTitle}>კატეგორია</div>
              {CATEGORIES.map((c) => {
                const on = f.cat.includes(c.code);
                return (
                  <button key={c.code} type="button" className={s.checkRow} onClick={() => toggle('cat', c.code)} aria-pressed={on}>
                    <span className={`${s.box} ${on ? s.boxOn : ''}`}>{on ? '✓' : ''}</span>
                    <span className={s.checkLabel}>{c.label}</span>
                    <span className={s.count}>{catCounts[c.code] || 0}</span>
                  </button>
                );
              })}
            </div>

            <div className={s.group}>
              <div className={s.groupHead}>
                <span className={s.groupTitle}>ფასი</span>
                <span className={s.priceLabel}>{maxPrice >= priceMax ? 'ყველა' : `≤ ${maxPrice} ₾`}</span>
              </div>
              <input
                type="range"
                className={s.range}
                min={priceMin}
                max={priceMax}
                step={5}
                value={maxPrice}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  update({ max: v >= priceMax ? null : v });
                }}
                aria-label="მაქსიმალური ფასი"
              />
              <div className={s.rangeEnds}><span>{priceMin} ₾</span><span>{priceMax} ₾</span></div>
            </div>

            {availableColors.length > 0 && (
              <div className={s.group}>
                <div className={s.groupTitle}>ფერი</div>
                <div className={s.colors}>
                  {availableColors.map((c) => {
                    const on = f.color.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`${s.colorBtn} ${on ? s.colorBtnOn : ''}`}
                        onClick={() => toggle('color', c)}
                        title={COLORS[c].name}
                        aria-label={COLORS[c].name}
                        aria-pressed={on}
                      >
                        <span style={{ background: COLORS[c].hex }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {availableSizes.length > 0 && (
              <div className={s.group}>
                <div className={s.groupTitle}>ზომა</div>
                <div className={s.sizes}>
                  {availableSizes.map((z) => {
                    const on = f.size.includes(z);
                    return (
                      <button key={z} type="button" className={`${s.sizeBtn} ${on ? s.sizeBtnOn : ''}`} onClick={() => toggle('size', z)} aria-pressed={on}>
                        {sizeLabel(z)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={s.group}>
              <div className={s.groupTitle}>სხვა</div>
              <Toggle on={f.sale} label="ფასდაკლებით" onChange={() => update({ sale: !f.sale })} />
              <Toggle on={f.fresh} label="მხოლოდ ახალი" onChange={() => update({ new: !f.fresh })} />
              <Toggle on={f.fav} label={`რჩეულები (${favIds.length})`} onChange={() => update({ fav: !f.fav })} />
            </div>

            <button type="button" className={s.showBtn} onClick={() => setDrawerOpen(false)}>
              ნახე {results.length} პროდუქტი
            </button>
          </aside>

          <div className={s.content}>
            <div className={s.toolbar}>
              <label className={s.search}>
                <SearchIcon />
                <input
                  type="search"
                  value={f.q}
                  onChange={(e) => update({ q: e.target.value })}
                  placeholder="მოძებნე დიზაინი ან პროდუქტი…"
                  aria-label="ძიება"
                />
              </label>
              <button type="button" className={s.filterBtn} onClick={() => setDrawerOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
                ფილტრები
                {chips.length > 0 && <span className={s.filterCount}>{chips.length}</span>}
              </button>
              <label className={s.sortPill}>
                <span>დალაგება:</span>
                <select value={f.sort} onChange={(e) => update({ sort: e.target.value === 'pop' ? '' : e.target.value })}>
                  {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </label>
            </div>

            {chips.length > 0 && (
              <div className={s.chips}>
                {chips.map((c) => (
                  <button key={c.key} type="button" className={s.chip} onClick={c.clear}>
                    {c.label}<span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}

            {products === null && (
              <div className={s.grid}>
                {Array.from({ length: 8 }, (_, i) => <div key={i} className={s.skeleton} />)}
              </div>
            )}

            {products && results.length === 0 && (
              <div className={s.empty}>
                <div className={s.emptyTitle}>ვერაფერი მოიძებნა</div>
                <div className={s.emptyText}>სცადე ფილტრების შეცვლა</div>
                <button type="button" className={s.emptyBtn} onClick={clearAll}>ფილტრების გასუფთავება</button>
              </div>
            )}

            {pageItems.length > 0 && (
              <div className={s.grid}>
                {pageItems.map((p) => <ProductCard key={p.id} product={p} currency={settings.currency} />)}
              </div>
            )}

            {pageCount > 1 && (
              <nav className={s.pager} aria-label="გვერდები">
                <button type="button" className={s.pageArrow} onClick={() => goPage(page - 1)} disabled={page === 1} aria-label="წინა გვერდი">←</button>
                {pageList(page, pageCount).map((n) => (typeof n === 'string'
                  ? <span key={n} className={s.pageGap}>…</span>
                  : (
                    <button
                      key={n}
                      type="button"
                      className={`${s.pageBtn} ${n === page ? s.pageBtnOn : ''}`}
                      onClick={() => goPage(n)}
                      aria-current={n === page ? 'page' : undefined}
                    >
                      {n}
                    </button>
                  )))}
                <button type="button" className={s.pageArrow} onClick={() => goPage(page + 1)} disabled={page === pageCount} aria-label="შემდეგი გვერდი">→</button>
              </nav>
            )}
          </div>
        </div>
      </main>

      {/* ── Corporate ────────────────────────────────────── */}
      <section id="corporate" className={s.corpWrap}>
        <div className={s.corp}>
          <div className={s.corpBody}>
            <span className={s.eyebrow}>კორპორატიული შეკვეთები</span>
            <h3 className={s.corpTitle}>გუნდისთვის, ღონისძიებისთვის, ბრენდისთვის</h3>
            <p className={s.corpText}>10 ცალიდან — ფასდაკლება, ერთიანი დიზაინი და ზომების მიხედვით დაშლილი შეკვეთა.</p>
            <button type="button" className={s.ctaPrimary} onClick={startDesign}>გამოთვალე ფასი →</button>
          </div>
          <div className={s.corpArt}><img src={corpImg} alt="" /></div>
        </div>
      </section>

      <SiteFooter settings={settings} />
    </div>
  );
}
