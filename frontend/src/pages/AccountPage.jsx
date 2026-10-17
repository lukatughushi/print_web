import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import { API_URL } from '../lib/config';
import { CATEGORY_LABELS, starterProduct } from '../lib/catalog';
import { avatarColor, initialsOf } from '../lib/userBadge';
import { useAuth } from '../context/auth-context';
import useToast from '../store/toastStore';
import s from './AccountPage.module.css';
import { useI18n } from '../i18n/i18n-context';
import { productName } from '../i18n/products';

const STATUS_LABELS = {
  PENDING: 'მიღებულია',
  PRINTING: 'ბეჭდვაში',
  READY_FOR_PICKUP: 'მზადაა',
  SHIPPED: 'გზაშია',
  COMPLETED: 'ჩაბარებულია',
  CANCELLED: 'გაუქმებულია',
};
const STATUS_STEPS = ['PENDING', 'PRINTING', 'SHIPPED', 'COMPLETED'];

const TABS = [
  { id: 'profile', label: 'პროფილი' },
  { id: 'orders', label: 'შეკვეთები' },
  { id: 'designs', label: 'დიზაინები' },
  { id: 'media', label: 'სურათები' },
  { id: 'security', label: 'პაროლი' },
];

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_MB = 10;

const fileUrl = (path) => (path ? `${API_URL}${path}` : '');
const fileById = (id) => (id ? `${API_URL}/api/files/${id}` : '');
const date = (d, locale = 'ka-GE') => (d ? new Date(d).toLocaleDateString(locale) : '');

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

/* ── Profile ────────────────────────────────────────────── */

