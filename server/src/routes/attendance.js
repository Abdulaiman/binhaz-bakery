const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

const router = express.Router();

// POST /api/attendance – bulk mark attendance
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { date, shift, records } = req.body;
    // records: [{ employeeId, present, dailyWage?, taskPerformed?, remark? }]
    if (!date || !shift || !records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Date, shift, and records array are required' });
    }

    const validShifts = ['MORNING', 'EVENING'];
    if (!validShifts.includes(shift)) {
      return res.status(400).json({ error: 'Shift must be MORNING or EVENING' });
    }

    const branchId = req.user.role === 'SUPER_ADMIN'
      ? (req.body.branchId || records[0]?.branchId)
      : req.user.branchId;

    if (!branchId) {
      return res.status(400).json({ error: 'Branch is required' });
    }

    // Check if day is locked
    const lock = await prisma.attendanceLock.findUnique({
      where: { branchId_date: { branchId, date } },
    });
    
    if (lock && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Attendance for this date is locked' });
    }

    const results = [];
    for (const record of records) {
      try {
        const att = await prisma.attendance.upsert({
          where: {
            employeeId_date_shift: {
              employeeId: record.employeeId,
              date,
              shift,
            },
          },
          create: {
            employeeId: record.employeeId,
            branchId,
            date,
            shift,
            present: record.present,
            dailyWage: record.dailyWage,
            taskPerformed: record.taskPerformed || null,
            remark: record.remark || null,
            markedById: req.user.id,
          },
          update: {
            present: record.present,
            dailyWage: record.dailyWage,
            taskPerformed: record.taskPerformed || null,
            remark: record.remark || null,
            markedById: req.user.id,
          },
        });
        results.push(att);
      } catch (e) {
        console.error(`Attendance upsert error for ${record.employeeId}:`, e.message);
      }
    }

    await logAudit({
      userId: req.user.id,
      action: 'MARK_ATTENDANCE',
      entityType: 'Attendance',
      metadata: { 
        date, 
        shift,
        branchId, 
        count: results.length,
        lockBypassed: !!lock && req.user.role === 'SUPER_ADMIN',
        tasksRecorded: results.filter(r => r.taskPerformed).length,
        remarksRecorded: results.filter(r => r.remark).length,
      },
    });

    res.json({ saved: results.length, records: results });
  } catch (err) {
    console.error('Attendance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance?date=YYYY-MM-DD&branchId=&shift=
router.get('/', authenticate, async (req, res) => {
  try {
    const { date, branchId, shift } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const targetBranch = req.user.role === 'SUPER_ADMIN'
      ? branchId
      : req.user.branchId;

    const where = { date };
    if (targetBranch) where.branchId = targetBranch;
    if (shift && shift !== 'ALL') where.shift = shift;

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { name: true, dailyPay: true, shift: true } },
        markedBy: { select: { email: true } },
      },
      orderBy: { employee: { name: 'asc' } },
    });

    // Check lock status
    let locked = false;
    if (targetBranch) {
      const lock = await prisma.attendanceLock.findUnique({
        where: { branchId_date: { branchId: targetBranch, date } },
      });
      locked = !!lock;
    }

    res.json({ attendance, locked });
  } catch (err) {
    console.error('Get attendance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/search?employeeName=&shift=&taskPerformed=&dateFrom=&dateTo=&branchId=&page=&limit=
router.get('/search', authenticate, async (req, res) => {
  try {
    const { employeeName, shift, taskPerformed, dateFrom, dateTo, branchId, page = 1, limit = 20 } = req.query;
    const p = parseInt(page);
    const l = parseInt(limit);

    const targetBranch = req.user.role === 'SUPER_ADMIN' ? branchId : req.user.branchId;

    const where = {};
    if (targetBranch) where.branchId = targetBranch;
    if (shift && shift !== 'ALL') where.shift = shift;
    if (taskPerformed) where.taskPerformed = { contains: taskPerformed };
    if (dateFrom && dateTo) {
      where.date = { gte: dateFrom, lte: dateTo };
    } else if (dateFrom) {
      where.date = { gte: dateFrom };
    } else if (dateTo) {
      where.date = { lte: dateTo };
    }
    if (employeeName) {
      where.employee = { name: { contains: employeeName } };
    }

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          employee: { select: { name: true, dailyPay: true, shift: true } },
          branch: { select: { name: true } },
          markedBy: { select: { email: true } },
        },
        orderBy: [{ date: 'desc' }, { shift: 'asc' }],
        skip: (p - 1) * l,
        take: l,
      }),
      prisma.attendance.count({ where }),
    ]);

    res.json({
      records,
      pagination: {
        page: p,
        limit: l,
        total,
        pages: Math.ceil(total / l),
      },
    });
  } catch (err) {
    console.error('Search attendance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/:id – single attendance detail
router.get('/:id', authenticate, async (req, res) => {
  try {
    const record = await prisma.attendance.findUnique({
      where: { id: req.params.id },
      include: {
        employee: { select: { name: true, dailyPay: true, shift: true, branch: { select: { name: true } } } },
        branch: { select: { name: true } },
        markedBy: { select: { email: true } },
      },
    });

    if (!record) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    // Branch scoping for ADMIN
    if (req.user.role === 'ADMIN' && record.branchId !== req.user.branchId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(record);
  } catch (err) {
    console.error('Get attendance detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/attendance/lock
router.post('/lock', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { date, branchId } = req.body;
    const targetBranch = req.user.role === 'SUPER_ADMIN' ? branchId : req.user.branchId;

    if (!date || !targetBranch) {
      return res.status(400).json({ error: 'Date and branch are required' });
    }

    await prisma.attendanceLock.create({
      data: { branchId: targetBranch, date },
    });

    await logAudit({
      userId: req.user.id,
      action: 'LOCK_ATTENDANCE',
      entityType: 'AttendanceLock',
      metadata: { date, branchId: targetBranch },
    });

    res.json({ message: 'Attendance locked', date, branchId: targetBranch });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Already locked' });
    }
    console.error('Lock attendance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
