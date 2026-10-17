import { useEffect, useRef } from 'react';

/**
 * Home hero art: product models drawn in particles (see lib/particleHero).
 * three.js is loaded separately, after the page has painted, so the hero
 * text shows up without waiting for it.
 */
export default function HeroParticles({ className, label }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let cleanup = null;
    let dead = false;
    const start = () => {
      import('../lib/particleHero').then(({ mountParticleHero }) => {
        if (dead) return;
        const small = window.matchMedia('(max-width: 700px)').matches;
        cleanup = mountParticleHero(el, { N: small ? 16000 : 34000, host: el.parentElement || el });
      }).catch(() => {});
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 1500 })
      : window.setTimeout(start, 300);
    return () => {
      dead = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      cleanup?.();
    };
  }, []);

  return <div ref={ref} className={className} role="img" aria-label={label} />;
}
