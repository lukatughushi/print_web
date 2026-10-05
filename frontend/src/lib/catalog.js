import { API_URL } from './config';

export const API_BASE = API_URL;

import imgTshirt from '../assets/shop/tshirt.webp';
import imgLongsleeve from '../assets/shop/longsleeve.webp';
import imgHoodie from '../assets/shop/hoodie.webp';
import imgBag from '../assets/shop/bag.webp';
import imgCap from '../assets/shop/cap.webp';
import imgMug from '../assets/shop/mug.webp';

// Storefront categories, in menu order. `code` is Product.category (must match
// backend/src/database/catalog.ts). `img` is a neutral cut-out that is tinted
// with the product colour when `tint` is true. `swatch` is the colour the
// category is shown in on category tiles.
// TODO: polo, zip hoodie and bomber reuse the closest garment photo until
// their own product shots exist.
export const CATEGORIES = [
  { code: 'TSHIRT', label: 'მაისური', plural: 'მაისურები', en: 'T-Shirt', img: imgTshirt, tint: true, swatch: 'white', group: 'tops' },
  { code: 'POLO', label: 'პოლო', plural: 'პოლოები', en: 'Polo', img: imgTshirt, tint: true, swatch: 'navy', group: 'tops' },
  { code: 'LONGSLEEVE', label: 'გრძელმკლავიანი მაისური', plural: 'გრძელმკლავიანები', en: 'Long Sleeve', img: imgLongsleeve, tint: true, swatch: 'sand', group: 'tops' },
  { code: 'POLO_LONGSLEEVE', label: 'გრძელმკლავიანი პოლო', plural: 'გრძელმკლავიანი პოლოები', en: 'Long Sleeve Polo', img: imgLongsleeve, tint: true, swatch: 'bottle', group: 'tops' },
  { code: 'HOODIE', label: 'ჰუდი ჯიბით', plural: 'ჰუდები ჯიბით', en: 'Hoodie', img: imgHoodie, tint: true, swatch: 'red', group: 'outer' },
  { code: 'ZIP_HOODIE', label: 'ჰუდი ელვით', plural: 'ჰუდები ელვით', en: 'Zip Hoodie', img: imgHoodie, tint: true, swatch: 'grey', group: 'outer' },
  { code: 'BOMBER', label: 'ბომბერი', plural: 'ბომბერები', en: 'Bomber', img: imgLongsleeve, tint: true, swatch: 'olive', group: 'outer' },
  { code: 'BAG', label: 'ჩანთა', plural: 'ჩანთები', en: 'Tote Bag', img: imgBag, tint: true, swatch: 'sand', group: 'acc' },
  { code: 'CAP', label: 'კეპი', plural: 'კეპები', en: 'Cap', img: imgCap, tint: true, swatch: 'royal', group: 'acc' },
  { code: 'MUG', label: 'ჭიქა', plural: 'ჭიქები', en: 'Mug', img: imgMug, tint: false, swatch: 'white', group: 'acc' },
];

export const CATEGORY_BY_CODE = Object.fromEntries(CATEGORIES.map((c) => [c.code, c]));

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.code, c.label]));

export const CATEGORY_EN = Object.fromEntries(CATEGORIES.map((c) => [c.code, c.en]));

// Product colour keys → swatch + Georgian name. `tint` (optional) is a lighter
// value used to colour garment photos so dark fabrics keep visible folds.
export const COLORS = {
  white: { hex: '#FFFFFF', name: 'თეთრი' },
  black: { hex: '#1F1F22', tint: '#3E3E44', name: 'შავი' },
  grey: { hex: '#9A9CA1', name: 'ნაცრისფერი' },
  navy: { hex: '#1E2A4A', tint: '#2E3F6B', name: 'მუქი ლურჯი' },
  red: { hex: '#C8323C', name: 'წითელი' },
  royal: { hex: '#2B4C9B', name: 'ლურჯი' },
  bottle: { hex: '#2F5A3A', name: 'მწვანე' },
  sand: { hex: '#E4D3B0', name: 'ქვიშისფერი' },
  burgundy: { hex: '#6E1F2F', tint: '#8C2A3E', name: 'ბორდო' },
  olive: { hex: '#6B6B3A', name: 'ზეთისხილისფერი' },
};

export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

export const GENDERS = { unisex: 'უნისექსი', men: 'მამაკაცის', women: 'ქალის' };

// The API returns `price`; older data used `basePrice`.
export function priceOf(product) {
  return Number(product?.price ?? product?.basePrice ?? 0);
}

export function isOnSale(product) {
  return Number(product?.oldPrice) > priceOf(product);
}

// Resolve a server-hosted path (e.g. /uploads/...) to an absolute URL.
// Absolute and data: URLs are returned unchanged.
export function assetUrl(url) {
  if (!url) return null;
  return /^(https?:|data:)/.test(url) ? url : `${API_BASE}${url}`;
}

// Resolve a product's mockup image to an absolute URL (handles bare paths).
// `image` may also be a bare GridFS file id (see backend FilesModule).
export function productImg(product) {
  const src = product?.image || product?.mockupUrl;
  return /^[a-f0-9]{24}$/i.test(src || '') ? assetUrl(`/api/files/${src}`) : assetUrl(src);
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
