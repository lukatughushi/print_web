import { useState, useEffect, useRef } from 'react';
import adminApi from '../lib/adminApi';
import styles from './AdminBanners.module.css';

import { API_URL as API_BASE } from '../lib/config';
const SLOTS = [1, 2, 3];

const emptySlot = (slotNumber) => ({
  slotNumber,
  imageUrl: null,
  title: '',
  subtitle: '',
  link: '',
  isActive: true,
  newFile: null,
  preview: null,
  saving: false,
  saved: false,
  error: '',
  imageTs: 0, // incremented on every successful save to bust the browser cache
});

export default function AdminBanners() {
  const [slots, setSlots] = useState(SLOTS.map(emptySlot));
  const [loading, setLoading] = useState(true);
  const fileRefs = useRef([null, null, null]);

  useEffect(() => {
    adminApi.get('/api/admin/banners').then(({ data }) => {
      setSlots(SLOTS.map((n) => {
        const row = data.find((b) => b.slotNumber === n);
        if (!row) return emptySlot(n);
        return {
          slotNumber: n,
          imageUrl: row.imageUrl ?? null,
          title: row.title ?? '',
          subtitle: row.subtitle ?? '',
          link: row.link ?? '',
          isActive: row.isActive,
          newFile: null,
          preview: null,
          saving: false,
          saved: false,
          error: '',
        };
      }));
    }).catch(() => {
      setSlots(SLOTS.map(emptySlot));
    }).finally(() => setLoading(false));
  }, []);

  function update(slotNumber, changes) {
    setSlots((prev) =>
      prev.map((s) => (s.slotNumber === slotNumber ? { ...s, ...changes } : s))
    );
  }

  function handleFileSelect(slotNumber, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      update(slotNumber, { error: 'Please select a valid image file.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      update(slotNumber, { error: 'Image must be 10 MB or smaller.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => update(slotNumber, { newFile: file, preview: e.target.result, error: '' });
    reader.readAsDataURL(file);
  }

  async function saveSlot(slotNumber) {
    const slot = slots.find((s) => s.slotNumber === slotNumber);
    if (!slot.imageUrl && !slot.newFile) {
      update(slotNumber, { error: 'Please upload an image for this slot.' });
      return;
    }
    update(slotNumber, { saving: true, error: '', saved: false });

    try {
      const fd = new FormData();
      fd.append('slotNumber', slotNumber);
      if (slot.newFile) fd.append('image', slot.newFile);
      fd.append('title', slot.title);
      fd.append('subtitle', slot.subtitle);
      fd.append('link', slot.link);

      // Do NOT set Content-Type manually — the browser must inject the multipart
      // boundary itself. Any manual header strips the boundary and breaks parsing.
      const { data } = await adminApi.post('/api/admin/banners', fd);

      update(slotNumber, {
        imageUrl: data.imageUrl ?? null,
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        link: data.link ?? '',
        newFile: null,
        preview: null,
        saving: false,
        saved: true,
        error: '',
        imageTs: Date.now(), // new timestamp forces browser to re-fetch the image
      });

      setTimeout(() => update(slotNumber, { saved: false }), 2500);
    } catch (err) {
      update(slotNumber, {
        saving: false,
        error: err.response?.data?.error || 'Save failed. Please try again.',
      });
    }
  }

  if (loading) return <div className={styles.loadingWrap}>Loading banner slots…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Banner Management</h1>
          <p className={styles.pageDesc}>Manage the 3 homepage hero banner slots.</p>
        </div>
      </div>

      <div className={styles.slotsGrid}>
        {slots.map((slot, idx) => {
          // Local base64 preview takes priority; server URLs get a cache-bust timestamp
          // so the browser always fetches the latest version after a save.
          const displayImage = slot.preview
            || (slot.imageUrl ? `${API_BASE}${slot.imageUrl}?t=${slot.imageTs}` : null);

          return (
            <div key={slot.slotNumber} className={styles.slotCard}>
              {/* Card header */}
              <div className={styles.slotHeader}>
                <div className={styles.slotBadge}>{slot.slotNumber}</div>
                <span className={styles.slotLabel}>Banner Slot {slot.slotNumber}</span>
                {slot.saved && <span className={styles.savedTag}>✓ Saved</span>}
              </div>

              {/* Image preview / upload zone */}
              <div
                className={`${styles.imageZone} ${!displayImage ? styles.imageZoneEmpty : ''}`}
                onClick={() => fileRefs.current[idx]?.click()}
                title="Click to change image"
              >
                {slot.saving && (
                  <div className={styles.savingOverlay}>
                    <span className={styles.spinner} />
                  </div>
                )}
                {displayImage ? (
                  <>
                    <img src={displayImage} alt={`Slot ${slot.slotNumber}`} className={styles.slotImage} />
                    {slot.newFile && !slot.saving && (
                      <div className={styles.newFileBadge}>New image selected</div>
                    )}
                    {!slot.saving && (
                      <div className={styles.imageOverlay}>
                        <span className={styles.imageOverlayText}>Click to replace</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.imagePlaceholder}>
                    <span className={styles.placeholderIcon}>🖼</span>
                    <span className={styles.placeholderText}>No image yet</span>
                    <span className={styles.placeholderSub}>Click to upload</span>
                  </div>
                )}
                <input
                  ref={(el) => (fileRefs.current[idx] = el)}
                  type="file"
                  accept="image/*"
                  className={styles.hiddenInput}
                  onChange={(e) => handleFileSelect(slot.slotNumber, e.target.files[0])}
                />
              </div>

              {/* Text fields */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Title
                  <input
                    type="text"
                    className={styles.fieldInput}
                    placeholder="e.g. Summer Collection"
                    value={slot.title}
                    onChange={(e) => update(slot.slotNumber, { title: e.target.value })}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  Subtitle
                  <input
                    type="text"
                    className={styles.fieldInput}
                    placeholder="e.g. Up to 30% off"
                    value={slot.subtitle}
                    onChange={(e) => update(slot.slotNumber, { subtitle: e.target.value })}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  Link URL
                  <input
                    type="url"
                    className={styles.fieldInput}
                    placeholder="https://…"
                    value={slot.link}
                    onChange={(e) => update(slot.slotNumber, { link: e.target.value })}
                  />
                </label>
              </div>

              {slot.error && <p className={styles.slotError}>{slot.error}</p>}

              {/* Save button */}
              <button
                className={styles.saveBtn}
                onClick={() => saveSlot(slot.slotNumber)}
                disabled={slot.saving}
              >
                {slot.saving ? 'Saving…' : `Save Slot ${slot.slotNumber}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