function ProfileTab({ user, counts, onSaved }) {
  const { t, locale } = useI18n();
  const [form, setForm] = useState({
    name: user.name || '', phone: user.phone || '', city: user.city || '', address: user.address || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast((st) => st.show);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dirty = ['name', 'phone', 'city', 'address'].some((k) => form[k] !== (user[k] || ''));

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) { setError(t('სახელი ძალიან მოკლეა')); return; }
    setBusy(true);
    setError('');
    try {
      await api.patch('/api/me/profile', form);
      await onSaved();
      toast(t('პროფილი შენახულია'));
    } catch (err) {
      setError(getErrorMessage(err, t('შენახვა ვერ მოხერხდა')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.stack}>
      <div className={s.stats}>
        <Link to="?tab=orders" className={s.stat}><b>{counts.orders ?? '–'}</b><span>{t('შეკვეთა')}</span></Link>
        <Link to="?tab=designs" className={s.stat}><b>{counts.designs ?? '–'}</b><span>{t('შენახული დიზაინი')}</span></Link>
        <Link to="?tab=media" className={s.stat}><b>{counts.media ?? '–'}</b><span>{t('სურათი')}</span></Link>
      </div>

      <form className={s.card} onSubmit={submit}>
        <div className={s.cardHead}>
          <h2 className={s.h2}>{t('პირადი მონაცემები')}</h2>
          <p className={s.muted}>{t('ტელეფონი და მისამართი შეკვეთისას ავტომატურად შეივსება.')}</p>
        </div>
        <div className={s.grid2}>
          <label className={s.field}>
            <span className={s.label}>{t('სახელი და გვარი')}</span>
            <input className={s.input} value={form.name} onChange={set('name')} autoComplete="name" />
          </label>
          <label className={s.field}>
            <span className={s.label}>{t('ელ-ფოსტა')}</span>
            <input className={s.input} value={user.email} disabled />
          </label>
          <label className={s.field}>
            <span className={s.label}>{t('ტელეფონი')}</span>
            <input className={s.input} value={form.phone} onChange={set('phone')} placeholder="+995 5xx xx xx xx" autoComplete="tel" />
          </label>
          <label className={s.field}>
            <span className={s.label}>{t('ქალაქი')}</span>
            <input className={s.input} value={form.city} onChange={set('city')} placeholder={t('თბილისი')} autoComplete="address-level2" />
          </label>
          <label className={`${s.field} ${s.span2}`}>
            <span className={s.label}>{t('მისამართი')}</span>
            <input className={s.input} value={form.address} onChange={set('address')} placeholder={t('ქუჩა, სახლი, ბინა')} autoComplete="street-address" />
          </label>
        </div>
        {error && <div className={s.error}>{error}</div>}
        <div className={s.actions}>
          <button type="submit" className={s.btnPrimary} disabled={busy || !dirty}>{busy ? t('ინახება…') : t('შენახვა')}</button>
          {user.createdAt && <span className={s.muted}>{t('რეგისტრაცია:')} {date(user.createdAt, locale)}</span>}
        </div>
      </form>
    </div>
  );
}

/* ── Orders ─────────────────────────────────────────────── */

function OrdersTab({ orders }) {
  const { t, locale, lang } = useI18n();
  const [open, setOpen] = useState(null);
  if (orders === null) return <div className={s.loading}>{t('იტვირთება…')}</div>;
  if (!orders.length) {
    return (
      <div className={s.empty}>
        <p>{t('შეკვეთები ჯერ არ გაქვს.')}</p>
        <Link to="/shop" className={s.btnPrimary}>{t('მაღაზიაში გადასვლა')}</Link>
      </div>
    );
  }
  return (
    <div className={s.stack}>
      {orders.map((o) => {
        const isOpen = open === o.id;
        const stepIndex = STATUS_STEPS.indexOf(o.status === 'READY_FOR_PICKUP' ? 'SHIPPED' : o.status);
        return (
          <div key={o.id} className={`${s.card} ${s.order}`}>
            <button type="button" className={s.orderRow} onClick={() => setOpen(isOpen ? null : o.id)} aria-expanded={isOpen}>
              <span className={s.orderThumbs}>
                {o.items.slice(0, 3).map((it, i) => (
                  it.design?.previewFile
                    ? <img key={i} src={fileById(it.design.previewFile)} alt="" loading="lazy" />
                    : <span key={i} className={s.thumbStub}>{t(CATEGORY_LABELS[it.category] || it.name || '?').slice(0, 1)}</span>
                ))}
              </span>
              <span className={s.orderMain}>
                <span className={s.orderNo}>{o.number}</span>
                <span className={s.muted}>{date(o.createdAt, locale)} · {o.items.reduce((n, it) => n + it.quantity, 0)} {t('ცალი')}</span>
              </span>
              <span className={`${s.status} ${o.status === 'CANCELLED' ? s.statusOff : ''}`}>{STATUS_LABELS[o.status] ? t(STATUS_LABELS[o.status]) : o.status}</span>
              <span className={s.orderTotal}>{Math.round(o.total)} ₾</span>
              <span className={`${s.chev} ${isOpen ? s.chevOpen : ''}`} aria-hidden="true">⌄</span>
            </button>
            {isOpen && (
              <div className={s.orderBody}>
                {o.status !== 'CANCELLED' && (
                  <ol className={s.steps}>
                    {STATUS_STEPS.map((st, i) => (
                      <li key={st} className={i <= stepIndex ? s.stepOn : ''}>{t(STATUS_LABELS[st])}</li>
                    ))}
                  </ol>
                )}
                <ul className={s.items}>
                  {o.items.map((it, i) => (
                    <li key={i} className={s.item}>
                      {it.design?.previewFile
                        ? <img src={fileById(it.design.previewFile)} alt="" loading="lazy" className={s.itemImg} />
                        : <span className={`${s.itemImg} ${s.thumbStub}`}>{t(CATEGORY_LABELS[it.category] || it.name || '?').slice(0, 1)}</span>}
                      <span className={s.itemMain}>
                        <span className={s.itemName}>{productName(it.name, lang)}</span>
                        <span className={s.muted}>
                          {[it.size && `${t('ზომა')} ${it.size}`, it.design ? t('შენი დიზაინით') : ''].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className={s.muted}>× {it.quantity}</span>
                      <span className={s.itemPrice}>{Math.round(it.lineTotal)} ₾</span>
                    </li>
                  ))}
                </ul>
                <div className={s.orderFoot}>
                  <span>{o.address}</span>
                  <span>{t('მიწოდება:')} {o.shipping ? `${Math.round(o.shipping)} ₾` : t('უფასო')}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Saved designs ──────────────────────────────────────── */

function DesignsTab({ designs, setDesigns, products }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast((st) => st.show);
  const [renaming, setRenaming] = useState(null); // { id, name }
  const [error, setError] = useState('');

  if (designs === null) return <div className={s.loading}>{t('იტვირთება…')}</div>;

  const firstProductId = starterProduct(products)?.id;
  const openDesign = (d) => {
    const product = products.find((p) => p.id === d.productId)
      ?? products.find((p) => p.category === d.category);
    const id = product?.id ?? firstProductId ?? 'start';
    navigate(`/design/${id}?design=${d.id}`);
  };

  const rename = async (e) => {
    e.preventDefault();
    if (!renaming?.name.trim()) return;
    try {
      const { data } = await api.patch(`/api/me/designs/${renaming.id}`, { name: renaming.name });
      setDesigns((list) => list.map((d) => (d.id === data.id ? { ...d, ...data } : d)));
      setRenaming(null);
    } catch (err) {
      setError(getErrorMessage(err, t('სახელი ვერ შეიცვალა')));
    }
  };

  const remove = async (d) => {
    if (!window.confirm(t('წავშალო „{name}“?', { name: d.name }))) return;
    try {
      await api.delete(`/api/me/designs/${d.id}`);
      setDesigns((list) => list.filter((x) => x.id !== d.id));
      toast(t('დიზაინი წაიშალა'));
    } catch (err) {
      setError(getErrorMessage(err, t('წაშლა ვერ მოხერხდა')));
    }
  };

  return (
    <div className={s.stack}>
      <div className={s.tabHead}>
        <p className={s.muted}>{t('კონსტრუქტორში „შენახვა“ დააჭირე — დიზაინი აქ გამოჩნდება და შემდეგ შეკვეთაში შაბლონად გამოიყენებ.')}</p>
        {<Link to={`/design/${firstProductId ?? 'start'}`} className={s.btnPrimary}>{t('ახალი დიზაინი +')}</Link>}
      </div>
      {error && <div className={s.error}>{error}</div>}
      {!designs.length ? (
        <div className={s.empty}><p>{t('შენახული დიზაინები ჯერ არ გაქვს.')}</p></div>
      ) : (
        <div className={s.cards}>
          {designs.map((d) => (
            <div key={d.id} className={s.designCard}>
              <button type="button" className={s.designPreview} onClick={() => openDesign(d)} title={t('კონსტრუქტორში გახსნა')}>
                {d.previewUrl ? <img src={fileUrl(d.previewUrl)} alt={d.name} loading="lazy" /> : <span className={s.thumbStub}>✎</span>}
              </button>
              <div className={s.designBody}>
                {renaming?.id === d.id ? (
                  <form onSubmit={rename} className={s.renameForm}>
                    <input
                      className={s.input}
                      value={renaming.name}
                      onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                      maxLength={80}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)}
                    />
                    <button type="submit" className={s.btnSmall}>OK</button>
                  </form>
                ) : (
                  <span className={s.designName}>{d.name}</span>
                )}
                <span className={s.muted}>{t(CATEGORY_LABELS[d.category] || 'პროდუქტი')} · {date(d.updatedAt, locale)}</span>
                <div className={s.designActions}>
                  <button type="button" className={s.btnSmallPrimary} onClick={() => openDesign(d)}>{t('გახსნა')}</button>
                  <button type="button" className={s.btnSmall} onClick={() => setRenaming({ id: d.id, name: d.name })}>{t('სახელი')}</button>
                  <button type="button" className={s.iconDel} onClick={() => remove(d)} aria-label={t('წაშლა')} title={t('წაშლა')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Image library ──────────────────────────────────────── */

function MediaTab({ media, setMedia }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast((st) => st.show);

  if (media === null) return <div className={s.loading}>{t('იტვირთება…')}</div>;

  const upload = async (fileList) => {
    const files = [...fileList];
    if (!files.length) return;
    setBusy(true);
    setError('');
    let added = 0;
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type)) { setError(`${file.name}: ${t('მხოლოდ PNG, JPG, WEBP ან GIF')}`); continue; }
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) { setError(`${file.name}: ${t('ფაილი {mb} MB-ზე დიდია.', { mb: MAX_IMAGE_MB })}`); continue; }
      try {
        const { data } = await api.post('/api/me/media', { dataUrl: await readAsDataUrl(file), name: file.name });
        setMedia((list) => [data, ...list.filter((m) => m.id !== data.id)]);
        added++;
      } catch (err) {
        setError(getErrorMessage(err, t('{name} ვერ აიტვირთა', { name: file.name })));
      }
    }
    setBusy(false);
    if (added) toast(added === 1 ? t('სურათი დაემატა') : t('{count} სურათი დაემატა', { count: added }));
  };

  const remove = async (m) => {
    if (!window.confirm(t('წავშალო „{name}“?', { name: m.name }))) return;
    try {
      await api.delete(`/api/me/media/${m.id}`);
      setMedia((list) => list.filter((x) => x.id !== m.id));
    } catch (err) {
      setError(getErrorMessage(err, t('წაშლა ვერ მოხერხდა')));
    }
  };

  return (
    <div className={s.stack}>
      <div className={s.tabHead}>
        <p className={s.muted}>{t('ლოგოები და სურათები, რომლებსაც კონსტრუქტორში ტვირთავ, აქ ინახება — შემდეგ ერთი დაჭერით დაამატებ ნებისმიერ პროდუქტზე.')}</p>
        <button type="button" className={s.btnPrimary} onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? t('იტვირთება…') : t('სურათის ატვირთვა +')}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_TYPES.join(',')}
          multiple
          hidden
          onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
        />
      </div>
      {error && <div className={s.error}>{error}</div>}
      {!media.length ? (
        <div className={s.empty}><p>{t('სურათები ჯერ არ გაქვს.')}</p></div>
      ) : (
        <div className={s.mediaGrid}>
          {media.map((m) => (
            <figure key={m.id} className={s.mediaCard}>
              <span className={s.mediaImg}><img src={fileUrl(m.url)} alt={m.name} loading="lazy" /></span>
              <figcaption className={s.mediaCap}>
                <span className={s.mediaName} title={m.name}>{m.name}</span>
                <button type="button" className={s.iconDel} onClick={() => remove(m)} aria-label={t('წაშლა')} title={t('წაშლა')}>×</button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Password ───────────────────────────────────────────── */

function SecurityTab() {
  const { t } = useI18n();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', repeat: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast((st) => st.show);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8) { setError(t('ახალი პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს')); return; }
    if (form.newPassword !== form.repeat) { setError(t('პაროლები არ ემთხვევა')); return; }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/api/me/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: '', newPassword: '', repeat: '' });
      toast(data?.pending ? t('დადასტურების ბმული გამოგზავნილია მეილზე — პაროლი ბმულის გახსნის შემდეგ შეიცვლება') : t('პაროლი შეიცვალა'));
    } catch (err) {
      setError(err?.response?.data?.code === 'WRONG_PASSWORD' ? t('მიმდინარე პაროლი არასწორია') : getErrorMessage(err, t('პაროლი ვერ შეიცვალა')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`${s.card} ${s.narrow}`} onSubmit={submit}>
      <div className={s.cardHead}><h2 className={s.h2}>{t('პაროლის შეცვლა')}</h2></div>
      <label className={s.field}>
        <span className={s.label}>{t('მიმდინარე პაროლი')}</span>
        <input className={s.input} type="password" value={form.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" />
      </label>
      <label className={s.field}>
        <span className={s.label}>{t('ახალი პაროლი')}</span>
        <input className={s.input} type="password" value={form.newPassword} onChange={set('newPassword')} autoComplete="new-password" />
      </label>
      <label className={s.field}>
        <span className={s.label}>{t('გაიმეორე ახალი პაროლი')}</span>
        <input className={s.input} type="password" value={form.repeat} onChange={set('repeat')} autoComplete="new-password" />
      </label>
      {error && <div className={s.error}>{error}</div>}
      <div className={s.actions}>
        <button type="submit" className={s.btnPrimary} disabled={busy || !form.currentPassword || !form.newPassword}>
          {busy ? t('ინახება…') : t('პაროლის შეცვლა')}
        </button>
      </div>
    </form>
  );
}

/* ── Page ───────────────────────────────────────────────── */

export default function AccountPage() {
  const { t } = useI18n();
  const { user, isAdmin, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'profile';

  const [orders, setOrders] = useState(null);
  const [designs, setDesigns] = useState(null);
  const [media, setMedia] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get('/api/orders/mine').then((r) => setOrders(r.data)).catch(() => setOrders([]));
    api.get('/api/me/designs').then((r) => setDesigns(r.data)).catch(() => setDesigns([]));
    api.get('/api/me/media').then((r) => setMedia(r.data)).catch(() => setMedia([]));
    api.get('/api/products').then((r) => setProducts(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const onSaved = useCallback(() => refreshUser(), [refreshUser]);

  // On narrow screens the tab strip scrolls: keep the open tab visible.
  const tabsRef = useRef(null);
  useEffect(() => {
    const nav = tabsRef.current;
    const active = nav?.querySelector('[aria-selected="true"]');
    if (nav && active) nav.scrollTo({ left: active.offsetLeft - nav.clientWidth / 2 + active.clientWidth / 2, behavior: 'smooth' });
  }, [tab]);

  // Leave first: this page is protected, so signing out here would bounce to /login.
  const handleLogout = () => {
    navigate('/');
    logout();
  };

  const counts = { orders: orders?.length, designs: designs?.length, media: media?.length };

  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <header className={s.hero}>
          <span className={s.avatar} style={{ background: avatarColor(user) }}>{initialsOf(user)}</span>
          <div className={s.heroText}>
            <h1 className={s.title}>{user.name}</h1>
            <span className={s.muted}>{user.email}</span>
          </div>
          <div className={s.heroActions}>
            {isAdmin && <Link to="/admin/dashboard" className={s.btnDark}>{t('ადმინ პანელი')}</Link>}
            <button type="button" className={s.btnGhost} onClick={handleLogout}>{t('გასვლა')}</button>
          </div>
        </header>

        <nav className={s.tabs} role="tablist" ref={tabsRef}>
          {TABS.map((tb) => (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={tab === tb.id}
              className={`${s.tab} ${tab === tb.id ? s.tabOn : ''}`}
              onClick={() => setParams(tb.id === 'profile' ? {} : { tab: tb.id }, { replace: true })}
            >
              {t(tb.label)}
              {tb.id !== 'profile' && tb.id !== 'security' && counts[tb.id] > 0 && <span className={s.tabCount}>{counts[tb.id]}</span>}
            </button>
          ))}
        </nav>

        {tab === 'profile' && <ProfileTab key={user.updatedAt} user={user} counts={counts} onSaved={onSaved} />}
        {tab === 'orders' && <OrdersTab orders={orders} />}
        {tab === 'designs' && <DesignsTab designs={designs} setDesigns={setDesigns} products={products} />}
        {tab === 'media' && <MediaTab media={media} setMedia={setMedia} />}
        {tab === 'security' && <SecurityTab />}
      </div>
    </main>
  );
}
