const express = require('express');
const prisma = require('../lib/prisma');
const { SHIPPING_FEE } = require('../lib/shipping');

const router = express.Router();

// Returns the singleton SiteSettings row, creating it with defaults on first read.
async function getOrCreateSettings() {
  const existing = await prisma.siteSettings.findFirst();
  if (existing) return existing;
  return prisma.siteSettings.create({ data: {} });
}

// GET /api/settings — public storefront settings
router.get('/', async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({ ...settings, shippingFee: SHIPPING_FEE });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.getOrCreateSettings = getOrCreateSettings;
