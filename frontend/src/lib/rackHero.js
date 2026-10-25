/**
 * Home hero art: a clothing rack. Garments on hangers slide in once their
 * models have loaded; hovering one turns it to face the viewer while its
 * neighbours make room. Ported from the design file (acrhi/rack-hero.js) to
 * the project's three.js, without the product panel.
 *
 * mountRack(el, { items, onReady, onEnter, minWait }) -> destroy()
 *   items: [{ model, hex }]; onReady(done, total) as models load;
 *   onEnter() when the garments start sliding in (at least minWait s).
 */
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const MODEL_URL = {
  tshirt: '/models-lite/tshirt.glb',
  hoodie: '/models-lite/hoodie.glb',
  polo: '/models-lite/polo.glb',
  longsleeve: '/models-lite/longsleeve.glb',
  'polo-ls': '/models-lite/polo-ls.glb',
  'hoodie-zip': '/models/hoodie_zip.glb',
};

const ROD_Y = 1.12;
const L = (a, b, k) => a + (b - a) * k;

export function mountRack(el, { items, onReady = () => {}, onEnter = () => {}, minWait = 0 }) {
  let dead = false;

  const r = new T.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y';
  el.appendChild(r.domElement);

  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(28, 1, 0.1, 100);
  // Framed close on the rack (the design showed it full screen).
  cam.position.set(0, 0.2, 4.6);
  scene.add(new T.HemisphereLight(0xffffff, 0xe8ddd2, 1.6));
  const key = new T.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new T.DirectionalLight(0xffe4ea, 0.8);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  // Rod (light metal, to read on the dark hero) and its end caps.
  const metal = new T.MeshStandardMaterial({ color: 0xa7afbd, metalness: 0.8, roughness: 0.3 });
  const rod = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 1, 24), metal);
  rod.rotation.z = Math.PI / 2;
  rod.position.y = ROD_Y;
  scene.add(rod);
  const caps = [0, 1].map(() => {
    const c = new T.Mesh(new T.SphereGeometry(0.04, 20, 20), metal);
    c.position.y = ROD_Y;
    scene.add(c);
    return c;
  });

  // Hanger: wooden bar, chrome stem and hook (bar and stem refit per garment).
  const hangerGeo = (() => {
    const bar = new T.CatmullRomCurve3([
      new T.Vector3(-0.36, -0.2, 0), new T.Vector3(-0.16, -0.12, 0), new T.Vector3(0, -0.07, 0),
      new T.Vector3(0.16, -0.12, 0), new T.Vector3(0.36, -0.2, 0),
    ]);
    const stem = new T.CylinderGeometry(0.008, 0.008, 0.11, 10);
    stem.translate(0, -0.015, 0);
    const hook = new T.TorusGeometry(0.045, 0.008, 10, 32, Math.PI * 1.35);
    hook.rotateZ(-Math.PI * 0.18);
    hook.translate(0, 0.085, 0);
    return [new T.TubeGeometry(bar, 40, 0.018, 10, false), stem, hook];
  })();
  const wood = new T.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.55 });
  const chrome = new T.MeshStandardMaterial({ color: 0xb9bec7, metalness: 0.9, roughness: 0.25 });
  const hitMat = new T.MeshBasicMaterial({ visible: false });
  const hitGeo = new T.BoxGeometry(0.75, 2, 0.75);

  const slots = items.map((it, i) => {
    const g = new T.Group(), pivot = new T.Group(), hang = new T.Group();
    g.add(pivot);
    pivot.add(hang);
    hangerGeo.forEach((geo, k) => hang.add(new T.Mesh(geo.clone(), k === 0 ? wood : chrome)));
    hang.position.y = -0.1;
    const hit = new T.Mesh(hitGeo, hitMat);
    hit.position.y = -1.1;
    hit.userData.i = i;
    g.add(hit);
    g.position.y = ROD_Y - 0.02;
    scene.add(g);
    return { it, g, pivot, hang, hit, model: null, mats: [], x: 0, ry: Math.PI / 2, drop: 0, seed: Math.random() * 6, fw: 1, sw: 0.5, sway: 0 };
  });

  // Hangers keep a fixed distance. The camera backs off to show the whole
  // rack, but only so far (garments stay readable); where it still doesn't
  // fit (narrow screens) the camera pans slowly along the rack instead.
  const SPACING = 1.05, MIN_Z = 4.6, MAX_Z = 6;
  const spacing = SPACING;
  let visW = 8, pan = 0;
  const layout = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    r.setSize(w, h, false);
    cam.aspect = w / h;
    const n = slots.length;
    rod.scale.y = SPACING * (n - 1) + 1.1;
    const needW = rod.scale.y + 1.3;
    const tanH = Math.tan((cam.fov * Math.PI) / 360);
    cam.position.z = Math.max(MIN_Z, Math.min(MAX_Z, needW / (2 * tanH * cam.aspect)));
    visW = 2 * tanH * cam.position.z * cam.aspect;
    pan = Math.max(0, (needW - visW) / 2);
    caps[0].position.x = -rod.scale.y / 2;
    caps[1].position.x = rod.scale.y / 2;
    cam.updateProjectionMatrix();
  };
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(el);

  // Fabric takes the garment colour, ribs a shade darker, buttons/zips stay dark.
  const tint = (s, hex) => {
    const c = new T.Color(hex);
    s.mats.forEach(({ m, kind }) => {
      if (kind === 'fabric') m.color.copy(c);
      else if (kind === 'rib') m.color.copy(c).multiplyScalar(0.82);
    });
  };

  const rc = new T.Raycaster();
  const cast = (obj, o, d) => {
    rc.set(o, d);
    rc.far = 3;
    return rc.intersectObject(obj, true).filter((x) => x.object.visible)[0] || null;
  };

  // Shapes the hanger to the garment's shoulders (cached per model).
  const FC = {};
  const fitHanger = (s, wrap) => {
    const id = s.it.model, fc = FC[id];
    const [bar, stem] = s.hang.children;
    if (fc) {
      if (fc.sh) { wrap.children[0].position.z -= fc.sh; wrap.updateMatrixWorld(true); }
      bar.geometry = fc.bar;
      stem.geometry = fc.stem;
      return;
    }
    FC[id] = { sh: 0 };
    // Centre the hanger in the neck opening, front to back.
    const deep = [];
    for (let z = -0.4; z <= 0.4; z += 0.02) {
      const hh = cast(wrap, new T.Vector3(0, 0.4, z), new T.Vector3(0, -1, 0));
      deep.push([z, hh ? hh.point.y : -9]);
    }
    const mn = Math.min(...deep.map((d) => d[1]));
    const zs = deep.filter((d) => d[1] <= mn + 0.05).map((d) => d[0]);
    if (zs.length && mn < -0.25) {
      const sh = Math.max(-0.15, Math.min(0.15, (Math.min(...zs) + Math.max(...zs)) / 2));
      FC[id].sh = sh;
      wrap.children[0].position.z -= sh;
      wrap.updateMatrixWorld(true);
    }
    // Width: a little inside the shoulders.
    const side = (dir) => {
      let best = null;
      for (const y of [-0.75, -0.85, -0.95]) {
        const hh = cast(wrap, new T.Vector3(0, y, 0), new T.Vector3(dir, 0, 0));
        if (hh && (best === null || hh.distance < best)) best = hh.distance;
      }
      return best;
    };
    const half = Math.min(side(-1) ?? 0.4, side(1) ?? 0.4);
    const hw = Math.max(0.16, Math.min(0.5, half * 0.86));
    // Bar follows the inside of the shoulder line.
    const pts = [];
    for (let i = 0; i < 11; i++) {
      const x = -hw + (2 * hw * i) / 10;
      if (Math.abs(x) < 0.06) continue;
      const hh = cast(wrap, new T.Vector3(x, -0.6, 0), new T.Vector3(0, 1, 0));
      let y = hh ? hh.point.y - 0.03 : null;
      if (y !== null && y > -0.02) y = -0.02;
      pts.push([x, y]);
    }
    if (!pts.some((p) => p[1] !== null)) { delete FC[id]; return; }
    pts.forEach((p) => {
      if (p[1] !== null) return;
      const nb = pts.filter((q) => q[1] !== null).sort((a, b) => Math.abs(a[0] - p[0]) - Math.abs(b[0] - p[0]))[0];
      p[1] = nb[1];
    });
    for (let it = 0; it < 2; it++) {
      for (let i = 1; i < pts.length - 1; i++) pts[i][1] = (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4;
    }
    const mid = (pts.length / 2) | 0, cy = Math.max(pts[mid - 1][1], pts[mid][1]) + 0.02;
    const curve = new T.CatmullRomCurve3([
      ...pts.slice(0, mid).map((p) => new T.Vector3(p[0], p[1], 0)),
      new T.Vector3(0, cy, 0),
      ...pts.slice(mid).map((p) => new T.Vector3(p[0], p[1], 0)),
    ]);
    bar.geometry = new T.TubeGeometry(curve, 48, 0.016, 10, false);
    const top = 0.06, len = top - cy;
    const sg = new T.CylinderGeometry(0.008, 0.008, len, 10);
    sg.translate(0, cy + len / 2, 0);
    stem.geometry = sg;
    Object.assign(FC[id], { bar: bar.geometry, stem: sg });
  };

  // Puts one copy of a loaded model on its hanger: own materials, upright,
  // 1.7 units tall, hanging from the top centre.
  const build = (src, s) => {
    const m = src.clone(true);
    m.traverse((o) => {
      if (!o.isMesh) return;
      const om = Array.isArray(o.material) ? o.material[0] : o.material;
      const mn = om?.name || '';
      const kind = /button|zipper|zip_pull|slider|tip|metal|eyelet|aglet|^Material\d/i.test(mn)
        ? 'detail'
        : /rib|cuff|collar|cord|string/i.test(`${mn} ${o.name}`) ? 'rib' : 'fabric';
      const nm = new T.MeshStandardMaterial({
        color: kind === 'detail' ? 0x2b2b2b : 0xffffff,
        roughness: kind === 'detail' ? 0.4 : 0.92,
        metalness: kind === 'detail' ? 0.4 : 0,
        normalMap: om?.normalMap || null,
        side: T.DoubleSide,
      });
      o.material = nm;
      s.mats.push({ m: nm, kind });
    });
    const wrap = new T.Group();
    wrap.add(m);
    let b = new T.Box3().setFromObject(wrap), sz = b.getSize(new T.Vector3());
    if (sz.z > sz.y * 1.15) {
      // Exported lying down: stand it up.
      m.rotation.x = -Math.PI / 2;
      b = new T.Box3().setFromObject(wrap);
      sz = b.getSize(new T.Vector3());
    }
    m.scale.multiplyScalar(1.7 / sz.y);
    b = new T.Box3().setFromObject(wrap);
    const fsz = b.getSize(new T.Vector3());
    s.fw = fsz.x;
    s.sw = fsz.z;
    const c = b.getCenter(new T.Vector3());
    m.position.x -= c.x;
    m.position.z -= c.z;
    m.position.y -= b.max.y;
    wrap.position.y = -0.035;
    wrap.updateMatrixWorld(true);
    fitHanger(s, wrap);
    s.hang.add(wrap);
    s.model = wrap;
    tint(s, s.it.hex);
  };

  // Hover: the garment under the pointer turns to the front.
  let hover = -1;
  const pick = (e) => {
    const b = r.domElement.getBoundingClientRect();
    const p = new T.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    const ray = new T.Raycaster();
    ray.setFromCamera(p, cam);
    const h = ray.intersectObjects(slots.filter((s) => s.model).map((s) => s.hit))[0];
    return h ? h.object.userData.i : -1;
  };
  const pm = (e) => { if (e.pointerType !== 'touch') hover = pick(e); };
  const pl = () => { hover = -1; };
  const pd = (e) => { if (e.pointerType === 'touch') hover = pick(e); };
  r.domElement.addEventListener('pointermove', pm);
  r.domElement.addEventListener('pointerleave', pl);
  r.domElement.addEventListener('pointerdown', pd);

  let raf = 0, visible = true, clock = 0, prev = performance.now(), enterT = -1, started = false, errored = false;
  let camX = 0, panPhase = 0;
  const step = () => {
    const nowMs = performance.now();
    const dt = Math.min(0.05, (nowMs - prev) / 1000);
    prev = nowMs;
    clock += dt;
    const t = clock;
    const kh = 1 - Math.pow(0.025, dt);
    const n = slots.length;

    // Resting positions; around a hovered garment the others shift to make room.
    const base = slots.map((s, i) => (i - (n - 1) / 2) * spacing), TX = base.slice();
    if (hover >= 0) {
      const wd = (j) => (j === hover ? slots[j].fw * 0.5 : slots[j].sw * 0.5), gap = 0.05;
      for (let j = hover + 1; j < n; j++) TX[j] = Math.max(base[j], TX[j - 1] + wd(j - 1) + wd(j) + gap);
      for (let j = hover - 1; j >= 0; j--) TX[j] = Math.min(base[j], TX[j + 1] - wd(j + 1) - wd(j) - gap);
      const lim = rod.scale.y / 2 - 0.05, lo = TX[0] - wd(0), hi = TX[n - 1] + wd(n - 1);
      let sh = 0;
      if (lo < -lim) sh = -lim - lo;
      if (hi + sh > lim) sh -= hi + sh - lim;
      if (hi - lo > 2 * lim) {
        const sc = (2 * lim - wd(0) - wd(n - 1)) / (TX[n - 1] - TX[0] || 1), c0 = TX[0];
        for (let j = 0; j < n; j++) TX[j] = -lim + wd(0) + (TX[j] - c0) * sc;
      } else {
        for (let j = 0; j < n; j++) TX[j] += sh;
      }
    }

    if (!started) { slots.forEach((s) => { s.x = -visW / 2 - 1.2; s.lx = s.x; }); started = true; }
    const allIn = slots.every((s) => s.model);
    if (enterT < 0 && ((allIn && t > minWait) || t > 9)) { enterT = t + 0.5; onEnter(); }

    // Slow pan along a rack wider than the view; holds while a garment is hovered.
    if (pan > 0 && enterT >= 0 && t > enterT + 2 && hover < 0) panPhase += dt * Math.max(0.05, 0.3 / pan);
    camX = L(camX, pan * Math.sin(panPhase), kh);
    cam.position.x = camX;
    cam.lookAt(camX, 0.2, 0);

    slots.forEach((s, i) => {
      const entered = enterT >= 0 && t > enterT + (n - 1 - i) * 0.11;
      const tx = entered ? TX[i] : -visW / 2 - 1.2;
      const front = i === hover;
      const ov = s.vx || 0;
      s.x = entered && !s.inDone ? L(s.x, tx, 1 - Math.pow(0.06, dt)) : L(s.x, tx, kh);
      if (entered && Math.abs(s.x - tx) < 0.01) s.inDone = true;
      s.vx = (s.x - (s.lx ?? s.x)) / Math.max(dt, 1e-3);
      s.lx = s.x;
      // Swing from the slide's acceleration.
      const acc = (s.vx - ov) / Math.max(dt, 1e-3);
      s.av = (s.av || 0) + (-acc * 0.006 - s.sway * 26 - (s.av || 0) * 4.2) * dt;
      s.sway = Math.max(-0.09, Math.min(0.09, s.sway + s.av * dt));
      s.g.position.x = s.x;
      s.g.position.z = L(s.g.position.z, front ? 0.05 : 0, kh);
      s.ry = L(s.ry, front ? 0 : Math.PI / 2, kh * 0.85);
      s.pivot.rotation.y = s.ry;
      s.pivot.rotation.z = Math.sin(t * 1.1 + s.seed) * 0.018 + s.sway;
      s.g.visible = !!s.model && entered;
    });
    r.render(scene, cam);
  };
  const loop = () => {
    raf = visible ? requestAnimationFrame(loop) : 0;
    try { step(); } catch (e) { if (!errored) { errored = true; console.error('rack loop', e); } }
  };
  loop();

  // Pause while the hero is scrolled out of view.
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) { prev = performance.now(); raf = requestAnimationFrame(loop); }
  });
  io.observe(el);

  (async () => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const ids = [...new Set(items.map((x) => x.model))];
    let done = 0;
    await Promise.all(ids.map(async (id) => {
      try {
        const g = await loader.loadAsync(MODEL_URL[id]);
        const list = slots.filter((s) => s.it.model === id);
        for (let i = 0; i < list.length; i++) {
          if (dead) return;
          build(g.scene, list[i]);
          // One garment per frame, so the page doesn't stall.
          if (i < list.length - 1) await new Promise((res) => requestAnimationFrame(res));
        }
      } catch (e) {
        console.warn('rack model', id, e);
      }
      if (dead) return;
      done++;
      onReady(done, ids.length);
    }));
  })();

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    r.domElement.removeEventListener('pointermove', pm);
    r.domElement.removeEventListener('pointerleave', pl);
    r.domElement.removeEventListener('pointerdown', pd);
    scene.traverse((o) => {
      o.geometry?.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose());
    });
    r.dispose();
    r.domElement.remove();
  };
}
