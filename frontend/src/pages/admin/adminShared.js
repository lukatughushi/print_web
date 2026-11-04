// Shared helpers for the admin panel pages.
import api, { getErrorMessage } from '../../lib/api';

export const ORDER_STATUSES = [
  { key: 'PENDING', label: 'ახალი', tone: 'pink' },
  { key: 'PRINTING', label: 'ბეჭდვაში', tone: 'amber' },
  { key: 'READY_FOR_PICKUP', label: 'მზადაა', tone: 'blue' },
  { key: 'SHIPPED', label: 'გაგზავნილი', tone: 'violet' },
  { key: 'COMPLETED', label: 'დასრულებული', tone: 'green' },
  { key: 'CANCELLED', label: 'გაუქმებული', tone: 'grey' },
];

export const STATUS_BY_KEY = Object.fromEntries(ORDER_STATUSES.map((s) => [s.key, s]));

export const PAYMENT_LABELS = {
  cash: 'კურიერთან',
  card: 'ბარათით',
  bog: 'განვადება',
  transfer: 'გადმორიცხვით',
};

export function gel(amount) {
  const n = Number(amount) || 0;
  return `${n.toLocaleString('ka-GE', { maximumFractionDigits: 2 })} ₾`;
}

// Spelled out here: browsers don't always ship Georgian month names.
const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];

export function shortDate(value, withTime = false) {
  if (!value) return '—';
  // 'YYYY-MM-DD' strings are calendar days; don't shift them by time zone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (!withTime) return d.getFullYear() === new Date().getFullYear() ? date : `${date} ${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date}, ${time}`;
}

// Shop photos and hero designs are shown at most ~800 px wide.
const MAX_SIDE = 1600;

/**
 * Shrinks a photo to at most 1600 px and re-encodes it as WebP (keeping
 * transparency), so the shop doesn't ship 10 MB PNGs. Falls back to the
 * original when the browser can't, or when it is already smaller.
 */
async function compressImage(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * k);
    canvas.height = Math.round(bitmap.height * k);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((done) => canvas.toBlob(done, 'image/webp', 0.85));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '') + '.webp', { type: 'image/webp' });
  } catch {
    return file;
  }
}

/** Uploads an admin image (product photo, hero design) to GridFS and returns its file id. */
export async function uploadImage(file) {
  const form = new FormData();
  form.append('file', await compressImage(file));
  const { data } = await api.post('/api/files', form);
  return data.id;
}

export { getErrorMessage };
