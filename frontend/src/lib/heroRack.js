/** The home hero's clothing rack: what hangs on it, shared with the admin page. */

// Each model's front print zone, measured from the models (the shapes themselves
// are in public/hero-zones): zone = its width / height; x, y, w, h = its box as
// shares of the garment's front view.
const ZONE = {
  tshirt: { zone: 0.614, x: 0.267, y: 0.176, w: 0.467, h: 0.686 },
  hoodie: { zone: 1.062, x: 0.301, y: 0.161, w: 0.403, h: 0.316 },
  polo: { zone: 0.662, x: 0.297, y: 0.21, w: 0.417, h: 0.587 },
  longsleeve: { zone: 0.555, x: 0.387, y: 0.167, w: 0.226, h: 0.714 },
  'hoodie-zip': { zone: 1.179, x: 0.273, y: 0.175, w: 0.483, h: 0.339 },
  'polo-ls': { zone: 0.569, x: 0.39, y: 0.214, w: 0.224, h: 0.67 },
};

const NAMES = {
  tshirt: 'მაისური',
  hoodie: 'ჰუდი ჯიბით',
  polo: 'პოლო',
  longsleeve: 'გრძელმკლავიანი მაისური',
  'hoodie-zip': 'ჰუდი ელვაშესაკრავით',
  'polo-ls': 'პოლო გრძელი მკლავით',
};

// Garments on the rack, left to right (from the design).
export const RACK = ['tshirt', 'hoodie', 'polo', 'longsleeve', 'hoodie-zip', 'tshirt', 'polo-ls', 'hoodie', 'longsleeve', 'polo']
  .map((model) => ({ model, name: NAMES[model], zone: ZONE[model] }));

// The 12 best-known garment colours; every visit deals a different set.
// Black and navy are lifted a little so they read on the dark hero.
export const COLOURS = [
  { hex: '#3a3b40', name: 'შავი' },
  { hex: '#f2f0ec', name: 'თეთრი' },
  { hex: '#b4b6ba', name: 'ნაცრისფერი' },
  { hex: '#2e3f6b', name: 'მუქი ლურჯი' },
  { hex: '#c8323c', name: 'წითელი' },
  { hex: '#2b4c9b', name: 'ლურჯი' },
  { hex: '#2f7a4d', name: 'მწვანე' },
  { hex: '#e4d3b0', name: 'ბეჟი' },
  { hex: '#8c2a3e', name: 'ბორდო' },
  { hex: '#f2c230', name: 'ყვითელი' },
  { hex: '#ef7f9a', name: 'ვარდისფერი' },
  { hex: '#e9772b', name: 'ნარინჯისფერი' },
];

function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The rack for this visit. Garments with a design (admin Hero_Special page)
 * keep their chosen colour; the others share out the remaining colours.
 */
export function rackItems(designs = []) {
  const bySlot = new Map(designs.map((d) => [d.slot, d]));
  const fixed = new Set(designs.map((d) => d.hex));
  const pool = shuffled(COLOURS.map((c) => c.hex).filter((hex) => !fixed.has(hex)));
  return RACK.map(({ model }, i) => {
    const design = bySlot.get(i);
    // More garments than free colours only when many designs share few colours.
    return design ? { model, hex: design.hex, design } : { model, hex: pool.pop() ?? COLOURS[i].hex };
  });
}
