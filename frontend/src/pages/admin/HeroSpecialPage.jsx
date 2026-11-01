import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { assetUrl } from '../../lib/catalog';
import { COLOURS, RACK } from '../../lib/heroRack';
import { getErrorMessage, uploadImage } from './adminShared';
import s from './Admin.module.css';
import h from './HeroSpecialPage.module.css';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const NEW_DESIGN = { x: 0.5, y: 0.3, scale: 0.6 };
const mask = (model, part) => {
  const url = `url(/hero-zones/${model}-${part}.webp)`;
  return { maskImage: url, WebkitMaskImage: url };
};

/** One garment: its print zone with the design, dragged into place. */
function SlotCard({ index, garment, design, onChange, onError }) {
  const zone = useRef(null);
  const file = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setUploading(true);
    try {
      const image = await uploadImage(picked);
      onChange({ ...NEW_DESIGN, hex: COLOURS[1].hex, ...design, image });
    } catch (err) {
      onError(getErrorMessage(err, 'სურათი ვერ აიტვირთა'));
    } finally {
      setUploading(false);
    }
  };

  const drag = (e) => {
    const box = zone.current.getBoundingClientRect();
    onChange({
      ...design,
      x: clamp((e.clientX - box.left) / box.width, 0, 1),
      y: clamp((e.clientY - box.top) / box.height, 0, 1),
    });
  };

  const { zone: aspect, x, y, w, h: zh } = garment.zone;

  return (
    <div className={`${s.card} ${h.slot}`}>
      <div className={h.slotHead}>
        <b>{index + 1}. {garment.name}</b>
        {design && <button type="button" className={h.remove} onClick={() => onChange(null)}>წაშლა</button>}
      </div>

      <div className={h.stage}>
        {/* The garment and zone as the 3D model has them: the design is cut to
            the same shape as on the site. */}
        <div ref={zone} className={`${h.zone} ${aspect > 1 ? h.zoneWide : ''}`} style={{ aspectRatio: aspect }}>
          <div
            className={h.garment}
            style={{
              ...mask(garment.model, 'garment'),
              left: `${(-x / w) * 100}%`,
              top: `${(-y / zh) * 100}%`,
              width: `${100 / w}%`,
              height: `${100 / zh}%`,
              background: design?.hex ?? '#CFC8BF',
            }}
          />
          <div className={h.print} style={mask(garment.model, 'zone')}>
            {design && (
              <img
                className={h.art}
                src={assetUrl(`/api/files/${design.image}`)}
                alt=""
                draggable={false}
                style={{ left: `${design.x * 100}%`, top: `${design.y * 100}%`, width: `${design.scale * 100}%` }}
                onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                onPointerMove={(e) => { if (e.buttons) drag(e); }}
              />
            )}
          </div>
          <div className={h.edge} style={mask(garment.model, 'edge')} />
        </div>
      </div>

      <button type="button" className={h.pick} onClick={() => file.current.click()} disabled={uploading}>
        {uploading ? 'იტვირთება…' : design ? 'სურათის შეცვლა' : 'სურათის ატვირთვა'}
      </button>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} />

      {design && (
        <>
          <label className={s.label} htmlFor={`hs-scale-${index}`}>ზომა: {Math.round(design.scale * 100)}%</label>
          <input
            id={`hs-scale-${index}`}
            type="range"
            min="10"
            max="100"
            value={Math.round(design.scale * 100)}
            onChange={(e) => onChange({ ...design, scale: Number(e.target.value) / 100 })}
          />
          <span className={s.label}>ფერი</span>
          <div className={h.colours}>
            {COLOURS.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={c.name}
                aria-label={c.name}
                aria-pressed={design.hex === c.hex}
                className={`${h.colour} ${design.hex === c.hex ? h.colourOn : ''}`}
                style={{ background: c.hex }}
                onClick={() => onChange({ ...design, hex: c.hex })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Designs on the home hero's rack garments: image, place, size and colour. */
export default function HeroSpecialPage() {
  const [designs, setDesigns] = useState(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.get('/api/settings')
      .then((r) => {
        const list = r.data?.heroRack ?? [];
        setDesigns(Object.fromEntries(list.map((d) => [d.slot, d])));
        setSaved(JSON.stringify(list));
      })
      .catch((e) => setError(getErrorMessage(e, 'პარამეტრები ვერ ჩაიტვირთა')));
  }, []);

  if (error && !designs) return <div className={s.error}>{error}</div>;
  if (!designs) return <div className={s.loading}>იტვირთება…</div>;

  const list = RACK.flatMap((_, slot) => {
    const d = designs[slot];
    return d ? [{ slot, image: d.image, x: d.x, y: d.y, scale: d.scale, hex: d.hex }] : [];
  });
  const dirty = JSON.stringify(list) !== saved;

  const setSlot = (slot, design) => {
    setNotice('');
    setError('');
    setDesigns((all) => {
      const next = { ...all };
      if (design) next[slot] = design;
      else delete next[slot];
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.patch('/api/settings', { heroRack: list });
      setSaved(JSON.stringify(list));
      setNotice('შენახულია');
    } catch (e) {
      setError(getErrorMessage(e, 'ვერ შეინახა'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Hero_Special</h1>
          <p className={s.sub}>მთავარი გვერდის საკიდის დიზაინები. ატვირთე სურათი და ჩაავლე მას, რომ სასურველ ადგილას დასვა. ფრონტზე დიზაინი ჩანს, როცა ნივთი მაუსით ან შეხებით შემობრუნდება.</p>
        </div>
      </div>

      {error && <div className={s.error}>{error}</div>}
      {notice && <div className={s.success}>{notice}</div>}

      <div className={h.grid}>
        {RACK.map((garment, i) => (
          <SlotCard
            key={i}
            index={i}
            garment={garment}
            design={designs[i]}
            onChange={(d) => setSlot(i, d)}
            onError={setError}
          />
        ))}
      </div>

      <div className={h.foot}>
        <button type="button" className={s.btnPrimary} onClick={save} disabled={busy || !dirty}>
          {busy ? 'ინახება…' : 'შენახვა'}
        </button>
      </div>
    </div>
  );
}
