import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { assetUrl } from '../../lib/catalog';
import { getErrorMessage, uploadImage } from './adminShared';
import s from './Admin.module.css';

const EMPTY = { image: '', imageUrl: '', title: '', subtitle: '', ctaText: '', ctaLink: '', isActive: true };

function BannerForm({ banner, onClose, onSaved }) {
  const [form, setForm] = useState(banner ? { ...EMPTY, ...banner } : EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const id = await uploadImage(file);
      setForm((f) => ({ ...f, image: id, imageUrl: `/api/files/${id}` }));
    } catch (err) {
      setError(getErrorMessage(err, 'ფოტო ვერ აიტვირთა'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.image) return setError('ატვირთე ბანერის ფოტო');
    const payload = {
      image: form.image,
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      ctaText: form.ctaText.trim(),
      ctaLink: form.ctaLink.trim(),
      isActive: form.isActive,
    };
    setBusy(true);
    setError('');
    try {
      const { data } = banner
        ? await api.patch(`/api/banners/${banner.id}`, payload)
        : await api.post('/api/banners', payload);
      onSaved(data, !banner);
    } catch (err) {
      setError(getErrorMessage(err, 'შენახვა ვერ მოხერხდა'));
      setBusy(false);
    }
  };

  return (
    <>
      <div className={s.backdrop} onClick={onClose} aria-hidden="true" />
      <form className={s.drawer} onSubmit={submit} role="dialog" aria-label="ბანერი">
        <div className={s.drawerHead}>
          <h2 className={s.drawerTitle}>{banner ? 'ბანერის რედაქტირება' : 'ახალი ბანერი'}</h2>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="დახურვა">✕</button>
        </div>
        <div className={s.drawerBody}>
          {error && <div className={s.error}>{error}</div>}
          <div className={s.card}>
            <div className={s.upload}>
              <div className={`${s.uploadPreview} ${s.uploadWide}`}>
                {form.imageUrl ? <img src={assetUrl(form.imageUrl)} alt="" /> : 'ფოტო არ არის'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className={s.hint}>რეკომენდებული: ჰორიზონტალური, ≥ 1600 px სიგანე (JPG/WebP)</span>
                <button type="button" className={`${s.btnGhost} ${s.btnSm}`} disabled={busy} onClick={() => fileRef.current?.click()}>
                  {form.image ? 'ფოტოს შეცვლა' : 'ფოტოს ატვირთვა'}
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickImage} />
              </div>
            </div>
          </div>
          <div className={`${s.card} ${s.section}`}>
            <div className={s.field}>
              <label className={s.label} htmlFor="b-title">სათაური</label>
              <input id="b-title" className={s.input} value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="b-sub">ქვესათაური</label>
              <textarea id="b-sub" className={s.textarea} value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
            </div>
            <div className={s.formGrid}>
              <div className={s.field}>
                <label className={s.label} htmlFor="b-cta">ღილაკის ტექსტი</label>
                <input id="b-cta" className={s.input} value={form.ctaText} onChange={(e) => set('ctaText', e.target.value)} placeholder="მაგ. ნახე ფასდაკლებები" />
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="b-link">ღილაკის ბმული</label>
                <input id="b-link" className={s.input} value={form.ctaLink} onChange={(e) => set('ctaLink', e.target.value)} placeholder="/shop?sale=1" />
              </div>
            </div>
            <button type="button" className={s.switchLabel} style={{ border: 0, background: 'none', padding: 0, font: 'inherit' }} onClick={() => set('isActive', !form.isActive)}>
              <span className={`${s.switch} ${form.isActive ? s.switchOn : ''}`} /> ჩანს მთავარ გვერდზე
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

export default function BannersPage() {
  const [banners, setBanners] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    api.get('/api/banners/all')
      .then((r) => setBanners(r.data))
      .catch((e) => setError(getErrorMessage(e, 'ბანერები ვერ ჩაიტვირთა')));
  }, []);

  const move = async (index, dir) => {
    const next = [...banners];
    const [b] = next.splice(index, 1);
    next.splice(index + dir, 0, b);
    setBanners(next);
    try {
      const { data } = await api.patch('/api/banners/reorder', { ids: next.map((x) => x.id) });
      setBanners(data);
    } catch (e) {
      setError(getErrorMessage(e, 'თანმიმდევრობა ვერ შეინახა'));
    }
  };

  const toggle = async (b) => {
    try {
      const { data } = await api.patch(`/api/banners/${b.id}`, { isActive: !b.isActive });
      setBanners((list) => list.map((x) => (x.id === b.id ? data : x)));
    } catch (e) {
      setError(getErrorMessage(e, 'ვერ შეიცვალა'));
    }
  };

  const remove = async (b) => {
    if (!window.confirm('წავშალო ბანერი? ფოტოც წაიშლება.')) return;
    try {
      await api.delete(`/api/banners/${b.id}`);
      setBanners((list) => list.filter((x) => x.id !== b.id));
    } catch (e) {
      setError(getErrorMessage(e, 'წაშლა ვერ მოხერხდა'));
    }
  };

  const saved = (b, isNew) => {
    setBanners((list) => (isNew ? [...list, b] : list.map((x) => (x.id === b.id ? b : x))));
    setEditing(null);
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>ბანერები</h1>
          <p className={s.sub}>მთავარი გვერდის სლაიდერი. თუ არცერთი ბანერი არ ჩანს, მთავარ გვერდზე სტანდარტული ბანერი გამოჩნდება.</p>
        </div>
        <button type="button" className={s.btnPrimary} onClick={() => setEditing('new')}>+ ახალი ბანერი</button>
      </div>

      {error && <div className={s.error}>{error}</div>}
      {!banners && !error && <div className={s.loading}>იტვირთება…</div>}
      {banners && banners.length === 0 && <div className={s.empty}>ბანერები ჯერ არ არის.</div>}

      {banners?.length > 0 && (
        <div className={s.bannerList}>
          {banners.map((b, i) => (
            <div key={b.id} className={`${s.bannerRow} ${b.isActive ? '' : s.bannerHidden}`}>
              <div className={s.bannerImg}><img src={assetUrl(b.imageUrl)} alt="" /></div>
              <div style={{ minWidth: 0 }}>
                <div className={s.strong}>{b.title || <span className={s.muted}>სათაურის გარეშე</span>}</div>
                {b.subtitle && <div className={s.muted} style={{ fontSize: 13 }}>{b.subtitle}</div>}
                {b.ctaText && <div style={{ fontSize: 12.5, marginTop: 4 }}>ღილაკი: {b.ctaText} → <span className={s.muted}>{b.ctaLink || '/'}</span></div>}
              </div>
              <div className={s.bannerActions}>
                <button type="button" className={s.iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="ზემოთ">↑</button>
                <button type="button" className={s.iconBtn} disabled={i === banners.length - 1} onClick={() => move(i, 1)} aria-label="ქვემოთ">↓</button>
                <button type="button" className={`${s.switch} ${b.isActive ? s.switchOn : ''}`} onClick={() => toggle(b)} aria-pressed={b.isActive} aria-label="ჩანს" />
                <button type="button" className={`${s.btnGhost} ${s.btnSm}`} onClick={() => setEditing(b)}>რედაქტირება</button>
                <button type="button" className={s.iconBtn} onClick={() => remove(b)} aria-label="წაშლა">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <BannerForm key={editing === 'new' ? 'new' : editing.id} banner={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={saved} />
      )}
    </div>
  );
}
