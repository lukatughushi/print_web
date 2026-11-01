import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n-context';
import s from './HeroRack.module.css';

// Garments on the rack, left to right (from the design).
const RACK = ['tshirt', 'hoodie', 'polo', 'longsleeve', 'hoodie-zip', 'tshirt', 'polo-ls', 'hoodie', 'longsleeve', 'polo'];

// The 12 best-known garment colours; every visit deals a different set.
// Black and navy are lifted a little so they read on the dark hero.
const COLOURS = [
  '#3a3b40', // black
  '#f2f0ec', // white
  '#b4b6ba', // grey
  '#2e3f6b', // navy
  '#c8323c', // red
  '#2b4c9b', // blue
  '#2f7a4d', // green
  '#e4d3b0', // beige
  '#8c2a3e', // burgundy
  '#f2c230', // yellow
  '#ef7f9a', // pink
  '#e9772b', // orange
];

function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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
      import('../lib/rackHero').then(({ mountRack }) => {
        if (dead) return;
        cleanup = mountRack(el, {
          items: (() => {
            const colours = shuffled(COLOURS);
            return RACK.map((model, i) => ({ model, hex: colours[i] }));
          })(),
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
                style={{ animationDelay: `${i * 0.05}s, ${0.8 + i * 0.08}s` }}
              >
                {ch}
              </span>
            ))}
            <span className={s.dots}>
              {[0, 1, 2].map((j) => <span key={j} style={{ animationDelay: `${j * 0.18}s` }}>.</span>)}
            </span>
          </div>
          <div className={s.bar}><div className={s.barFill} style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        </div>
      )}
    </div>
  );
}
