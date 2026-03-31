require('dotenv').config();
const { execSync } = require('child_process');

// Database reset trigger for production (since Railway terminal can be hard to find)
if (process.env.RESET_DATABASE === 'true') {
  console.log('CRITICAL: RESET_DATABASE flag detected. Performing full database reset...');
  try {
    // Run prisma reset and seed
    execSync('npx prisma db push --force-reset && node prisma/seed.js', { 
      stdio: 'inherit',
      cwd: require('path').join(__dirname, '..')
    });
    console.log('Database reset and seeding completed successfully.');
  } catch (err) {
    console.error('Failed to reset database:', err);
    // Continue starting the app even if reset fails, or exit? 
    // Exit might be safer to avoid partial states, but let's continue to allow the dev to see errors in logs.
  }
}

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const branchRoutes = require('./routes/branches');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const payrollRoutes = require('./routes/payroll');
const auditRoutes = require('./routes/audit');
const taskTypeRoutes = require('./routes/taskTypes');
const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/task-types', taskTypeRoutes);

// Dashboard stats endpoint
app.get('/api/dashboard', authenticate, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const branchFilter = req.user.role === 'SUPER_ADMIN' ? {} : { branchId: req.user.branchId };

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);

    const firstDay = `${currentMonth}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [
      totalEmployees,
      totalBranches,
      todayAttendanceCount,
      todayPresentCount,
      monthPayrolls,
    ] = await Promise.all([
      prisma.employee.count({ where: { ...branchFilter, deletedAt: null } }),
      prisma.branch.count(),
      prisma.attendance.count({ where: { ...branchFilter, date: today } }),
      prisma.attendance.count({ where: { ...branchFilter, date: today, present: true } }),
      prisma.payroll.findMany({
        where: {
          ...branchFilter,
          createdAt: { gte: new Date(`${currentMonth}-01T00:00:00.000Z`) },
        },
        select: { totalAmount: true },
      }),
    ]);

    const monthlyPayrollTotal = monthPayrolls.reduce((sum, p) => sum + p.totalAmount, 0);

    res.json({
      totalEmployees,
      totalBranches,
      todayAttendance: {
        total: todayAttendanceCount,
        present: todayPresentCount,
        rate: todayAttendanceCount > 0 ? Math.round((todayPresentCount / todayAttendanceCount) * 100) : 0,
      },
      monthlyPayrollTotal,
      currentMonth,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`BINHAZ server running on port ${PORT}`);
});

module.exports = app;
