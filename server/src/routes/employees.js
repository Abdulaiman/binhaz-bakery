const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

const router = express.Router();

// Helper to scope queries by branch
function branchFilter(user) {
  if (user.role === 'SUPER_ADMIN') return {};
  return { branchId: user.branchId };
}

// POST /api/employees
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { name, dailyPay, branchId } = req.body;
    if (!name || dailyPay === undefined) {
      return res.status(400).json({ error: 'Name and dailyPay are required' });
    }

    const targetBranch = req.user.role === 'SUPER_ADMIN' ? branchId : req.user.branchId;
    if (!targetBranch) {
      return res.status(400).json({ error: 'Branch is required' });
    }

    const employee = await prisma.employee.create({
      data: { name, dailyPay: parseFloat(dailyPay), branchId: targetBranch },
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_EMPLOYEE',
      entityType: 'Employee',
      entityId: employee.id,
      metadata: { name, dailyPay, branchId: targetBranch },
    });

    res.status(201).json(employee);
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/employees?page=&limit=
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 50, branchId } = req.query;
    const p = parseInt(page);
    const l = parseInt(limit);
    const where = {
      ...branchFilter(req.user),
      deletedAt: null,
    };
    if (req.user.role === 'SUPER_ADMIN' && branchId) {
      where.branchId = branchId;
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: { branch: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
      }),
      prisma.employee.count({ where }),
    ]);

    res.json({
      employees,
      pagination: {
        page: p,
        limit: l,
        total,
        pages: Math.ceil(total / l),
      },
    });
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/employees/:id
router.put('/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { name, dailyPay } = req.body;
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee || employee.deletedAt) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Branch scoping for ADMIN
    if (req.user.role === 'ADMIN' && employee.branchId !== req.user.branchId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(dailyPay !== undefined && { dailyPay: parseFloat(dailyPay) }),
      },
    });

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_EMPLOYEE',
      entityType: 'Employee',
      entityId: employee.id,
      metadata: { name, dailyPay },
    });

    res.json(updated);
  } catch (err) {
    console.error('Update employee error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/employees/:id (soft delete)
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee || employee.deletedAt) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (req.user.role === 'ADMIN' && employee.branchId !== req.user.branchId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.employee.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: req.user.id,
      action: 'DELETE_EMPLOYEE',
      entityType: 'Employee',
      entityId: employee.id,
      metadata: { name: employee.name },
    });

    res.json({ message: 'Employee deleted' });
  } catch (err) {
    console.error('Delete employee error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
