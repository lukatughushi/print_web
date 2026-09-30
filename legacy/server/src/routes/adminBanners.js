const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
}

router.use(authenticate, requireAdmin);

// Multer/busboy may decode multipart text fields as latin1. Re-encode if needed.
function decodeUtf8Field(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (!s) return null;
  if (!/[\x80-\xFF]/.test(s)) return s;
  try {
    const decoded = Buffer.from(s, 'latin1').toString('utf8');
    return decoded.includes('�') ? s : decoded;
  } catch {
    return s;
  }
}

const uploadDir = path.join(__dirname, '../../uploads/banners');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg/png/webp images are allowed'));
  },
});

function runUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

// GET / — all banners including inactive
router.get('/', async (req, res) => {
  try {
    const banners = await prisma.banner.findMany({ orderBy: { order: 'asc' } });
    res.json(banners);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /reorder — must be defined before /:id to avoid route collision
router.patch('/reorder', async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array of {id, order}' });
    await prisma.$transaction(
      items.map(({ id, order }) => prisma.banner.update({ where: { id }, data: { order: Number(order) } }))
    );
    const banners = await prisma.banner.findMany({ orderBy: { order: 'asc' } });
    res.json(banners);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST / — create new banner (image required)
router.post('/', runUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }
    const count = await prisma.banner.count();
    if (count >= 3) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Maximum 3 banners allowed' });
    }
    const maxAgg = await prisma.banner.aggregate({ _max: { order: true } });
    const nextOrder = (maxAgg._max.order ?? -1) + 1;
    const banner = await prisma.banner.create({
      data: {
        imageUrl: `/uploads/banners/${req.file.filename}`,
        title: decodeUtf8Field(req.body.title),
        subtitle: decodeUtf8Field(req.body.subtitle),
        ctaText: decodeUtf8Field(req.body.ctaText),
        ctaLink: decodeUtf8Field(req.body.ctaLink),
        order: nextOrder,
      },
    });
    res.status(201).json(banner);
  } catch (err) {
    console.error(err);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /:id — update fields or replace image
router.patch('/:id', runUpload, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Banner not found' });

    const data = {};

    if (req.file) {
      if (existing.imageUrl) {
        const old = path.join(__dirname, '../../', existing.imageUrl);
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
      data.imageUrl = `/uploads/banners/${req.file.filename}`;
    }

    if (req.body.title !== undefined)    data.title    = decodeUtf8Field(req.body.title);
    if (req.body.subtitle !== undefined) data.subtitle = decodeUtf8Field(req.body.subtitle);
    if (req.body.ctaText !== undefined)  data.ctaText  = decodeUtf8Field(req.body.ctaText);
    if (req.body.ctaLink !== undefined)  data.ctaLink  = decodeUtf8Field(req.body.ctaLink);

    // isActive can arrive as JSON boolean or FormData string
    if (req.body.isActive !== undefined) {
      data.isActive = req.body.isActive === true || req.body.isActive === 'true';
    }

    const banner = await prisma.banner.update({ where: { id }, data });
    res.json(banner);
  } catch (err) {
    console.error(err);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /:id — remove record and image file
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) return res.status(404).json({ error: 'Banner not found' });

    if (banner.imageUrl) {
      const filePath = path.join(__dirname, '../../', banner.imageUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await prisma.banner.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
