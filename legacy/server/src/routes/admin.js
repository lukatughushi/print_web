const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// GET /api/admin/analytics
router.get('/analytics', authenticate, requireAdmin, async (req, res) => {
  try {
    const [revenueResult, activeOrdersCount, topItems] = await Promise.all([
      prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: { status: { notIn: ['CANCELLED'] } },
      }),
      prisma.order.count({
        where: { status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED'] } },
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        _count: { productId: true },
        _sum: { price: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 5,
      }),
    ]);

    const productIds = topItems.map((t) => t.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, category: true },
    });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    res.json({
      totalRevenue: revenueResult._sum.totalPrice || 0,
      activeOrdersCount,
      topProducts: topItems.map((t) => ({
        id: t.productId,
        name: productMap[t.productId]?.name ?? 'Unknown',
        category: productMap[t.productId]?.category ?? null,
        orderCount: t._count.productId,
        revenue: t._sum.price || 0,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/orders
router.get('/orders', authenticate, requireAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, category: true, mockupUrl: true } },
            design: true,
          },
        },
      },
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/products (includes inactive)
router.get('/products', authenticate, requireAdmin, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/users
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            totalPrice: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
