const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { persistDesign, removeFiles } = require('../lib/designFiles');
const { shippingFor } = require('../lib/shipping');
const { getOrCreateSettings } = require('./settings');

const router = express.Router();

const VALID_STATUSES = ['PENDING', 'PRINTING', 'READY_FOR_PICKUP', 'SHIPPED', 'COMPLETED', 'CANCELLED'];

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// POST /api/orders — public guest checkout
router.post('/', async (req, res) => {
  const { items, address, phone, notes, customerName, customerEmail, expectedTotal } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }
  if (!customerName || !address || !phone) {
    return res.status(400).json({ error: 'customerName, address, and phone are required' });
  }
  for (const item of items) {
    if (!item.productId || !item.size || !item.quantity) {
      return res.status(400).json({ error: 'Each item requires productId, size, and quantity' });
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) {
      return res.status(400).json({ error: 'quantity must be a whole number between 1 and 1000' });
    }
  }

  const writtenFiles = [];

  try {
    const productIds = [...new Set(items.map(i => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products not found or inactive' });
    }

    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    for (const item of items) {
      const product = productMap[item.productId];
      if (!product.sizes.includes(item.size)) {
        return res.status(400).json({
          error: `Size "${item.size}" is not available for ${product.name}`,
          code: 'INVALID_SIZE',
          productId: product.id,
        });
      }
    }

    const linePrices = items.map(item => productMap[item.productId].basePrice * item.quantity);
    const subtotal = linePrices.reduce((sum, p) => sum + p, 0);

    // Same rule the cart/checkout pages show, so the stored total matches what the customer saw.
    const { freeShipThreshold } = await getOrCreateSettings();
    const totalPrice = subtotal + shippingFor(subtotal, freeShipThreshold);

    // Checkout sends the total it displayed. If prices or the shipping threshold
    // changed since then, refuse rather than charge an amount the customer never saw.
    if (typeof expectedTotal === 'number' && Math.abs(expectedTotal - totalPrice) > 0.005) {
      return res.status(409).json({
        error: 'Prices have changed since checkout was opened',
        code: 'PRICE_CHANGED',
        totalPrice,
      });
    }

    // Move custom design artwork to disk before touching the database.
    const designs = [];
    try {
      for (const item of items) {
        designs.push(item.design ? persistDesign(item.design, writtenFiles) : null);
      }
    } catch (err) {
      removeFiles(writtenFiles);
      return res.status(400).json({ error: err.message });
    }

    const orderItems = items.map((item, i) => ({
      product: { connect: { id: item.productId } },
      size: item.size,
      quantity: item.quantity,
      price: linePrices[i],
      ...(typeof item.color === 'string' && item.color ? { color: item.color.slice(0, 50) } : {}),
      ...(designs[i] ? { design: { create: designs[i] } } : {}),
    }));

    const order = await prisma.order.create({
      data: {
        customerName,
        customerEmail: customerEmail || null,
        address,
        phone,
        notes: notes || null,
        totalPrice,
        items: { create: orderItems },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, mockupUrl: true } },
            design: { select: { id: true, previewUrl: true } },
          },
        },
      },
    });

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    removeFiles(writtenFiles);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/:id — public order lookup (confirmation)
router.get('/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, mockupUrl: true } },
            design: { select: { id: true, previewUrl: true } },
          },
        },
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/orders/:id/status — admin only
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
            design: { select: { id: true, previewUrl: true } },
          },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
