/**
 * Children's sizes, offered on top of a product's own sizes. Admin picks
 * them per product (Product.kidsSizes); products never edited there keep
 * this default list on T-shirts and hoodies. The stored size names the age
 * so orders read unambiguously.
 * Keep in sync with KIDS_SIZES in frontend/src/lib/catalog.js.
 */
export const KIDS_SIZES = [
  'XS (4–5 წ.)',
  'S (6–7 წ.)',
  'M (8–9 წ.)',
  'L (10–11 წ.)',
  'XL (12–13 წ.)',
  '2XL (14–15 წ.)',
];

export const KIDS_SIZE_CATEGORIES = ['TSHIRT', 'HOODIE', 'ZIP_HOODIE'];

/** Kids' sizes a product offers. */
export const kidsSizesOf = (product: { category?: string; kidsSizes?: string[] | null }) =>
  Array.isArray(product.kidsSizes)
    ? product.kidsSizes
    : KIDS_SIZE_CATEGORIES.includes(product.category ?? '')
      ? KIDS_SIZES
      : [];
