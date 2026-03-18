const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

const router = express.Router();

// POST /api/attendance – bulk mark attendance
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { date, records } = req.body;
    // records: [{ employeeId, present }]
    if (!date || !records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Date and records array are required' });
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
            employeeId_date: {
              employeeId: record.employeeId,
              date,
            },
          },
          create: {
            employeeId: record.employeeId,
            branchId,
            date,
            present: record.present,
            markedById: req.user.id,
          },
          update: {
            present: record.present,
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
        branchId, 
        count: results.length,
        lockBypassed: !!lock && req.user.role === 'SUPER_ADMIN'
      },
    });

    res.json({ saved: results.length, records: results });
  } catch (err) {
    console.error('Attendance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance?date=YYYY-MM-DD&branchId=
router.get('/', authenticate, async (req, res) => {
  try {
    const { date, branchId } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const targetBranch = req.user.role === 'SUPER_ADMIN'
      ? branchId
      : req.user.branchId;

    const where = { date };
    if (targetBranch) where.branchId = targetBranch;

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { name: true, dailyPay: true } },
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
