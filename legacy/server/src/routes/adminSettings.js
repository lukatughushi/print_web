const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { getOrCreateSettings } = require('./settings');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
}

router.use(authenticate, requireAdmin);

const STRING_FIELDS = [
  'announcementText',
  'heroTitle',
  'heroSubtitle',
  'heroCtaText',
  'heroCtaLink',
  'currency',
  'contactPhone',
  'contactEmail',
  'contactAddress',
];

// GET /api/admin/settings
router.get('/', async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/admin/settings
router.patch('/', async (req, res) => {
  try {
    const current = await getOrCreateSettings();

    const data = {};
    for (const key of STRING_FIELDS) {
      if (req.body[key] !== undefined) {
        const val = req.body[key];
        data[key] = val === '' ? null : String(val);
      }
    }
    if (req.body.announcementActive !== undefined) {
      data.announcementActive = Boolean(req.body.announcementActive);
    }
    if (req.body.freeShipThreshold !== undefined) {
      const n = parseInt(req.body.freeShipThreshold, 10);
      if (!Number.isNaN(n) && n >= 0) data.freeShipThreshold = n;
    }
    if (data.currency === null) data.currency = '₾';

    const updated = await prisma.siteSettings.update({
      where: { id: current.id },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
