const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Customer design assets (uploaded artwork, previews, print files) are written
// here instead of being stored as base64 inside the database.
const DESIGN_DIR = path.join(__dirname, '../../uploads/designs');
const PUBLIC_PREFIX = '/uploads/designs';

const MAX_FILE_BYTES = 15 * 1024 * 1024;

// SVG is deliberately excluded: it is served from the API origin and can carry script.
const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const DATA_URL_RE = /^data:([a-z0-9.+/-]+);base64,(.+)$/is;

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

// Writes a base64 data URL to disk and returns its public path.
// `written` collects absolute paths so the caller can roll back on failure.
function saveDataUrl(dataUrl, label, written) {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) throw new Error('Invalid image data');

  const mime = match[1].toLowerCase();
  const ext = EXTENSIONS[mime];
  if (!ext) throw new Error(`Unsupported image type: ${mime}`);

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw new Error('Empty image data');
  if (buffer.length > MAX_FILE_BYTES) throw new Error('Image is too large (max 15 MB)');

  if (!fs.existsSync(DESIGN_DIR)) fs.mkdirSync(DESIGN_DIR, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${label}.${ext}`;
  const filePath = path.join(DESIGN_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  written.push(filePath);

  return `${PUBLIC_PREFIX}/${filename}`;
}

function removeFiles(paths) {
  for (const p of paths) fs.unlink(p, () => {});
}

// Normalizes a design sent by the storefront and moves every embedded image to disk.
// Returns { canvasJson, previewUrl } ready for prisma.design.create.
function persistDesign(design, written) {
  let canvas = design.canvasJson;
  if (typeof canvas === 'string') {
    try {
      canvas = JSON.parse(canvas);
    } catch {
      throw new Error('Design data is not valid JSON');
    }
  }
  if (!canvas || typeof canvas !== 'object' || Array.isArray(canvas)) {
    throw new Error('Design data must be an object');
  }

  const images = Array.isArray(canvas.images) ? canvas.images : [];
  const texts = Array.isArray(canvas.texts) ? canvas.texts : [];

  const savedImages = images.map((img, i) => {
    if (!img || typeof img !== 'object') throw new Error('Invalid design image');
    return isDataUrl(img.src)
      ? { ...img, src: saveDataUrl(img.src, `art${i + 1}`, written) }
      : img;
  });

  const printUrl = isDataUrl(design.printUrl)
    ? saveDataUrl(design.printUrl, 'print', written)
    : null;

  const previewUrl = isDataUrl(design.previewUrl)
    ? saveDataUrl(design.previewUrl, 'preview', written)
    : '';

  return {
    canvasJson: { ...canvas, images: savedImages, texts, printUrl },
    previewUrl,
  };
}

module.exports = { persistDesign, removeFiles };
