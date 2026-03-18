const prisma = require('./prisma');

/**
 * Log an audit trail entry.
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.action    – e.g. "CREATE_EMPLOYEE"
 * @param {string} opts.entityType – e.g. "Employee"
 * @param {string} [opts.entityId]
 * @param {object} [opts.metadata] – arbitrary JSON-serializable data
 */
async function logAudit({ userId, action, entityType, entityId, metadata }) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId: entityId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

module.exports = { logAudit };
