import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════
   Dynamic print texture for the 3D t-shirt (FRONT_PRINT panel)

   Coordinate system
   ─────────────────
   The offscreen "design canvas" uses the SAME coordinate system as the
   Konva editor print area (top-left origin, Y down). We only scale it up
   by a constant factor for texture resolution — no letterboxing, no
   remapping — so a point at (x, y) in the editor lands at (x * S, y * S)
   on the texture.

   The canvas is then mapped onto the FRONT_PRINT mesh using that mesh's
   REAL UV bounds (measured from the loaded glb at runtime — see
   ShirtViewer3D). We do not guess UV rectangles here.
═══════════════════════════════════════════════════════════ */

export const EDITOR_W = 326;
export const EDITOR_H = 500;

export const TEX_SCALE = 4;

export const TEX_W = EDITOR_W * TEX_SCALE;
export const TEX_H = EDITOR_H * TEX_SCALE;

export const FRONT_PRINT_UV_FALLBACK = {
  minU: -0.1244,
  maxU: 1.1055,
  minV: -0.5181,
  maxV: 1.5387,
};

export function createShirtCanvas() {
  const c = document.createElement('canvas');

  c.width = TEX_W;
  c.height = TEX_H;

  return c;
}

const imgCache = new Map();

function loadImage(src) {
  if (!src) {
    return Promise.resolve(null);
  }

  if (imgCache.has(src)) {
    return Promise.resolve(
      imgCache.get(src)
    );
  }

  return new Promise((resolve) => {
    const im = new Image();

    im.crossOrigin = 'anonymous';

    im.onload = () => {
      imgCache.set(src, im);
      resolve(im);
    };

    im.onerror = () => {
      resolve(null);
    };

    im.src = src;
  });
}

function getImageBaseSize(
  img,
  node = {}
) {
  const naturalW =
    img.naturalWidth || 1;

  const naturalH =
    img.naturalHeight || 1;

  const aspect =
    naturalW / naturalH;

  let width = node.width;
  let height = node.height;

  if (!width && !height) {
    const box = 140;

    if (aspect >= 1) {
      width = box;
      height = box / aspect;
    } else {
      height = box;
      width = box * aspect;
    }
  } else if (
    width &&
    !height
  ) {
    height = width / aspect;
  } else if (
    !width &&
    height
  ) {
    width = height * aspect;
  }

  return {
    width,
    height,
  };
}

/* ═══════════════════════════════════════════════════════════
   TEXT HELPERS
═══════════════════════════════════════════════════════════ */

function buildCanvasFont(
  node,
  scaledFontSize
) {
  const fontStyle =
    node.fontStyle === 'italic'
      ? 'italic'
      : 'normal';

  const fontWeight =
    node.fontWeight === 'bold'
      ? 'bold'
      : 'normal';

  const fontFamily =
    node.fontFamily ||
    'Arial';

  return `${fontStyle} ${fontWeight} ${scaledFontSize}px "${fontFamily}", Arial, sans-serif`;
}

function drawTextWithSpacing(
  ctx,
  text,
  x,
  y,
  letterSpacing
) {
  const value =
    String(text ?? '');

  if (
    !letterSpacing ||
    value.length <= 1
  ) {
    ctx.fillText(
      value,
      x,
      y
    );

    return;
  }

  let cursorX = x;

  for (
    let i = 0;
    i < value.length;
    i += 1
  ) {
    const char =
      value[i];

    ctx.fillText(
      char,
      cursorX,
      y
    );

    cursorX +=
      ctx.measureText(char)
        .width +
      letterSpacing;
  }
}

/**
 * Images and texts in drawing order (bottom first). Objects carry an optional
 * numeric `z`; ones without it (designs made before layer ordering) keep the
 * old order: every image below every text, each in array order.
 */
export function sortByStack(images = [], textObjects = []) {
  return [
    ...images.map((node, i) => ({ kind: 'image', node, i, z: node.z ?? -2 })),
    ...textObjects.map((node, i) => ({ kind: 'text', node, i: images.length + i, z: node.z ?? -1 })),
  ].sort((a, b) => a.z - b.z || a.i - b.i);
}

/* ═══════════════════════════════════════════════════════════
   MAIN RENDER
═══════════════════════════════════════════════════════════ */

export async function renderShirtCanvas(
  canvas,
  design = {}
) {
  const {
    shirtColor = '#ffffff',
    images = [],
    textObjects = [],
  } = design;

  const ctx =
    canvas.getContext('2d');

  if (!ctx) {
    return;
  }

  const S = TEX_SCALE;

  ctx.setTransform(
    1,
    0,
    0,
    1,
    0,
    0
  );

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.imageSmoothingEnabled =
    true;

  ctx.imageSmoothingQuality =
    'high';

  ctx.fillStyle =
    shirtColor;

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  // Web fonts must be loaded before the canvas can draw with them;
  // otherwise text falls back to Arial until the next redraw.
  if (typeof document !== 'undefined' && document.fonts) {
    await Promise.all(
      textObjects.map((node) =>
        document.fonts
          .load(buildCanvasFont(node, 40), node.text || 'Aა')
          .catch(() => null)
      )
    );
  }

  const loadedImages =
    await Promise.all(
      images.map((img) =>
        loadImage(img.src)
      )
    );

  const imageByNode =
    new Map(
      images.map((node, idx) => [
        node,
        loadedImages[idx],
      ])
    );

  // One pass in stacking order, so layers can be reordered across types.
  sortByStack(images, textObjects).forEach(
    ({ kind, node }) => {
      if (kind === 'image') {
        drawImageNode(ctx, node, imageByNode.get(node), S);
      } else {
        drawTextNode(ctx, node, S);
      }
    }
  );
}

