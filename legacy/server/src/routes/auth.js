const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const router = express.Router();

function signToken(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function safeUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

// Public self-registration is disabled — the storefront is guest-only.
// Only admin accounts remain, provisioned via server/create-admin.js.

// POST /api/auth/login  (admin panel sign-in)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user && (await bcrypt.compare(password, user.passwordHash));

    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ user: safeUser(user), token: signToken(user.id, user.role) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
