/**
 * Demo storefront catalogue: 20 products for each category, generated
 * deterministically (same output every run) so seeding stays idempotent.
 * Category codes must match the frontend (frontend/src/lib/catalog.js).
 */

import { Product } from '../products/schemas/product.schema';

interface CategorySpec {
  code: string;
  name: string;
  material: string[];
  price: [number, number];
  colors: string[];
  sizes: string[];
  genders: string[];
  styles: string[];
  blurb: string;
}

const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const ALL_COLORS = ['white', 'black', 'grey', 'navy', 'red', 'royal', 'bottle', 'sand', 'burgundy', 'olive'];

const COLLECTIONS = ['თბილისი', 'კავკასია', 'მთაწმინდა', 'ბათუმი', 'სვანეთი', 'ანბანი', 'ვაზი', 'ღამის ქალაქი', 'ზღვა', 'მზე'];

const CATEGORIES: CategorySpec[] = [
  {
    code: 'TSHIRT',
    name: 'მაისური',
    material: ['100% ბამბა', 'ორგანული ბამბა', 'ბამბა / პოლიესტერი 60/40'],
    price: [29, 49],
    colors: ALL_COLORS,
    sizes: APPAREL_SIZES,
    genders: ['unisex', 'men', 'women'],
    styles: ['კლასიკური', 'ოვერსაიზ', 'ბეისიქ', 'პრემიუმ', 'სლიმ ფიტი', 'სპორტული', 'მძიმე ბამბის', 'რეგულარ ფიტი', 'V-ყელით', 'ქალის'],
    blurb: 'რბილი, ჰაერგამტარი ქსოვილი ყოველდღიური ტარებისთვის. იდეალურია DTF ბეჭდვისთვის.',
  },
  {
    code: 'POLO',
    name: 'პოლო',
    material: ['პიკე ბამბა', 'ბამბა / პოლიესტერი 65/35'],
    price: [45, 69],
    colors: ALL_COLORS,
    sizes: APPAREL_SIZES,
    genders: ['unisex', 'men', 'women'],
    styles: ['კლასიკური', 'პიკე', 'კორპორატიული', 'სლიმ ფიტი', 'პრემიუმ', 'სპორტული', 'ქალის', 'ზოლიანი საყელოთი', 'ბეისიქ', 'ჯიბით'],
    blurb: 'საყელოიანი პოლო ღილებით — კარგი არჩევანია გუნდისა და ოფისისთვის.',
  },
  {
    code: 'LONGSLEEVE',
    name: 'გრძელმკლავიანი მაისური',
    material: ['100% ბამბა', 'ორგანული ბამბა'],
    price: [39, 59],
    colors: ALL_COLORS,
    sizes: APPAREL_SIZES,
    genders: ['unisex', 'men', 'women'],
    styles: ['კლასიკური', 'ოვერსაიზ', 'ბეისიქ', 'პრემიუმ', 'რეგლანი', 'სლიმ ფიტი', 'მანჟეტით', 'სპორტული', 'ქალის', 'მძიმე ბამბის'],
    blurb: 'გრძელი სახელოები და რბილი მანჟეტი — გარდამავალი სეზონისთვის.',
  },
  {
    code: 'POLO_LONGSLEEVE',
    name: 'გრძელმკლავიანი პოლო',
    material: ['პიკე ბამბა', 'ბამბა / პოლიესტერი 65/35'],
    price: [55, 79],
    colors: ALL_COLORS,
    sizes: APPAREL_SIZES,
    genders: ['unisex', 'men', 'women'],
    styles: ['კლასიკური', 'პიკე', 'კორპორატიული', 'პრემიუმ', 'სლიმ ფიტი', 'ზამთრის', 'ქალის', 'ბეისიქ', 'ჯიბით', 'სპორტული'],
    blurb: 'გრძელმკლავიანი პოლო საყელოთი — ოფიციალური და ამავდროულად კომფორტული.',
  },
  {
    code: 'HOODIE',
    name: 'ჰუდი ჯიბით',
    material: ['ფლისი 80/20', '100% ბამბის ფუტერი', 'ორგანული ფლისი'],
    price: [79, 119],
    colors: ALL_COLORS,
    sizes: APPAREL_SIZES,
    genders: ['unisex', 'men', 'women'],
    styles: ['კლასიკური', 'ოვერსაიზ', 'მძიმე', 'პრემიუმ', 'ბეისიქ', 'სპორტული', 'ქალის', 'ქუჩის', 'რბილი ფლისის', 'ზამთრის'],
    blurb: 'თბილი ჰუდი კენგურუს ჯიბით და კაპიუშონით. შიგნით რბილი ფლისი.',
  },
  {
    code: 'ZIP_HOODIE',
    name: 'ჰუდი ელვით',
    material: ['ფლისი 80/20', '100% ბამბის ფუტერი'],
    price: [89, 135],
    colors: ALL_COLORS,
    sizes: APPAREL_SIZES,
    genders: ['unisex', 'men', 'women'],
    styles: ['კლასიკური', 'ოვერსაიზ', 'მძიმე', 'პრემიუმ', 'სპორტული', 'ქალის', 'ურბან', 'ბეისიქ', 'ზამთრის', 'რბილი ფლისის'],
    blurb: 'ელვაშესაკრავი, ორი გვერდითი ჯიბე და ზონრები კაპიუშონზე.',
  },
  {
    code: 'BOMBER',
    name: 'ბომბერი',
    material: ['ნეილონი, საფენით', 'სატინი', 'პოლიესტერი, საფენით'],
    price: [119, 179],
    colors: ['black', 'navy', 'olive', 'burgundy', 'grey', 'sand', 'bottle'],
    sizes: APPAREL_SIZES.slice(1),
    genders: ['unisex', 'men', 'women'],
    styles: ['კლასიკური', 'სატინის', 'კოლეჯის', 'ოვერსაიზ', 'მსუბუქი', 'ზამთრის', 'ქალის', 'პრემიუმ', 'რეგლანი', 'სპორტული'],
    blurb: 'ბომბერი რეზინიანი საყელოთი და მანჟეტებით. ბეჭდვა ზურგზე და მკერდზე.',
  },
  {
    code: 'BAG',
    name: 'ჩანთა',
    material: ['კანვასი 280 გ/მ²', 'ბამბა 140 გ/მ²', 'ორგანული კანვასი'],
    price: [19, 45],
    colors: ['white', 'black', 'sand', 'navy', 'red', 'bottle', 'grey'],
    sizes: [],
    genders: ['unisex'],
    styles: ['კლასიკური', 'დიდი', 'ეკო', 'ჯიბით', 'ელვით', 'მოკლე სახელურით', 'შოპერი', 'მძიმე კანვასის', 'მინი', 'საყიდლების'],
    blurb: 'მტკიცე ტილოს ჩანთა გრძელი სახელურებით. ბეჭდვა ორივე მხარეს.',
  },
  {
    code: 'CAP',
    name: 'კეპი',
    material: ['ტვილი ბამბა', 'პოლიესტერი', 'ბამბა / პოლიესტერი'],
    price: [25, 49],
    colors: ['white', 'black', 'grey', 'navy', 'red', 'royal', 'bottle', 'sand', 'burgundy', 'olive'],
    sizes: [],
    genders: ['unisex'],
    styles: ['კლასიკური', 'ბეისბოლის', 'დად ქეფი', 'სნეპბექი', 'ტრაკერი', 'სპორტული', 'ექვსპანელიანი', 'რბილი', 'პრემიუმ', 'ხუთპანელიანი'],
    blurb: 'რეგულირებადი ზომის კეპი. ბეჭდვა ან ნაქარგი წინა პანელზე.',
  },
  {
    code: 'MUG',
    name: 'ჭიქა',
    material: ['კერამიკა'],
    price: [19, 35],
    colors: ['white'],
    sizes: [],
    genders: ['unisex'],
    styles: ['კლასიკური 330 მლ', 'დიდი 450 მლ', 'ფერადი შიგნით', 'მატოვი', 'ლატე', 'ესპრესოს', 'თერმო', 'ფერადი სახელურით', 'საჩუქრის', 'ოფისის'],
    blurb: 'კერამიკული ჭიქა სუბლიმაციური ბეჭდვით. ირეცხება ჭურჭლის სარეცხ მანქანაში.',
  },
];

