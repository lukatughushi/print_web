// Print placement for the print team, rebuilt from an order's saved layers:
// the garment (front or back) with the print area outlined and the artwork
// drawn exactly where the customer put it, plus the artwork-only print file.

import { EDITOR_H, EDITOR_W, createShirtCanvas, renderPrintFile, renderShirtCanvas } from './shirtTexture';

import tshirtFront from '../assets/Product_img/basic_tshirt_front.png';
import tshirtBack from '../assets/Product_img/basic_tshirt_back.png';
import longFront from '../assets/Product_img/long_sleeve_front.png';
import longBack from '../assets/Product_img/long_sleeve_back.png';
import hoodieFront from '../assets/Product_img/hoodies_sweatshirt_front.png';
import hoodieBack from '../assets/Product_img/hoodies_sweatshirt_back.png';
import bagFront from '../assets/Product_img/bag_front.png';
import bagBack from '../assets/Product_img/bag_back.png';
import hat from '../assets/Product_img/hat.png';
import pillow from '../assets/Product_img/pillow.png';
import mug from '../assets/shop/mug.webp';

// Print area on each flat photo, as fractions of the photo: left, top, width.
// The height follows the editor's 326×500 print area.
const SHIRT = { front: [tshirtFront, 0.31, 0.21, 0.38], back: [tshirtBack, 0.3, 0.19, 0.4] };
const LONG = { front: [longFront, 0.33, 0.2, 0.34], back: [longBack, 0.32, 0.18, 0.36] };
const HOODIE = { front: [hoodieFront, 0.34, 0.27, 0.32], back: [hoodieBack, 0.31, 0.24, 0.38] };
const GARMENTS = {
  tshirt: SHIRT,
  polo: SHIRT,
  longsleeve: LONG,
  polo_ls: LONG,
  bomber: LONG,
  hoodie: HOODIE,
  zip_hoodie: HOODIE,
  bag: { front: [bagFront, 0.25, 0.42, 0.5], back: [bagBack, 0.25, 0.42, 0.5] },
  cap: { front: [hat, 0.3, 0.12, 0.4] },
  mug: { front: [mug, 0.25, 0.12, 0.5] },
  pillow: { front: [pillow, 0.25, 0.1, 0.5] },
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

/** The front or back half of saved editor layers ({ images, texts }). */
export function sideLayers(layers, side) {
  const part = side === 'back' ? layers?.back : layers;
  const visible = (item) => item.visible !== false;
  return {
    images: (part?.images || []).filter(visible),
    texts: (part?.texts || []).filter(visible),
  };
}

export const hasArtwork = (part) => part.images.length > 0 || part.texts.length > 0;

/**
 * Garment photo with the print area (dashed) and the artwork in place.
 * Returns a PNG data URL, or null when the side has no artwork.
 */
export async function renderPlacement(layers, side) {
  const part = sideLayers(layers, side);
  if (!hasArtwork(part)) return null;

  const garment = GARMENTS[layers?.garment] ?? SHIRT;
  const [photoSrc, left, top, width] = garment[side] ?? garment.front;
  const photo = await loadImage(photoSrc);

  const SCALE = 2;
  const out = document.createElement('canvas');
  out.width = photo.naturalWidth * SCALE;
  out.height = photo.naturalHeight * SCALE;
  const ctx = out.getContext('2d');
  // The garment photos are a see-through shading layer on an opaque white
  // background, so the ordered colour goes underneath (as in the editor).
  const color = /^#[0-9a-f]{6}$/i.test(layers?.garmentColor || '') ? layers.garmentColor : '#ffffff';
  ctx.fillStyle = color.toLowerCase() === '#ffffff' ? '#f3f3f3' : color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(photo, 0, 0, out.width, out.height);

  const box = {
    x: out.width * left,
    y: out.height * top,
    w: out.width * width,
  };
  box.h = (box.w * EDITOR_H) / EDITOR_W;

  // The printable rectangle inside the editor area (3D models report a
  // clean area smaller than the whole surface); outline it.
  const safe = layers?.printSafe?.[side];
  const kx = box.w / EDITOR_W;
  const ky = box.h / EDITOR_H;
  const area = safe
    ? { x: box.x + safe.x * kx, y: box.y + safe.y * ky, w: safe.width * kx, h: safe.height * ky }
    : { x: box.x, y: box.y, w: box.w, h: box.h };

  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(239, 95, 122, .9)';
  ctx.fillStyle = 'rgba(239, 95, 122, .06)';
  ctx.fillRect(area.x, area.y, area.w, area.h);
  ctx.strokeRect(area.x, area.y, area.w, area.h);
  ctx.restore();

  // Artwork, rendered in editor space and scaled into the print area.
  const art = createShirtCanvas();
  await renderShirtCanvas(art, { shirtColor: 'rgba(0,0,0,0)', images: part.images, textObjects: part.texts });
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();
  ctx.drawImage(art, box.x, box.y, box.w, box.h);
  ctx.restore();

  return out.toDataURL('image/png');
}

/** Artwork-only PNG for one side (trimmed), or null. */
export function renderSidePrint(layers, side) {
  const part = sideLayers(layers, side);
  return hasArtwork(part) ? renderPrintFile(part, layers?.printSafe?.[side]) : null;
}

/**
 * Frames a WebGL canvas (transparent around the product) into a W×H JPEG,
 * cropped to the product so the print is clearly visible.
 */
export function snapshotProduct(glCanvas, W = 600, H = 750) {
  let src = { x: 0, y: 0, w: glCanvas.width, h: glCanvas.height };
  const probe = document.createElement('canvas');
  probe.width = glCanvas.width;
  probe.height = glCanvas.height;
  const pctx = probe.getContext('2d');
  pctx.drawImage(glCanvas, 0, 0);
  const data = pctx.getImageData(0, 0, probe.width, probe.height).data;
  let minX = probe.width, minY = probe.height, maxX = -1, maxY = -1;
  for (let y = 0; y < probe.height; y += 2) {
    for (let x = 0; x < probe.width; x += 2) {
      if (data[(y * probe.width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nothing drawn yet
  const fullyOpaque = minX === 0 && minY === 0 && maxX >= probe.width - 2 && maxY >= probe.height - 2;
  if (!fullyOpaque) {
    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.06);
    const x0 = Math.max(0, minX - pad);
    const y0 = Math.max(0, minY - pad);
    src = { x: x0, y: y0, w: Math.min(probe.width, maxX + pad) - x0, h: Math.min(probe.height, maxY + pad) - y0 };
  }
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const fit = Math.min(W / src.w, H / src.h);
  const w = src.w * fit;
  const h = src.h * fit;
  ctx.drawImage(glCanvas, src.x, src.y, src.w, src.h, (W - w) / 2, (H - h) / 2, w, h);
  return out.toDataURL('image/jpeg', 0.85);
}
