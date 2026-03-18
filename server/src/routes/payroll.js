const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

const router = express.Router();

// POST /api/payroll/generate
router.post('/generate', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.body;
    const targetBranch = req.user.role === 'SUPER_ADMIN' ? branchId : req.user.branchId;

    if (!startDate || !endDate || !targetBranch) {
      return res.status(400).json({ error: 'Start date, end date, and branch are required' });
    }

    // Check if payroll already exists for this exact range and branch
    const existing = await prisma.payroll.findUnique({
      where: {
        startDate_endDate_branchId: {
          startDate,
          endDate,
          branchId: targetBranch
        }
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'Payroll already generated for this date range and branch' });
    }

    // Get all attendance records for this range and branch
    const attendance = await prisma.attendance.findMany({
      where: {
        branchId: targetBranch,
        date: { gte: startDate, lte: endDate },
        present: true,
      },
    });

    // Group by employee
    const employeeDays = {};
    attendance.forEach((a) => {
      employeeDays[a.employeeId] = (employeeDays[a.employeeId] || 0) + 1;
    });

    // Get all employees for this branch
    const employees = await prisma.employee.findMany({
      where: { branchId: targetBranch, deletedAt: null },
    });

    const employeeMap = {};
    employees.forEach((e) => {
      employeeMap[e.id] = e;
    });

    // Calculate payroll items
    let totalAmount = 0;
    const items = [];

    // Process employees with attendance
    for (const [employeeId, daysWorked] of Object.entries(employeeDays)) {
      const emp = employeeMap[employeeId];
      if (!emp) continue;
      const totalPay = daysWorked * emp.dailyPay;
      totalAmount += totalPay;
      items.push({ employeeId, daysWorked, totalPay });
    }

    // Include employees with 0 days worked
    employees.forEach((emp) => {
      if (!employeeDays[emp.id]) {
        items.push({ employeeId: emp.id, daysWorked: 0, totalPay: 0 });
      }
    });

    // Create payroll with items
    const payroll = await prisma.payroll.create({
      data: {
        startDate,
        endDate,
        branchId: targetBranch,
        totalAmount,
        items: {
          create: items,
        },
      },
      include: {
        items: {
          include: {
            employee: { select: { name: true, dailyPay: true } },
          },
        },
      },
    });

    await logAudit({
      userId: req.user.id,
      action: 'GENERATE_PAYROLL',
      entityType: 'Payroll',
      entityId: payroll.id,
      metadata: { startDate, endDate, branchId: targetBranch, totalAmount, employeeCount: items.length },
    });

    res.status(201).json(payroll);
  } catch (err) {
    console.error('Generate payroll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payroll?startDate=&endDate=&branchId=&page=&limit=
router.get('/', authenticate, async (req, res) => {
  try {
    const { branchId, page = 1, limit = 20 } = req.query;
    const p = parseInt(page);
    const l = parseInt(limit);

    const where = {};
    if (req.user.role === 'SUPER_ADMIN') {
      if (branchId) where.branchId = branchId;
    } else {
      where.branchId = req.user.branchId;
    }

    const [payrolls, total] = await Promise.all([
      prisma.payroll.findMany({
        where,
        include: {
          branch: { select: { name: true } },
          items: {
            include: {
              employee: { select: { name: true, dailyPay: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
      }),
      prisma.payroll.count({ where }),
    ]);

    res.json({
      payrolls,
      pagination: {
        page: p,
        limit: l,
        total,
        pages: Math.ceil(total / l),
      },
    });
  } catch (err) {
    console.error('Get payroll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
