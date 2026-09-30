import { API_URL } from './config';

export const API_BASE = API_URL;

export const CATEGORY_LABELS = {
  TSHIRT: 'მაისური',
  HOODIE: 'ჰუდი',
  BAG: 'ჩანთა',
};

export const CATEGORY_EN = {
  TSHIRT: 'T-Shirt',
  HOODIE: 'Hoodie',
  BAG: 'Tote Bag',
};

// Resolve a server-hosted path (e.g. /uploads/...) to an absolute URL.
// Absolute and data: URLs are returned unchanged.
export function assetUrl(url) {
  if (!url) return null;
  return /^(https?:|data:)/.test(url) ? url : `${API_BASE}${url}`;
}

// Resolve a product's mockup image to an absolute URL (handles bare paths).
export function productImg(product) {
  return assetUrl(product?.mockupUrl);
}

// Mirrors server/src/lib/shipping.js; the fee itself comes from /api/settings.
export function shippingFor(subtotal, settings) {
  const freeFrom = settings.freeShipThreshold ?? 150;
  const fee = settings.shippingFee ?? 10;
  return subtotal === 0 || subtotal >= freeFrom ? 0 : fee;
}

export function money(amount, currency = '₾') {
  return `${Math.round(Number(amount) || 0)} ${currency}`;
}
