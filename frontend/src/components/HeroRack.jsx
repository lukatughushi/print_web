import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n-context';
import s from './HeroRack.module.css';

// Garments on the rack, left to right (from the design).
const RACK = [
  ['tshirt', '#26272b'], ['hoodie', '#26344f'], ['polo', '#b4b6ba'], ['longsleeve', '#d9c6a8'],
  ['hoodie-zip', '#2f5d43'], ['tshirt', '#f2f0ec'], ['polo-ls', '#26272b'], ['hoodie', '#b4b6ba'],
  ['longsleeve', '#2f5d43'], ['polo', '#26344f'],
];

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
          items: RACK.map(([model, hex]) => ({ model, hex })),
          minWait: 2.2,
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