function drawImageNode(ctx, node, img, S) {
  if (!img) {
    return;
  }

  const {
    width: boxW,
    height: boxH,
  } =
    getImageBaseSize(
      img,
      node
    );

  const scale =
    node.scale ??
    node.scaleX ??
    1;

  const rotation =
    node.rotation ?? 0;

  const opacity =
    node.opacity ?? 1;

  const x =
    node.x ?? 0;

  const y =
    node.y ?? 0;

  ctx.save();

  ctx.globalAlpha =
    opacity;

  ctx.translate(
    x * S,
    y * S
  );

  ctx.rotate(
    (rotation *
      Math.PI) /
      180
  );

  ctx.scale(
    scale,
    scale
  );

  ctx.drawImage(
    img,
    0,
    0,
    boxW * S,
    boxH * S
  );

  ctx.restore();
}

function drawTextNode(ctx, node, S) {
  if (!node.text) {
    return;
  }

  const x =
    node.x ?? 0;

  const y =
    node.y ?? 0;

  const rotation =
    node.rotation ?? 0;

  const fontSize =
    node.fontSize ?? 28;

  const lineHeight =
    Math.max(
      0.1,
      node.lineHeight ?? 1
    );

  const letterSpacing =
    (node.letterSpacing ??
      0) * S;

  const textScaleX =
    node.textScaleX ?? 1;

  const textScaleY =
    node.textScaleY ?? 1;

  const opacity =
    node.opacity ?? 1;

  ctx.save();

  ctx.globalAlpha =
    opacity;

  ctx.translate(
    x * S,
    y * S
  );

  ctx.rotate(
    (rotation *
      Math.PI) /
      180
  );

  ctx.scale(
    textScaleX,
    textScaleY
  );

  ctx.fillStyle =
    node.fill ||
    '#000000';

  ctx.textBaseline =
    'top';

  ctx.font =
    buildCanvasFont(
      node,
      fontSize * S
    );

  const lines =
    String(
      node.text
    ).split('\n');

  lines.forEach(
    (line, i) => {
      const lineY =
        i *
        fontSize *
        lineHeight *
        S;

      drawTextWithSpacing(
        ctx,
        line,
        0,
        lineY,
        letterSpacing
      );
    }
  );

  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════
   PRINT FILE
   Transparent PNG of the artwork only (no garment colour), in the
   same editor coordinate space, at TEX_SCALE resolution.
═══════════════════════════════════════════════════════════ */

export async function renderPrintFile(design = {}) {
  const canvas = createShirtCanvas();
  const visible = (item) => item.visible !== false;

  await renderShirtCanvas(canvas, {
    shirtColor: 'rgba(0,0,0,0)',
    images: (design.images || []).filter(visible),
    textObjects: (design.texts || []).filter(visible),
  });

  return canvas.toDataURL('image/png');
}

/* ═══════════════════════════════════════════════════════════
   TEXTURE CONFIG
═══════════════════════════════════════════════════════════ */

export function applyPrintTextureProps(
  texture,
  uvBounds
) {
  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.flipY = false;

  texture.wrapS =
    THREE.ClampToEdgeWrapping;

  texture.wrapT =
    THREE.ClampToEdgeWrapping;

  texture.minFilter =
    THREE.LinearMipmapLinearFilter;

  texture.magFilter =
    THREE.LinearFilter;

  texture.generateMipmaps =
    true;

  const b =
    uvBounds ||
    FRONT_PRINT_UV_FALLBACK;

  const spanU =
    b.maxU - b.minU;

  const spanV =
    b.maxV - b.minV;

  const isIdentity =
    Math.abs(
      b.minU
    ) < 1e-3 &&
    Math.abs(
      b.minV
    ) < 1e-3 &&
    Math.abs(
      spanU - 1
    ) < 1e-3 &&
    Math.abs(
      spanV - 1
    ) < 1e-3;

  if (
    isIdentity ||
    !spanU ||
    !spanV
  ) {
    texture.repeat.set(
      1,
      1
    );

    texture.offset.set(
      0,
      0
    );
  } else {
    texture.repeat.set(
      1 / spanU,
      1 / spanV
    );

    texture.offset.set(
      -b.minU / spanU,
      -b.minV / spanV
    );
  }

  texture.needsUpdate =
    true;

  return texture;
}

/* ═══════════════════════════════════════════════════════════
   UV BOUNDS
═══════════════════════════════════════════════════════════ */

export function computeUvBounds(
  geometry
) {
  const uv =
    geometry?.attributes?.uv;

  if (!uv) {
    return null;
  }

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;

  for (
    let i = 0;
    i < uv.count;
    i += 1
  ) {
    const u =
      uv.getX(i);

    const v =
      uv.getY(i);

    if (u < minU) {
      minU = u;
    }

    if (u > maxU) {
      maxU = u;
    }

    if (v < minV) {
      minV = v;
    }

    if (v > maxV) {
      maxV = v;
    }
  }

  if (
    !Number.isFinite(minU) ||
    !Number.isFinite(minV)
  ) {
    return null;
  }

  return {
    minU,
    maxU,
    minV,
    maxV,
  };
}