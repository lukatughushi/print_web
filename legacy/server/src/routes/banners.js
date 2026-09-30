const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

// GET /api/banners — public, active banners ordered by position
router.get('/', async (req, res) => {
  try {
    const banners = await prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
    res.json(banners);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