// Small deterministic PRNG (mulberry32) so every seed run is identical.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSome<T>(rand: () => number, list: T[], min: number, max: number): T[] {
  const count = Math.min(list.length, min + Math.floor(rand() * (max - min + 1)));
  const shuffled = [...list].sort(() => rand() - 0.5);
  const chosen = new Set(shuffled.slice(0, count));
  return list.filter((x) => chosen.has(x)); // keep the canonical order
}

// A contiguous run of at least 4 sizes (e.g. S–XL), never with gaps.
function sizeRange(rand: () => number, sizes: string[]): string[] {
  if (!sizes.length) return [];
  const count = 4 + Math.floor(rand() * (sizes.length - 3));
  const start = Math.floor(rand() * (sizes.length - count + 1));
  return sizes.slice(start, start + count);
}

export const CATALOG_CATEGORY_CODES = CATEGORIES.map((c) => c.code);

export function buildCatalog() {
  const products: Partial<Product>[] = [];

  CATEGORIES.forEach((cat, ci) => {
    const rand = rng(1000 + ci);

    for (let i = 0; i < 20; i++) {
      // First 10: style names ("ოვერსაიზ მაისური"); next 10: print collections
      // ("მაისური „თბილისი“") — 20 distinct names per category.
      const name = i < cat.styles.length ? `${cat.styles[i]} ${cat.name}` : `${cat.name} „${COLLECTIONS[i - cat.styles.length]}“`;
      const [lo, hi] = cat.price;
      const price = Math.round((lo + rand() * (hi - lo)) / 5) * 5 - 1; // 29, 34, 39…
      const onSale = rand() < 0.22;
      const oldPrice = onSale ? Math.round((price * (1.2 + rand() * 0.25)) / 5) * 5 - 1 : undefined;

      products.push({
        name,
        description: cat.blurb,
        price,
        oldPrice,
        category: cat.code,
        colors: cat.colors.length === 1 ? cat.colors : pickSome(rand, cat.colors, 3, 7),
        sizes: sizeRange(rand, cat.sizes),
        material: cat.material[Math.floor(rand() * cat.material.length)],
        gender: cat.genders[Math.floor(rand() * cat.genders.length)],
        newArrival: rand() < 0.2,
      });
    }
  });

  return products;
}
