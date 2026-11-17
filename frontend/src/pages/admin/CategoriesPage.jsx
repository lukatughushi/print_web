import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import { CATEGORIES, isBuiltinCategory, registerCategories } from '../../lib/catalog';
import en from '../../i18n/en';
import ru from '../../i18n/ru';
import s from './Admin.module.css';

// A code for a new category from its English (or Georgian) name.
function codeFor(name, taken) {
  const base = (name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
  let code = /^[A-Z]/.test(base) && base.length >= 2 ? base : `CAT_${Date.now().toString(36).toUpperCase()}`;
  for (let i = 2; taken.includes(code); i++) code = `${base}_${i}`;
  return code;
}

/**
 * Admin: the shop's categories. Built-in ones can be hidden; new ones can be
 * added, hidden and deleted (once no product is in them). Hidden categories
 * and their products don't appear in the shop.
 */
export default function CategoriesPage() {
  const [config, setConfig] = useState(null); // { hidden, custom }
  const [counts, setCounts] = useState({});
  const [form, setForm] = useState({ label: '', en: '', ru: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([api.get('/api/settings'), api.get('/api/admin/category-counts')])
      .then(([st, cn]) => {
        const c = st.data?.categories || {};
        setConfig({ hidden: c.hidden || [], custom: c.custom || [] });
        setCounts(cn.data || {});
      })
      .catch((e) => setError(getErrorMessage(e, 'კატეგორიები ვერ ჩაიტვირთა')));
  }, []);

  const save = async (next, message) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch('/api/settings', { categories: next });
      const saved = { hidden: data.categories?.hidden || [], custom: data.categories?.custom || [] };
      setConfig(saved);
      registerCategories(saved, { en, ru });
      setNotice(message);
      return true;
    } catch (e) {
      setError(getErrorMessage(e, 'შენახვა ვერ მოხერხდა'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!config) {
    return (
      <div className={s.page}>
        <div className={s.head}><h1 className={s.title}>კატეგორიები</h1></div>
        {error ? <div className={s.error}>{error}</div> : <p className={s.sub}>იტვირთება…</p>}
      </div>
    );
  }

  // Built-in categories first, then the added ones.
  const rows = [
    ...CATEGORIES.filter((c) => isBuiltinCategory(c.code)),
    ...config.custom.map((c) => ({ ...c, custom: true })),
  ];
  const isHidden = (code) => config.hidden.includes(code);

  const toggle = (c) => {
    const hidden = isHidden(c.code) ? config.hidden.filter((x) => x !== c.code) : [...config.hidden, c.code];
    save({ ...config, hidden }, isHidden(c.code) ? `„${c.label}“ ისევ ჩანს მაღაზიაში` : `„${c.label}“ დაიმალა მაღაზიიდან`);
  };

  const remove = (c) => {
    if (!window.confirm(`წავშალო კატეგორია „${c.label}“?`)) return;
    save(
      { hidden: config.hidden.filter((x) => x !== c.code), custom: config.custom.filter((x) => x.code !== c.code) },
      `„${c.label}“ წაიშალა`,
    );
  };

  const add = async (e) => {
    e.preventDefault();
    const label = form.label.trim();
    if (!label) { setError('ჩაწერე კატეგორიის სახელი'); return; }
    if (rows.some((c) => c.label.trim().toLowerCase() === label.toLowerCase())) { setError('ასეთი კატეგორია უკვე არის'); return; }
    const code = codeFor(form.en.trim() || label, rows.map((c) => c.code));
    const ok = await save(
      { ...config, custom: [...config.custom, { code, label, en: form.en.trim(), ru: form.ru.trim() }] },
      `„${label}“ დაემატა`,
    );
    if (ok) setForm({ label: '', en: '', ru: '' });
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>კატეგორიები</h1>
          <p className={s.sub}>მაღაზიის კატეგორიები: დამალული კატეგორია და მისი პროდუქტები მაღაზიაში არ ჩანს.</p>
        </div>
      </div>

      {error && <div className={s.error}>{error}</div>}
      {notice && <div className={s.success}>{notice}</div>}

      <div className={`${s.card} ${s.section}`}>
        <h2 className={s.sectionTitle}>ახალი კატეგორია</h2>
        <form onSubmit={add} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'end' }}>
          <label className={s.field}>სახელი (ქართულად) *
            <input className={s.input} value={form.label} maxLength={40} onChange={(e) => { setForm({ ...form, label: e.target.value }); setError(''); }} placeholder="მაგ. წინსაფარი" />
          </label>
          <label className={s.field}>English
            <input className={s.input} value={form.en} maxLength={40} onChange={(e) => setForm({ ...form, en: e.target.value })} placeholder="e.g. Apron" />
          </label>
          <label className={s.field}>Русский
            <input className={s.input} value={form.ru} maxLength={40} onChange={(e) => setForm({ ...form, ru: e.target.value })} placeholder="напр. Фартук" />
          </label>
          <button type="submit" className={s.btnPrimary} disabled={busy}>დამატება</button>
        </form>
      </div>

      <div className={`${s.card} ${s.section}`}>
        <h2 className={s.sectionTitle}>ყველა კატეგორია</h2>
        <div className={s.rows}>
          {rows.map((c) => {
            const hidden = isHidden(c.code);
            const n = counts[c.code] || 0;
            return (
              <div key={c.code} className={s.row} style={{ flexWrap: 'wrap', opacity: hidden ? 0.6 : 1 }}>
                <div className={s.rowMain}>
                  <div className={s.rowName}>{c.label}{hidden ? ' · დამალული' : ''}</div>
                  <div className={s.rowSub}>
                    {[c.en, c.ru].filter(Boolean).join(' · ') || c.code} · {n} პროდუქტი{c.custom ? '' : ' · ძირითადი'}
                  </div>
                </div>
                <button type="button" className={`${s.btnGhost} ${s.btnSm}`} disabled={busy} onClick={() => toggle(c)}>
                  {hidden ? 'გამოჩენა' : 'დამალვა'}
                </button>
                {c.custom ? (
                  <button
                    type="button"
                    className={`${s.btnDanger} ${s.btnSm}`}
                    disabled={busy || n > 0}
                    title={n > 0 ? 'ჯერ ამ კატეგორიის პროდუქტები გადაიტანე სხვა კატეგორიაში ან წაშალე' : undefined}
                    onClick={() => remove(c)}
                  >
                    წაშლა
                  </button>
                ) : (
                  <span className={s.hint} title="ძირითად კატეგორიას 3D მოდელი და სურათები აქვს, ამიტომ მხოლოდ იმალება">მხოლოდ დამალვა</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
