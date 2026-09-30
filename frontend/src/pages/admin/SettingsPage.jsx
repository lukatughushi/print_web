import { useEffect, useState } from 'react';
import adminApi from '../../lib/adminApi';
import styles from '../admin.module.css';

const EMPTY = {
  announcementText: '',
  announcementActive: true,
  heroTitle: '',
  heroSubtitle: '',
  heroCtaText: '',
  heroCtaLink: '',
  freeShipThreshold: 150,
  currency: '₾',
  contactPhone: '',
  contactEmail: '',
  contactAddress: '',
};

export default function SettingsPage() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.get('/api/admin/settings')
      .then((r) => {
        setForm({ ...EMPTY, ...Object.fromEntries(
          Object.entries(r.data || {}).filter(([, v]) => v !== null && v !== undefined),
        ) });
        setLoading(false);
      })
      .catch(() => { setError('ჩატვირთვა ვერ მოხდა'); setLoading(false); });
  }, []);

  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
    setSaved(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await adminApi.patch('/api/admin/settings', {
        ...form,
        freeShipThreshold: parseInt(form.freeShipThreshold, 10) || 0,
      });
      setForm({ ...EMPTY, ...Object.fromEntries(
        Object.entries(data || {}).filter(([, v]) => v !== null && v !== undefined),
      ) });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || 'შენახვა ვერ მოხდა');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>საიტის კონტენტი</h1>
      </div>

      <form onSubmit={handleSave} className={styles.formCard}>
        <h2 className={styles.formCardTitle} style={{ marginBottom: 18 }}>სარეკლამო ზოლი</h2>
        <label className={styles.formLabel} style={{ marginBottom: 16 }}>
          ტექსტი
          <input className={styles.formInput} value={form.announcementText} onChange={set('announcementText')} placeholder="★ 2 400+ დაბეჭდილი შეკვეთა · ..." />
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={form.announcementActive} onChange={set('announcementActive')} />
          აქტიური — ჩანს მთავარ გვერდზე
        </label>

        <h2 className={styles.formCardTitle} style={{ margin: '24px 0 18px' }}>ჰერო სექცია</h2>
        <div className={styles.formGrid}>
          <label className={styles.formLabel}>
            სათაური
            <input className={styles.formInput} value={form.heroTitle} onChange={set('heroTitle')} />
          </label>
          <label className={styles.formLabel}>
            ღილაკის ტექსტი
            <input className={styles.formInput} value={form.heroCtaText} onChange={set('heroCtaText')} />
          </label>
          <label className={styles.formLabel}>
            ღილაკის ბმული
            <input className={styles.formInput} value={form.heroCtaLink} onChange={set('heroCtaLink')} placeholder="/design/... (ცარიელი = ავტომატური)" />
          </label>
        </div>
        <label className={styles.formLabel} style={{ marginBottom: 16 }}>
          ქვესათაური
          <input className={styles.formInput} value={form.heroSubtitle} onChange={set('heroSubtitle')} />
        </label>

        <h2 className={styles.formCardTitle} style={{ margin: '24px 0 18px' }}>კომერცია</h2>
        <div className={styles.formGrid}>
          <label className={styles.formLabel}>
            უფასო მიწოდების ზღვარი
            <input className={styles.formInput} type="number" min="0" value={form.freeShipThreshold} onChange={set('freeShipThreshold')} />
          </label>
          <label className={styles.formLabel}>
            ვალუტის სიმბოლო
            <input className={styles.formInput} value={form.currency} onChange={set('currency')} />
          </label>
        </div>

        <h2 className={styles.formCardTitle} style={{ margin: '24px 0 18px' }}>საკონტაქტო</h2>
        <div className={styles.formGrid}>
          <label className={styles.formLabel}>
            ტელეფონი
            <input className={styles.formInput} value={form.contactPhone} onChange={set('contactPhone')} />
          </label>
          <label className={styles.formLabel}>
            ელ. ფოსტა
            <input className={styles.formInput} value={form.contactEmail} onChange={set('contactEmail')} />
          </label>
          <label className={styles.formLabel}>
            მისამართი
            <input className={styles.formInput} value={form.contactAddress} onChange={set('contactAddress')} />
          </label>
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? 'ინახება…' : 'შენახვა'}
          </button>
          {saved && <span style={{ alignSelf: 'center', color: '#15803d', fontSize: 13, fontWeight: 600 }}>შენახულია ✓</span>}
        </div>
      </form>
    </div>
  );
}
