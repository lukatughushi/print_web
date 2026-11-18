import { assetUrl } from './catalog';
import teeImg from '../assets/home/tee.webp';
import hoodieImg from '../assets/home/hoodie.webp';
import longsleeveImg from '../assets/home/longsleeve.webp';
import toteImg from '../assets/home/tote.webp';
import capImg from '../assets/home/cap.webp';
import mugImg from '../assets/home/mug.webp';
import poloImg from '../assets/corp/roofing-2.webp';

/** Pictures bundled with the site, referred to as "builtin:<name>". */
export const BUILTIN_IMAGES = {
  tee: teeImg,
  hoodie: hoodieImg,
  polo: poloImg,
  longsleeve: longsleeveImg,
  tote: toteImg,
  cap: capImg,
  mug: mugImg,
};

/**
 * The home page's category tiles until admin saves its own list
 * (settings.homeTiles). `cats` are the shop categories the tile opens and
 * whose lowest price it shows.
 */
export const DEFAULT_TILES = [
  { label: 'მაისური', cats: ['TSHIRT'], image: 'builtin:tee' },
  { label: 'ჰუდი', cats: ['HOODIE', 'ZIP_HOODIE'], image: 'builtin:hoodie' },
  { label: 'პოლო', cats: ['POLO', 'POLO_LONGSLEEVE'], image: 'builtin:polo', photo: true },
  { label: 'გრძელმკლავიანი', cats: ['LONGSLEEVE'], image: 'builtin:longsleeve' },
  { label: 'ჩანთა', cats: ['BAG'], image: 'builtin:tote' },
  { label: 'კეპი', cats: ['CAP'], image: 'builtin:cap' },
  { label: 'ჭიქა', cats: ['MUG'], image: 'builtin:mug' },
];

/** The tiles to use: admin's list, or the built-in one while none is saved. */
export function tilesFrom(settings) {
  const saved = settings?.homeTiles;
  return Array.isArray(saved) && saved.length ? saved : DEFAULT_TILES;
}

/** Image URL for a tile's `image` (bundled picture or uploaded file). */
export function tileImage(image) {
  if (!image) return '';
  if (image.startsWith('builtin:')) return BUILTIN_IMAGES[image.slice(8)] || '';
  return assetUrl(`/api/files/${image}`);
}

/** The tile's name in the current language (admin's en/ru, else the dictionary). */
export function tileLabel(tile, lang, t) {
  return (lang !== 'ka' && tile[lang]) || t(tile.label);
}
