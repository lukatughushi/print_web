import { useState, useEffect, useRef } from 'react';
import adminApi from '../../lib/adminApi';
import s from './BannersPage.module.css';

import { API_URL as API_BASE } from '../../lib/config';

const emptyForm = { title: '', subtitle: '', ctaText: '', ctaLink: '' };

export default function BannersPage() {
  const [banners, setBanners]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editingBanner, setEditing]   = useState(null); // null = add mode
  const [form, setForm]               = useState(emptyForm);
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreview, setPreview]    = useState('');
  const [saving, setSaving]           = useState(false);
  const [modalError, setModalError]   = useState('');
  const [dragOver, setDragOver]       = useState(false);
  const fileRef                        = useRef(null);

  useEffect(() => { fetchBanners(); }, []);

  async function fetchBanners() {
    try {
      const { data } = await adminApi.get('/api/admin/banners');
      setBanners(data);
    } catch {
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setPreview('');
    setModalError('');
    setShowModal(true);
  }

  function openEdit(banner) {
    setEditing(banner);
    setForm({
      title:    banner.title    ?? '',
      subtitle: banner.subtitle ?? '',
      ctaText:  banner.ctaText  ?? '',
      ctaLink:  banner.ctaLink  ?? '',
    });
    setImageFile(null);
    setPreview('');
    setModalError('');
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditing(null); }

  function handleFile(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setModalError('მხოლოდ jpg, png ან webp ფორმატი.'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setModalError('სურათი უნდა იყოს 10 MB-ზე ნაკლები.'); return;
    }
    setImageFile(file);
    setModalError('');
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!editingBanner && !imageFile) { setModalError('გთხოვთ ატვირთოთ სურათი.'); return; }
    setSaving(true); setModalError('');
    try {
      const fd = new FormData();
      if (imageFile) fd.append('image', imageFile);
      fd.append('title',    form.title);
      fd.append('subtitle', form.subtitle);
      fd.append('ctaText',  form.ctaText);
      fd.append('ctaLink',  form.ctaLink);

      if (editingBanner) {
        const { data } = await adminApi.patch(`/api/admin/banners/${editingBanner.id}`, fd);
        setBanners(prev => prev.map(b => b.id === editingBanner.id ? data : b));
      } else {
        const { data } = await adminApi.post('/api/admin/banners', fd);
        setBanners(prev => [...prev, data]);
      }
      closeModal();
    } catch (err) {
      setModalError(err.response?.data?.error || 'შენახვა ვერ მოხდა.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id, current) {
    try {
      const { data } = await adminApi.patch(`/api/admin/banners/${id}`, { isActive: !current });
      setBanners(prev => prev.map(b => b.id === id ? data : b));
    } catch {}
  }

  async function handleDelete(id) {
    if (!confirm('გსურთ ამ ბანერის წაშლა?')) return;
    try {
      await adminApi.delete(`/api/admin/banners/${id}`);
      setBanners(prev => prev.filter(b => b.id !== id));
    } catch {}
  }

  async function handleReorder(idx, direction) {
    const next = [...banners];
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    const reordered = next.map((b, i) => ({ ...b, order: i }));
    setBanners(reordered);
    try {
      await adminApi.patch('/api/admin/banners/reorder', reordered.map(b => ({ id: b.id, order: b.order })));
    } catch {
      fetchBanners();
    }
  }

  if (loading) return <div className={s.loading}>Loading…</div>;

  return (
    <div className={s.page}>
      {/* ── Header ─────────────────────────────────────── */}
      <div className={s.header}>
        <h1 className={s.title}>ბანერის მართვა</h1>
        <button className={s.addBtn} onClick={openAdd} disabled={banners.length >= 3}>
          + ბანერის დამატება
        </button>
      </div>

      <p className={s.hint}>
        მაქსიმუმ 3 ბანერი. გამოჩნდება მთავარ გვერდის სლაიდერში.
      </p>

      {/* ── Banner list ────────────────────────────────── */}
      {banners.length === 0 ? (
        <div className={s.empty}>ბანერი ჯერ არ არის დამატებული.</div>
      ) : (
        <div className={s.list}>
          {banners.map((banner, idx) => (
            <div key={banner.id} className={s.card}>
              <img
                src={`${API_BASE}${banner.imageUrl}?t=${banner.id}`}
                alt={banner.title || 'Banner'}
                className={s.thumb}
              />

              <div className={s.info}>
                <p className={s.cardTitle}>{banner.title || <span className={s.dim}>სათაური არ არის</span>}</p>
                {banner.subtitle && <p className={s.cardSub}>{banner.subtitle}</p>}
                {banner.ctaText && <p className={s.cardCta}>CTA: {banner.ctaText}</p>}
              </div>

              <div className={s.controls}>
                {/* Active toggle */}
                <label className={s.toggle} title={banner.isActive ? 'გამორთვა' : 'ჩართვა'}>
                  <input
                    type="checkbox"
                    checked={banner.isActive}
                    onChange={() => handleToggle(banner.id, banner.isActive)}
                  />
                  <span className={s.toggleTrack}><span className={s.toggleThumb} /></span>
                </label>

                <button className={s.editBtn} onClick={() => openEdit(banner)}>რედ.</button>
                <button className={s.deleteBtn} onClick={() => handleDelete(banner.id)}>წაშ.</button>

                {/* Reorder */}
                <div className={s.orderBtns}>
                  <button className={s.orderBtn} disabled={idx === 0}               onClick={() => handleReorder(idx, 'up')}>↑</button>
                  <button className={s.orderBtn} disabled={idx === banners.length - 1} onClick={() => handleReorder(idx, 'down')}>↓</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────── */}
      {showModal && (
        <div className={s.overlay} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className={s.modal}>
            <div className={s.modalHead}>
              <h2 className={s.modalTitle}>
                {editingBanner ? 'ბანერის რედაქტირება' : 'ახალი ბანერი'}
              </h2>
              <button className={s.closeBtn} onClick={closeModal}>✕</button>
            </div>

            {/* Upload zone */}
            <div
              className={`${s.dropZone} ${dragOver ? s.dropOver : ''}`}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className={s.dropPreview} />
              ) : editingBanner?.imageUrl ? (
                <img src={`${API_BASE}${editingBanner.imageUrl}`} alt="Current" className={s.dropPreview} />
              ) : (
                <div className={s.dropPlaceholder}>
                  <span className={s.dropIcon}>🖼️</span>
                  <span className={s.dropText}>გადმოიდო ან დააჭირე სურათის ასარჩევად</span>
                  <span className={s.dropSub}>jpg · png · webp · max 10 MB</span>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>

            {/* Form fields */}
            <div className={s.fields}>
              {[
                { key: 'title',    label: 'სათაური',       placeholder: 'მაგ. ახალი კოლექცია' },
                { key: 'subtitle', label: 'ქვესათაური',    placeholder: 'მაგ. 30%-მდე ფასდაკლება' },
                { key: 'ctaText',  label: 'ღილაკის ტექსტი', placeholder: 'მაგ. შეკვეთა' },
                { key: 'ctaLink',  label: 'ბმული',          placeholder: 'https://…', type: 'url' },
              ].map(({ key, label, placeholder, type }) => (
                <label key={key} className={s.fieldLabel}>
                  {label}
                  <input
                    type={type || 'text'}
                    className={s.fieldInput}
                    value={form[key]}
                    placeholder={placeholder}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>

            {modalError && <p className={s.modalError}>{modalError}</p>}

            <div className={s.modalActions}>
              <button className={s.cancelBtn} onClick={closeModal}>გაუქმება</button>
              <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'შენახვა…' : 'შენახვა'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
