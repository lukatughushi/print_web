import { useEffect, useRef, useState } from 'react';
import ShirtViewer3D from '../../components/ShirtViewer3D';
import { createShirtCanvas, renderShirtCanvas } from '../../lib/shirtTexture';
import { hasArtwork, sideLayers, snapshotProduct } from '../../lib/placement';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The camera eases between the front and back views.
const CAMERA_SETTLE_MS = 1800;
const MODEL_TIMEOUT_MS = 20000;

// One 3D render at a time: each needs its own WebGL context.
let queue = Promise.resolve();

/**
 * Renders an order item's design on its 3D model off-screen and reports a
 * front and a back photo: onDone({ front, back }) with JPEG data URLs (null
 * for a side without artwork or if the model can't be drawn).
 */
export default function Snapshot3D({ layers, onDone }) {
  const [state, setState] = useState(null); // { front, back } texture canvases
  const [view, setView] = useState('front');
  const [resetKey, setResetKey] = useState(0);
  const boxRef = useRef(null);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; });

  useEffect(() => {
    let cancelled = false;
    let release;
    const turn = new Promise((r) => { release = r; });
    const mine = queue.then(async () => {
      if (cancelled) return;
      const color = /^#[0-9a-f]{6}$/i.test(layers?.garmentColor || '') ? layers.garmentColor : '#ffffff';
      const paint = async (side) => {
        const part = sideLayers(layers, side);
        const canvas = createShirtCanvas();
        await renderShirtCanvas(canvas, { shirtColor: color, images: part.images, textObjects: part.texts });
        return { canvas, has: hasArtwork(part) };
      };
      const front = await paint('front');
      const back = await paint('back');
      if (!cancelled) setState({ front, back, color });
      await turn; // held until the snapshots are taken
    });
    queue = mine.catch(() => {});
    return () => { cancelled = true; release?.(); };
  }, [layers]);

  // Once the viewer is mounted: wait for the model, photograph front, turn, photograph back.
  useEffect(() => {
    if (!state) return undefined;
    let cancelled = false;
    (async () => {
      const glCanvas = () => boxRef.current?.querySelector('canvas');
      const started = Date.now();
      let front = null;
      while (!cancelled && !front && Date.now() - started < MODEL_TIMEOUT_MS) {
        await sleep(400);
        const c = glCanvas();
        if (c) front = snapshotProduct(c);
      }
      if (cancelled) return;
      if (front) {
        await sleep(600); // textures settle after the first frame
        front = snapshotProduct(glCanvas()) ?? front;
      }
      let back = null;
      if (front && state.back.has) {
        setView('back');
        setResetKey((k) => k + 1);
        await sleep(CAMERA_SETTLE_MS);
        if (!cancelled) back = snapshotProduct(glCanvas());
      }
      if (!cancelled) doneRef.current({ front: state.front.has ? front : null, back });
    })();
    return () => { cancelled = true; };
  }, [state]);

  if (!state) return null;
  return (
    <div
      ref={boxRef}
      aria-hidden="true"
      style={{ position: 'fixed', left: -10000, top: 0, width: 600, height: 750, pointerEvents: 'none' }}
    >
      <ShirtViewer3D
        color={state.color}
        designCanvas={state.front.canvas}
        designRev={1}
        backDesignCanvas={state.back.canvas}
        backDesignRev={1}
        view={view}
        viewResetKey={resetKey}
        interactive={false}
        productType={layers?.model || 'male'}
      />
    </div>
  );
}
