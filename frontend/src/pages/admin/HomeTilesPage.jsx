import { useEffect, useRef, useState } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import { CATEGORIES } from '../../lib/catalog';
import { BUILTIN_IMAGES, DEFAULT_TILES, tileImage, tilesFrom } from '../../lib/homeTiles';
import { uploadImage } from './adminShared';
import s from './Admin.module.css';
import h from './HomeTilesPage.module.css';

const NEW_TILE = { label: '', en: '', ru: '', cats: [], image: '', photo: false, hidden: false };
const clean = (tiles) => tiles.map((x) => ({
  label: x.label.trim(),
  en: (x.en || '').trim(),
  ru: (x.ru || '').trim(),
  cats: x.cats,
  image: x.image,
  photo: !!x.photo,
  hidden: !!x.hidden,
}));

/** One tile: picture, names, categories, and its place in the row. */
function TileCard({ tile, index, count, onChange, onMove, onRemove, onError }) {
  const file = useRef(null);
  const [uploading, setUploading] = useState(false);
  const set = (patch) => onChange({ ...tile, ...patch });

  const pick = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setUploading(true);
    try {
      set({ image: await uploadImage(picked) });
    } catch (err) {
      onError(getErrorMessage(err, 'სურათი ვერ აიტვირთა'));
    } finally {
      setUploading(false);
    }
  };

  const toggleCat = (code) => set({ cats: tile.cats.includes(code) ? tile.cats.filter((c) => c !== code) : [...tile.cats, code] });

  return (
    <div className={`${s.card} ${h.tile} ${tile.hidden ? h.hidden : ''}`}>
      <div className={h.media}>
        {tile.image ? <img src={tileImage(tile.image)} alt="" className={tile.photo ? h.photo : ''} /> : <span className={h.noImg}>სურათი არ არის</span>}
        <span className={h.pos}>{index + 1}</span>
      </div>

      <div className={h.body}>
        <div className={h.btnRow}>
          <button type="button" className={`${s.btnGhost} ${s.btnSm}`} disabled={uploading} onClick={() => file.current?.click()}>
            {uploading ? 'იტვირთება…' : 'სურათის შეცვლა'}
          </button>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} />
          <select className={`${s.input} ${h.builtin}`} value="" onChange={(e) => e.target.value && set({ image: `builtin:${e.target.value}` })} aria-label="საიტის სურათი">
            <option value="">ან საიტის სურათი…</option>
            {Object.keys(BUILTIN_IMAGES).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <label className={h.check}>
          <input type="checkbox" checked={!!tile.photo} onChange={(e) => set({ photo: e.target.checked })} />
          ფოტოა (ცოტა მაღლა ჩამოიჭრას)
        </label>

        <label className={s.field}>სახელი (ქართულად) *
          <input className={s.input} value={tile.label} maxLength={40} onChange={(e) => set({ label: e.target.value })} placeholder="მაგ. მაისური" />
        </label>
        <div className={h.two}>
          <input className={s.input} value={tile.en || ''} maxLength={40} onChange={(e) => set({ en: e.target.value })} placeholder="English" aria-label="English" />
          <input className={s.input} value={tile.ru || ''} maxLength={40} onChange={(e) => set({ ru: e.target.value })} placeholder="Русский" aria-label="Русский" />
        </div>

        <div className={s.field}>რომელ კატეგორიას ხსნის *
          <select
            className={s.input}
            value=""
            onChange={(e) => e.target.value && toggleCat(e.target.value)}
          >
            <option value="">{tile.cats.length ? '+ კიდევ კატეგორია…' : 'აირჩიე კატეგორია…'}</option>
            {CATEGORIES.filter((c) => !tile.cats.includes(c.code)).map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          {tile.cats.length > 0 && (
            <div className={h.cats}>
              {tile.cats.map((code) => (
                <button key={code} type="button" className={`${h.cat} ${h.catOn}`} onClick={() => toggleCat(code)} title="ამოშლა">
                  {CATEGORIES.find((c) => c.code === code)?.label || code} ✕
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={h.btnRow}>
          <button type="button" className={`${s.btnGhost} ${s.btnSm}`} disabled={index === 0} onClick={() => onMove(-1)} title="წინ გადატანა">← წინ</button>
          <button type="button" className={`${s.btnGhost} ${s.btnSm}`} disabled={index === count - 1} onClick={() => onMove(1)} title="უკან გადატანა">უკან →</button>
          <button type="button" className={`${s.btnGhost} ${s.btnSm}`} onClick={() => set({ hidden: !tile.hidden })}>
            {tile.hidden ? 'გამოჩენა' : 'დამალვა'}
          </button>
          <button type="button" className={`${s.btnDanger} ${s.btnSm}`} onClick={onRemove}>წაშლა</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Admin: the home page's "რაზე დავბეჭდოთ?" tiles. Pictures, names,
 * categories, order and visibility; saved together in settings.homeTiles.
 */
export default function HomeTilesPage() {
  const [tiles, setTiles] = useState(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.get('/api/settings')
      .then((r) => {
        const list = clean(tilesFrom(r.data).map((x) => ({ ...NEW_TILE, ...x })));
        setTiles(list);
        setSaved(JSON.stringify(list));
      })
      .catch((e) => setError(getErrorMessage(e, 'ვერ ჩაიტვირთა')));
  }, []);

  if (!tiles) {
    return (
      <div className={s.page}>
        <div className={s.head}><h1 className={s.title}>მთავარი გვერდის ფილები</h1></div>
        {error ? <div className={s.error}>{error}</div> : <p className={s.sub}>იტვირთება…</p>}
      </div>
    );
  }

  const dirty = JSON.stringify(clean(tiles)) !== saved;
  const update = (i, next) => { setTiles((list) => list.map((x, j) => (j === i ? next : x))); setNotice(''); };
  const move = (i, dir) => setTiles((list) => {
    const next = [...list];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    return next;
  });
  const remove = (i) => {
    if (!window.confirm(`წავშალო ფილა „${tiles[i].label || i + 1}“?`)) return;
    setTiles((list) => list.filter((_, j) => j !== i));
  };

  const save = async () => {
    const list = clean(tiles);
    const bad = list.findIndex((x) => !x.label || !x.cats.length || !x.image);
    if (bad >= 0) { setError(`ფილა ${bad + 1}: საჭიროა სახელი, სურათი და მინიმუმ ერთი კატეგორია.`); return; }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch('/api/settings', { homeTiles: list });
      const next = clean(tilesFrom(data).map((x) => ({ ...NEW_TILE, ...x })));
      setTiles(next);
      setSaved(JSON.stringify(next));
      setNotice('შენახულია. მთავარ გვერდზე ასე გამოჩნდება.');
    } catch (e) {
      setError(getErrorMessage(e, 'შენახვა ვერ მოხერხდა'));
    } finally {
      setBusy(false);
    }
  };

  const restore = () => {
    if (!window.confirm('დავაბრუნო საიტის საწყისი ფილები? შენი ცვლილებები შენახვის შემდეგ დაიკარგება.')) return;
    setTiles(clean(DEFAULT_TILES.map((x) => ({ ...NEW_TILE, ...x }))));
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>მთავარი გვერდის ფილები</h1>
          <p className={s.sub}>სექცია „რაზე დავბეჭდოთ?“: სურათები, სახელები, რომელ კატეგორიას ხსნის და რიგითობა. ფასი („-დან“) თავისით ითვლება კატეგორიის ყველაზე იაფი პროდუქტიდან.</p>
        </div>
        <div className={h.btnRow}>
          <button type="button" className={s.btnGhost} onClick={restore} disabled={busy}>საწყისის დაბრუნება</button>
          <button type="button" className={s.btnPrimary} onClick={save} disabled={busy || !dirty}>{busy ? 'ინახება…' : 'შენახვა'}</button>
        </div>
      </div>

      {error && <div className={s.error}>{error}</div>}
      {notice && <div className={s.success}>{notice}</div>}
      {dirty && !error && <div className={s.hint}>არის შეუნახავი ცვლილებები.</div>}

      <div className={h.grid}>
        {tiles.map((tile, i) => (
          <TileCard
            key={i}
            tile={tile}
            index={i}
            count={tiles.length}
            onChange={(next) => update(i, next)}
            onMove={(dir) => move(i, dir)}
            onRemove={() => remove(i)}
            onError={setError}
          />
        ))}
        <button type="button" className={h.add} onClick={() => setTiles((list) => [...list, { ...NEW_TILE }])} disabled={tiles.length >= 24}>
          + ახალი ფილა
        </button>
      </div>
    </div>
  );
}
