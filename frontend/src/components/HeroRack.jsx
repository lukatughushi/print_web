import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n-context';
import api from '../lib/api';
import { assetUrl } from '../lib/catalog';
import { rackItems } from '../lib/heroRack';
import s from './HeroRack.module.css';

// The designs from the last visit, so the rack never waits on a sleeping backend
// (Render's free plan takes about a minute to wake). The browser may refuse storage.
const CACHE_KEY = 'heroRack';
function cachedDesigns() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? []; } catch { return []; }
}
function freshDesigns(waitMs) {
  const request = api.get('/api/settings').then((r) => {
    const list = r.data?.heroRack ?? [];
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* storage off */ }
    return list;
  });
  const timeout = new Promise((done) => setTimeout(() => done(null), waitMs));
  return Promise.race([request, timeout]).then((list) => list ?? cachedDesigns()).catch(() => cachedDesigns());
}

/**
 * Home hero art: the clothing rack (lib/rackHero), with an "It's coming…"
 * loader until the garments slide in. three.js loads after the page paints.
 */
export default function HeroRack({ className, label }) {
  const { t } = useI18n();
  // Loader text: the first word white, the rest pink.
  const word = t('უკვე მოდის');
  const accentFrom = word.indexOf(' ') + 1;
  const ref = useRef(null);
  const [progress, setProgress] = useState(0);
  const [entering, setEntering] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let cleanup = null;
    let dead = false;
    let fadeTimer = 0;
    const start = () => {
      Promise.all([
        import('../lib/rackHero'),
        freshDesigns(2500),
      ]).then(([{ mountRack }, designs]) => {
        if (dead) return;
        cleanup = mountRack(el, {
          items: rackItems(designs.map((d) => ({ ...d, url: assetUrl(`/api/files/${d.image}`) }))),
          minWait: 1,
          onReady: (done, total) => setProgress(done / total),
          onEnter: () => {
            setEntering(true);
            fadeTimer = window.setTimeout(() => setLoaded(true), 700);
          },
        });
      }).catch(() => setLoaded(true));
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 1500 })
      : window.setTimeout(start, 300);
    return () => {
      dead = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.clearTimeout(fadeTimer);
      cleanup?.();
    };
  }, []);

  return (
    <div className={`${s.stage} ${className || ''}`}>
      <div ref={ref} className={s.canvas} role="img" aria-label={label} />
      {!loaded && (
        <div className={`${s.loader} ${entering ? s.loaderOut : ''}`} aria-hidden="true">
          <div className={s.word}>
            {[...word].map((ch, i) => (
              <span
                key={i}
                className={`${s.ch} ${accentFrom && i >= accentFrom ? s.pink : ''}`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span className={s.wave} style={{ animationDelay: `${0.8 + i * 0.08}s` }}>{ch}</span>
              </span>
            ))}
            <span className={s.dots}>
              {[0, 1, 2].map((j) => <span key={j} style={{ animationDelay: `${j * 0.18}s` }}>.</span>)}
            </span>
          </div>
          <div className={s.bar}><div className={s.barFill} style={{ transform: `scaleX(${progress})` }} /></div>
        </div>
      )}
    </div>
  );
}
