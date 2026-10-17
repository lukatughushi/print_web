/**
 * Home hero art: particles taken from the surface of the product GLB models,
 * morphing from one product to the next. Print zones glow pink; the pointer
 * scatters the particles. Ported from the design file (acrhi/particle-hero.js)
 * to the project's three.js and models.
 *
 * mountParticleHero(el, opts) -> cleanup
 */
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const MODELS = [
  ['tshirt', '/models/tshirt-male.glb'],
  ['longsleeve', '/models/long-sleeve-tshirt-print.glb'],
  ['hoodie', '/models/hoodie.glb'],
  ['cap', '/models/cap_main.glb'],
  ['mug', '/models/mug-print-zones.glb'],
];

const PINK = [0.937, 0.373, 0.478];
const CREAM = [0.953, 0.922, 0.89];
const TEAL = [0.235, 0.667, 0.667];

// N points spread evenly over the model's surface, centred and scaled to `fit`.
function sample(root, N, fit) {
  root.updateMatrixWorld(true);
  const parts = [];
  const v = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    const g = o.geometry, p = g.attributes.position, cnt = p.count;
    const P = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    }
    const idx = g.index ? g.index.array : null;
    const tc = idx ? idx.length / 3 : cnt / 3;
    const cum = new Float64Array(tc);
    let tot = 0;
    for (let t = 0; t < tc; t++) {
      const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      a.fromArray(P, i0 * 3); b.fromArray(P, i1 * 3).sub(a); c.fromArray(P, i2 * 3).sub(a);
      tot += b.cross(c).length() * 0.5;
      cum[t] = tot;
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (tot > 0) parts.push({ P, idx, cum, tot, print: mats.some((m) => /print/i.test(m?.name || '')) });
  });

  const all = parts.reduce((s, p) => s + p.tot, 0);
  let acc = 0;
  parts.forEach((p) => { acc += p.tot; p.acc = acc; });

  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), print = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = Math.random() * all;
    let pi = 0;
    while (pi < parts.length - 1 && parts[pi].acc < r) pi++;
    const p = parts[pi];
    const rr = Math.random() * p.tot;
    let lo = 0, hi = p.cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (p.cum[mid] < rr) lo = mid + 1; else hi = mid; }
    const i0 = p.idx ? p.idx[lo * 3] : lo * 3, i1 = p.idx ? p.idx[lo * 3 + 1] : lo * 3 + 1, i2 = p.idx ? p.idx[lo * 3 + 2] : lo * 3 + 2;
    let u = Math.random(), w = Math.random();
    if (u + w > 1) { u = 1 - u; w = 1 - w; }
    const k = 1 - u - w;
    for (let d = 0; d < 3; d++) pos[i * 3 + d] = p.P[i0 * 3 + d] * k + p.P[i1 * 3 + d] * u + p.P[i2 * 3 + d] * w;
    print[i] = p.print ? 1 : 0;
  }

  // Centre and size by percentiles, so a few stray vertices don't shrink the model.
  const q = (arr, f) => { const s = Float32Array.from(arr).sort(); return s[Math.floor(f * (s.length - 1))]; };
  const ctr = [0, 1, 2].map((d) => {
    const vals = new Float32Array(N);
    for (let i = 0; i < N; i++) vals[i] = pos[i * 3 + d];
    return (q(vals, 0.01) + q(vals, 0.99)) / 2;
  });
  // Every product gets the same height (`fit`). Only very wide ones (the cap)
  // are held to 1.7×fit across, so they stay inside the view as they turn;
  // the long sleeve, arms spread, is ~1.7× its height and still fits.
  const ys = new Float32Array(N), hr = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = pos[i * 3] - ctr[0], z = pos[i * 3 + 2] - ctr[2];
    ys[i] = pos[i * 3 + 1];
    hr[i] = Math.sqrt(x * x + z * z);
  }
  const height = q(ys, 0.99) - q(ys, 0.01);
  const width = q(hr, 0.99) * 2;
  const s = fit / Math.max(height, width / 1.7);

  for (let i = 0; i < N; i++) {
    for (let d = 0; d < 3; d++) pos[i * 3 + d] = (pos[i * 3 + d] - ctr[d]) * s;
    // Print zones pink; fabric fades pink → cream from bottom to top, a few teal sparks.
    const ty = Math.max(0, Math.min(1, pos[i * 3 + 1] / fit + 0.5));
    const cc = print[i]
      ? PINK
      : Math.random() < 0.05
        ? TEAL
        : [0, 1, 2].map((d) => PINK[d] + (CREAM[d] - PINK[d]) * ty);
    col[i * 3] = cc[0]; col[i * 3 + 1] = cc[1]; col[i * 3 + 2] = cc[2];
  }
  return { pos, col };
}

