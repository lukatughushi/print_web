import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { getErrorMessage } from './adminShared';
import s from './Admin.module.css';

const TEXT_FIELDS = [
  'announcementText', 'heroTitle', 'heroSubtitle', 'heroCtaText', 'heroCtaLink',
  'proofNumber', 'proofText',
  'currency', 'contactPhone', 'contactEmail', 'contactAddress',
];

export default function SettingsPage() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.get('/api/settings')
      .then((r) => { setForm(r.data); setSaved(r.data); })
      .catch((e) => setError(getErrorMessage(e, 'პარამეტრები ვერ ჩაიტვირთა')));
  }, []);

  if (error && !form) return <div className={s.error}>{error}</div>;
  if (!form) return <div className={s.loading}>იტვირთება…</div>;

  const set = (key) => (e) => {
    setNotice('');
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const submit = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(TEXT_FIELDS.map((k) => [k, String(form[k] ?? '')]));
    payload.announcementActive = !!form.announcementActive;
    payload.freeShipThreshold = Math.max(0, Number(form.freeShipThreshold) || 0);
    payload.shippingFee = Math.max(0, Number(form.shippingFee) || 0);
    setBusy(true);
    setError('');
    try {
      const { data } = await api.patch('/api/settings', payload);
      setForm(data);
      setSaved(data);
      setNotice('შენახულია — ცვლილება საიტზე მაშინვე ჩანს.');
    } catch (err) {
      setError(getErrorMessage(err, 'შენახვა ვერ მოხერხდა'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={s.page} onSubmit={submit}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>პარამეტრები</h1>
          <p className={s.sub}>მაღაზიის ტექსტები, მიწოდება და კონტაქტები</p>
        </div>
        <button type="submit" className={s.btnPrimary} disabled={busy || !dirty}>{busy ? 'ინახება…' : 'შენახვა'}</button>
      </div>

      {error && <div className={s.error}>{error}</div>}
      {notice && <div className={s.success}>{notice}</div>}

      <div className={`${s.card} ${s.section}`}>
        <h2 className={s.sectionTitle}>ანონსის ზოლი</h2>
        <button
          type="button"
          className={s.switchLabel}
          style={{ border: 0, background: 'none', padding: 0, font: 'inherit', alignSelf: 'flex-start' }}
          onClick={() => { setNotice(''); setForm((f) => ({ ...f, announcementActive: !f.announcementActive })); }}
        >
          <span className={`${s.switch} ${form.announcementActive ? s.switchOn : ''}`} /> ჩანს მთავარ გვერდზე
        </button>
        <div className={s.field}>
          <label className={s.label} htmlFor="s-ann">ტექსტი</label>
          <input id="s-ann" className={s.input} value={form.announcementText || ''} onChange={set('announcementText')} />
        </div>
      </div>

      <div className={`${s.card} ${s.section}`}>
        <h2 className={s.sectionTitle}>მთავარი გვერდის ღილაკი</h2>
        <div className={s.formGrid}>
          <div className={s.field}>
            <label className={s.label} htmlFor="s-hc">ღილაკის ტექსტი</label>
            <input id="s-hc" className={s.input} value={form.heroCtaText || ''} onChange={set('heroCtaText')} />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="s-hl">ღილაკის ბმული</label>
            <input id="s-hl" className={s.input} value={form.heroCtaLink || ''} onChange={set('heroCtaLink')} placeholder="ცარიელი = კონსტრუქტორი" />
          </div>
        </div>
      </div>

      <div className={`${s.card} ${s.section}`}>
        <h2 className={s.sectionTitle}>მთავარი გვერდი — შეკვეთების რაოდენობა</h2>
        <p className={s.hint} style={{ margin: 0 }}>ღილაკის ქვემოთ: „10 000+ შესრულებული საცალო შეკვეთა“. ცარიელი ველი არ ჩანს.</p>
        <div className={s.formGrid}>
          <div className={s.field}>
            <label className={s.label} htmlFor="s-pn">რიცხვი</label>
            <input id="s-pn" className={s.input} value={form.proofNumber || ''} onChange={set('proofNumber')} placeholder="10 000+" />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="s-pt">ტექსტი რიცხვის გვერდით</label>
            <input id="s-pt" className={s.input} value={form.proofText || ''} onChange={set('proofText')} placeholder="შესრულებული საცალო შეკვეთა" />
          </div>
        </div>
      </div>

      <div className={`${s.card} ${s.section}`}>
        <h2 className={s.sectionTitle}>მიწოდება და ფასები</h2>
        <div className={s.formGrid3}>
          <div className={s.field}>
            <label className={s.label} htmlFor="s-fee">მიწოდების ფასი (₾)</label>
            <input id="s-fee" className={s.input} type="number" min="0" step="0.5" value={form.shippingFee ?? ''} onChange={set('shippingFee')} />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="s-free">უფასო მიწოდება (₾-დან)</label>
            <input id="s-free" className={s.input} type="number" min="0" step="1" value={form.freeShipThreshold ?? ''} onChange={set('freeShipThreshold')} />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="s-cur">ვალუტის სიმბოლო</label>
            <input id="s-cur" className={s.input} value={form.currency || ''} onChange={set('currency')} />
          </div>
        </div>
        <span className={s.hint}>შეკვეთის ჯამს სერვერი ამ მნიშვნელობებით ითვლის.</span>
      </div>

      <div className={`${s.card} ${s.section}`}>
        <h2 className={s.sectionTitle}>კონტაქტები (ფუტერში)</h2>
        <div className={s.formGrid3}>
          <div className={s.field}>
            <label className={s.label} htmlFor="s-ph">ტელეფონი</label>
            <input id="s-ph" className={s.input} value={form.contactPhone || ''} onChange={set('contactPhone')} />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="s-em">ელფოსტა</label>
            <input id="s-em" className={s.input} value={form.contactEmail || ''} onChange={set('contactEmail')} />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="s-ad">მისამართი</label>
            <input id="s-ad" className={s.input} value={form.contactAddress || ''} onChange={set('contactAddress')} />
          </div>
        </div>
      </div>
    </form>
  );
}
