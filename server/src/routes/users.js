const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

const router = express.Router();

// POST /api/users – create a new admin
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { email, role, branchId } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Only SUPER_ADMIN can create SUPER_ADMIN
    const targetRole = role || 'ADMIN';
    if (targetRole === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only SUPER_ADMIN can create SUPER_ADMIN users' });
    }

    // ADMIN role requires a branch
    if (targetRole === 'ADMIN' && !branchId) {
      return res.status(400).json({ error: 'Branch is required for ADMIN role' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Generate temp password
    const tempPassword = crypto.randomBytes(4).toString('hex'); // 8-char hex
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: targetRole,
        branchId: targetRole === 'ADMIN' ? branchId : null,
        mustChangePassword: true,
        isActive: true,
      },
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: user.id,
      metadata: { email, role: targetRole, branchId },
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
      },
      temporaryPassword: tempPassword,
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users?page=&limit=
router.get('/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 50, branchId } = req.query;
    const p = parseInt(page);
    const l = parseInt(limit);

    const where = {};
    if (branchId) {
      where.branchId = branchId;
    }
    
    if (req.user.role === 'ADMIN') {
      where.branchId = req.user.branchId;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          branchId: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          branch: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: p,
        limit: l,
        total,
        pages: Math.ceil(total / l),
      },
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:id/toggle-active
router.patch('/:id/toggle-active', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
    });

    await logAudit({
      userId: req.user.id,
      action: updated.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entityType: 'User',
      entityId: user.id,
    });

    res.json({ id: updated.id, isActive: updated.isActive });
  } catch (err) {
    console.error('Toggle user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
