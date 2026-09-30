// Flat delivery fee, waived once the subtotal reaches SiteSettings.freeShipThreshold.
// Exposed to the storefront via GET /api/settings so both sides use the same number.
const SHIPPING_FEE = 10;

function shippingFor(subtotal, freeShipThreshold) {
  return subtotal === 0 || subtotal >= freeShipThreshold ? 0 : SHIPPING_FEE;
}

module.exports = { SHIPPING_FEE, shippingFor };
