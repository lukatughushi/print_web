const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!product || !product.isActive) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/products (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, category, basePrice, sizes, mockupUrl } = req.body;

  if (!name || !category || basePrice == null || !sizes?.length || !mockupUrl) {
    return res.status(400).json({ error: 'name, category, basePrice, sizes, and mockupUrl are required' });
  }

  try {
    const product = await prisma.product.create({
      data: { name, category, basePrice: parseFloat(basePrice), sizes, mockupUrl },
    });
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/products/:id (admin)
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  const { name, category, basePrice, sizes, mockupUrl, isActive } = req.body;

  // Orders are validated against this list, so an empty one would make the product unorderable.
  if (sizes !== undefined && (!Array.isArray(sizes) || sizes.length === 0)) {
    return res.status(400).json({ error: 'sizes must be a non-empty array' });
  }

  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(basePrice !== undefined && { basePrice: parseFloat(basePrice) }),
        ...(sizes !== undefined && { sizes }),
        ...(mockupUrl !== undefined && { mockupUrl }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/products/:id — soft delete (admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Product deactivated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
