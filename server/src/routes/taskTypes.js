const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logAudit } = require('../lib/audit');

const router = express.Router();

// GET /api/task-types
router.get('/', authenticate, async (req, res) => {
  try {
    const taskTypes = await prisma.taskType.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ taskTypes });
  } catch (err) {
    console.error('Get task types error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/task-types
router.post('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Task type name is required' });
    }

    const taskType = await prisma.taskType.create({
      data: { name: name.trim() },
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_TASK_TYPE',
      entityType: 'TaskType',
      entityId: taskType.id,
      metadata: { name: taskType.name },
    });

    res.status(201).json(taskType);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Task type already exists' });
    }
    console.error('Create task type error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/task-types/:id
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const taskType = await prisma.taskType.findUnique({ where: { id: req.params.id } });
    if (!taskType) {
      return res.status(404).json({ error: 'Task type not found' });
    }

    await prisma.taskType.delete({ where: { id: req.params.id } });

    await logAudit({
      userId: req.user.id,
      action: 'DELETE_TASK_TYPE',
      entityType: 'TaskType',
      entityId: taskType.id,
      metadata: { name: taskType.name },
    });

    res.json({ message: 'Task type deleted' });
  } catch (err) {
    console.error('Delete task type error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