export function mountParticleHero(el, { N = 34000, hold = 4.5, size = 0.045, host = el, fit = 4.86 } = {}) {
  let dead = false;
  const targets = {}, order = [];
  let cur = -1, switchAt = 0, now = 0;

  const r = new T.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  el.appendChild(r.domElement);
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(38, 1, 0.1, 100);
  cam.position.set(0, 0.2, 10.5);
  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    r.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  // Pointer, smoothed: tilts the model and pushes particles away.
  const m = { x: 0, y: 0, tx: 0, ty: 0, h: 0, th: 0 };
  const pm = (e) => {
    const bb = el.getBoundingClientRect();
    m.tx = Math.max(-1.5, Math.min(1.5, ((e.clientX - bb.left) / bb.width) * 2 - 1));
    m.ty = Math.max(-1.5, Math.min(1.5, -(((e.clientY - bb.top) / bb.height) * 2 - 1)));
    m.th = 1;
  };
  const pl = () => { m.tx = 0; m.ty = 0; m.th = 0; };
  host.addEventListener('pointermove', pm);
  host.addEventListener('pointerleave', pl);

  // Start as a loose cloud until the first model arrives.
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const th = Math.random() * 6.28, ph = Math.acos(2 * Math.random() - 1), rad = 2 + Math.random() * 3;
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * rad;
    pos[i * 3 + 1] = Math.cos(ph) * rad;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * rad;
    col[i * 3] = 0.95; col[i * 3 + 1] = 0.55; col[i * 3 + 2] = 0.62;
    seed[i] = Math.random() * 6.28;
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('color', new T.BufferAttribute(col, 3));

  // Soft round dot.
  const dc = document.createElement('canvas');
  dc.width = dc.height = 64;
  const dx = dc.getContext('2d');
  const gr = dx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff');
  gr.addColorStop(0.45, 'rgba(255,255,255,.85)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  dx.fillStyle = gr;
  dx.fillRect(0, 0, 64, 64);
  const tex = new T.CanvasTexture(dc);
  const mat = new T.PointsMaterial({
    size, map: tex, vertexColors: true, transparent: true, depthWrite: false,
    blending: T.AdditiveBlending, opacity: 0.9,
  });
  const pts = new T.Points(geo, mat);
  scene.add(pts);

  const next = () => {
    if (!order.length) return;
    const i = order.indexOf(MODELS[cur][0]);
    cur = MODELS.findIndex(([id]) => id === order[(i + 1) % order.length]);
    switchAt = now;
  };

  let raf = 0, last = -1, burst = 0, visible = true, clock = 0, prev = performance.now();
  const loop = () => {
    raf = visible ? requestAnimationFrame(loop) : 0;
    const nowMs = performance.now();
    // Time only runs while on screen, so a model doesn't skip ahead off screen.
    clock += Math.min(0.1, (nowMs - prev) / 1000);
    prev = nowMs;
    const t = clock;
    now = t;
    m.x += (m.tx - m.x) * 0.07; m.y += (m.ty - m.y) * 0.07; m.h += (m.th - m.h) * 0.05;
    const tg = cur >= 0 ? targets[MODELS[cur][0]] : null;
    if (tg && t - switchAt > hold) next();
    if (cur !== last) { last = cur; burst = 1; }
    burst *= 0.96;
    const ry = t * 0.35 + m.x * 0.6, cs = Math.cos(ry), sn = Math.sin(ry);
    pts.rotation.y = ry;
    pts.rotation.x = -m.y * 0.18 + Math.sin(t * 0.5) * 0.05;
    const hh = Math.tan((cam.fov * Math.PI) / 360) * cam.position.z;
    const mxw = m.x * hh * cam.aspect, myw = m.y * hh, ease = 0.045 + (1 - burst) * 0.03;
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      let x = pos[j], y = pos[j + 1], z = pos[j + 2];
      if (tg) {
        const sp = burst * 0.015;
        x += (tg.pos[j] + Math.sin(t * 1.7 + seed[i]) * 0.012 - x) * ease + Math.sin(seed[i] * 3 + t * 4) * sp;
        y += (tg.pos[j + 1] + Math.cos(t * 1.3 + seed[i]) * 0.012 - y) * ease;
        z += (tg.pos[j + 2] - z) * ease + Math.cos(seed[i] * 5 + t * 4) * sp;
        col[j] += (tg.col[j] - col[j]) * 0.06;
        col[j + 1] += (tg.col[j + 1] - col[j + 1]) * 0.06;
        col[j + 2] += (tg.col[j + 2] - col[j + 2]) * 0.06;
      } else {
        x += Math.sin(t + seed[i]) * 0.004;
        y += Math.cos(t * 0.8 + seed[i]) * 0.004;
      }
      if (m.h > 0.05) {
        const wx = x * cs + z * sn, ddx = wx - mxw, ddy = y - myw, dd = ddx * ddx + ddy * ddy;
        if (dd < 0.8) {
          const l = Math.sqrt(dd) || 1, f = (0.8 - dd) * 0.22 * m.h;
          x += (ddx / l) * f * cs; z += (ddx / l) * f * sn; y += (ddy / l) * f;
        }
      }
      pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    r.render(scene, cam);
  };
  loop();

  // Pause while the hero is scrolled out of view.
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) { prev = performance.now(); raf = requestAnimationFrame(loop); }
  });
  io.observe(el);

  // Models load one after another; each joins the rotation as it arrives.
  (async () => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    for (const [id, url] of MODELS) {
      if (dead) return;
      try {
        const g = await loader.loadAsync(url);
        if (dead) return;
        targets[id] = sample(g.scene, N, fit);
        g.scene.traverse((o) => { o.geometry?.dispose(); });
        order.push(id);
        if (cur < 0) { cur = MODELS.findIndex(([mid]) => mid === id); switchAt = now; }
      } catch (e) {
        console.warn('hero model', id, e);
      }
    }
  })();

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    host.removeEventListener('pointermove', pm);
    host.removeEventListener('pointerleave', pl);
    geo.dispose();
    mat.dispose();
    tex.dispose();
    r.dispose();
    r.domElement.remove();
  };
}
