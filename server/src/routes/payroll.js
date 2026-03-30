const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

const router = express.Router();

// POST /api/payroll/generate
router.post('/generate', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { startDate, endDate, branchId, shift } = req.body;
    const targetBranch = req.user.role === 'SUPER_ADMIN' ? branchId : req.user.branchId;

    if (!startDate || !endDate || !targetBranch) {
      return res.status(400).json({ error: 'Start date, end date, and branch are required' });
    }

    // Build attendance filter
    const attWhere = {
      branchId: targetBranch,
      date: { gte: startDate, lte: endDate },
      present: true,
    };
    if (shift && shift !== 'ALL') {
      attWhere.shift = shift;
    }

    // Get all attendance records for this range and branch (and optional shift)
    const attendance = await prisma.attendance.findMany({
      where: attWhere,
      include: {
        employee: { select: { id: true, dailyPay: true } }
      }
    });

    // Group by employee and sum up specific daily wages
    const employeeAggregation = {}; // { [empId]: { daysWorked: 0, totalPay: 0 } }
    attendance.forEach((a) => {
      if (!employeeAggregation[a.employeeId]) {
        employeeAggregation[a.employeeId] = { daysWorked: 0, totalPay: 0 };
      }
      employeeAggregation[a.employeeId].daysWorked += 1;
      // Use override wage if set, otherwise fallback to employee standard pay
      const wage = a.dailyWage !== null ? a.dailyWage : a.employee.dailyPay;
      employeeAggregation[a.employeeId].totalPay += wage;
    });

    // Build employee filter matching shift
    const empWhere = { branchId: targetBranch, deletedAt: null };
    if (shift && shift !== 'ALL') {
      empWhere.OR = [
        { shift: shift },
        { shift: 'BOTH' },
      ];
    }

    // Get all employees for this branch (and optional shift)
    const employees = await prisma.employee.findMany({ where: empWhere });

    // Calculate payroll items
    let totalAmount = 0;
    const items = [];

    // Process employees with attendance
    for (const [employeeId, stats] of Object.entries(employeeAggregation)) {
      totalAmount += stats.totalPay;
      items.push({ 
        employeeId, 
        daysWorked: stats.daysWorked, 
        totalPay: stats.totalPay 
      });
    }

    // Include employees with 0 days worked
    employees.forEach((emp) => {
      if (!employeeAggregation[emp.id]) {
        items.push({ employeeId: emp.id, daysWorked: 0, totalPay: 0 });
      }
    });

    // Create payroll with items
    const payroll = await prisma.payroll.create({
      data: {
        startDate,
        endDate,
        branchId: targetBranch,
        shift: (shift && shift !== 'ALL') ? shift : null,
        totalAmount,
        items: {
          create: items,
        },
      },
      include: {
        branch: { select: { name: true } },
        items: {
          include: {
            employee: { select: { name: true, dailyPay: true, shift: true } },
          },
        },
      },
    });

    await logAudit({
      userId: req.user.id,
      action: 'GENERATE_PAYROLL',
      entityType: 'Payroll',
      entityId: payroll.id,
      metadata: { startDate, endDate, branchId: targetBranch, shift: shift || 'ALL', totalAmount, employeeCount: items.length },
    });

    res.status(201).json(payroll);
  } catch (err) {
    console.error('Generate payroll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payroll?startDate=&endDate=&branchId=&shift=&page=&limit=
router.get('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { branchId, shift, page = 1, limit = 20 } = req.query;
    const p = parseInt(page);
    const l = parseInt(limit);

    const where = {};
    if (req.user.role === 'SUPER_ADMIN' && branchId) {
      where.branchId = branchId;
    }
    if (shift && shift !== 'ALL') {
      where.shift = shift;
    }

    const [payrolls, total] = await Promise.all([
      prisma.payroll.findMany({
        where,
        include: {
          branch: { select: { name: true } },
          items: {
            include: {
              employee: { select: { name: true, dailyPay: true, shift: true } },
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

// GET /api/payroll/:id/detailed-data – get all attendance for detailed PDF
router.get('/:id/detailed-data', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const payroll = await prisma.payroll.findUnique({
      where: { id: req.params.id },
      include: {
        branch: { select: { name: true } },
        items: {
          include: {
            employee: { select: { id: true, name: true, dailyPay: true, shift: true } },
          },
        },
      },
    });

    if (!payroll) {
      return res.status(404).json({ error: 'Payroll not found' });
    }

    // Build attendance filter matching the payroll period
    const attWhere = {
      branchId: payroll.branchId,
      date: { gte: payroll.startDate, lte: payroll.endDate },
      present: true,
    };
    if (payroll.shift) {
      attWhere.shift = payroll.shift;
    }

    // Fetch all matching attendance records
    const attendanceRecords = await prisma.attendance.findMany({
      where: attWhere,
      include: {
        employee: { select: { name: true, dailyPay: true, shift: true } },
        markedBy: { select: { email: true } },
      },
      orderBy: [{ employee: { name: 'asc' } }, { date: 'asc' }],
    });

    res.json({ payroll, attendanceRecords });
  } catch (err) {
    console.error('Get payroll detailed data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
