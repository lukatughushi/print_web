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

/** Uploads an image to GridFS and returns its file id. */
export async function uploadImage(file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/api/files', form);
  return data.id;
}

export { getErrorMessage };
