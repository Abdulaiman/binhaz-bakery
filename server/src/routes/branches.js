const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

const router = express.Router();

// POST /api/branches
router.post('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Branch name is required' });

    const existing = await prisma.branch.findUnique({ where: { name } });
    if (existing) return res.status(409).json({ error: 'Branch name already exists' });

    const branch = await prisma.branch.create({ data: { name, address } });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_BRANCH',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: { name, address },
    });

    res.status(201).json(branch);
  } catch (err) {
    console.error('Create branch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/branches?page=&limit=
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const p = parseInt(page);
    const l = parseInt(limit);

    const [branches, total] = await Promise.all([
      prisma.branch.findMany({
        include: {
          _count: { select: { users: true, employees: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
      }),
      prisma.branch.count(),
    ]);

    res.json({
      branches,
      pagination: {
        page: p,
        limit: l,
        total,
        pages: Math.ceil(total / l),
      },
    });
  } catch (err) {
    console.error('Get branches error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
