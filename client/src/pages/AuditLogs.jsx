import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function AuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    action: '',
    branchId: '',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      api.getBranches(1, 100).then(data => setBranches(data.branches)).catch(console.error);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const loadLogs = () => {
    setLoading(true);
    api.getAuditLogs(page, 20, filters)
      .then((data) => {
        setLogs(data.logs);
        setPagination(data.pagination);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setPage(1);
  };

  const formatAction = (action) => {
    const colors = {
      LOGIN: 'badge-info',
      CREATE_USER: 'badge-success',
      CREATE_BRANCH: 'badge-success',
      CREATE_EMPLOYEE: 'badge-success',
      UPDATE_EMPLOYEE: 'badge-gold',
      DELETE_EMPLOYEE: 'badge-error',
      MARK_ATTENDANCE: 'badge-info',
      LOCK_ATTENDANCE: 'badge-error',
      GENERATE_PAYROLL: 'badge-gold',
      CHANGE_PASSWORD: 'badge-gold',
      ACTIVATE_USER: 'badge-success',
      DEACTIVATE_USER: 'badge-error',
    };
    return colors[action] || 'badge-info';
  };

  return (
    <>
      <div className="page-header">
        <h1>Audit Logs</h1>
        <p>Track all system actions and changes</p>
      </div>
      <div className="page-content fade-in">
        <div className="toolbar">
          <select 
            name="action" 
            className="form-input" 
            style={{ maxWidth: 180 }}
            value={filters.action}
            onChange={handleFilterChange}
          >
            <option value="">All Actions</option>
            <option value="LOGIN">LOGIN</option>
            <option value="MARK_ATTENDANCE">MARK_ATTENDANCE</option>
            <option value="LOCK_ATTENDANCE">LOCK_ATTENDANCE</option>
            <option value="CREATE_EMPLOYEE">CREATE_EMPLOYEE</option>
            <option value="GENERATE_PAYROLL">GENERATE_PAYROLL</option>
          </select>

          {user?.role === 'SUPER_ADMIN' && (
            <select 
              name="branchId" 
              className="form-input" 
              style={{ maxWidth: 180 }}
              value={filters.branchId}
              onChange={handleFilterChange}
            >
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}

          <div className="filter-item">
            <span>From:</span>
            <input 
              type="date" 
              name="dateFrom" 
              className="form-input" 
              style={{ maxWidth: 160 }}
              value={filters.dateFrom}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-item">
            <span>To:</span>
            <input 
              type="date" 
              name="dateTo" 
              className="form-input" 
              style={{ maxWidth: 160 }}
              value={filters.dateTo}
              onChange={handleFilterChange}
            />
          </div>
          
          <div className="spacer" />
          <div className="badge badge-info" style={{ padding: '8px 12px' }}>
            {pagination.total} ENTRIES
          </div>
        </div>

        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>No audit logs found with current filters.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User / Branch</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    let meta = null;
                    try { meta = log.metadata ? JSON.parse(log.metadata) : null; } catch {}

                    return (
                      <tr key={log.id}>
                        <td data-label="Timestamp" style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td data-label="User / Branch">
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{log.user?.email || '—'}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--gold)' }}>
                            {log.user?.branch?.name || 'System Admin'}
                          </div>
                        </td>
                        <td data-label="Action">
                          <span className={`badge ${formatAction(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td data-label="Entity" style={{ fontSize: '0.8rem' }}>
                          {log.entityType}
                          {log.entityId && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>
                              ID: {log.entityId.substring(0, 8)}...
                            </span>
                          )}
                        </td>
                        <td data-label="Details" style={{ fontSize: '0.75rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {meta ? (
                            <div style={{ color: 'var(--text-secondary)' }}>
                              {Object.entries(meta).map(([k, v]) => (
                                <div key={k}>{k}: <span style={{ color: 'var(--text-primary)' }}>{String(v)}</span></div>
                              ))}
                            </div>
                          ) : '—'}
                          {meta?.lockBypassed && (
                            <span className="badge badge-error" style={{ fontSize: '0.6rem', marginTop: 4 }}>OVERRIDE</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  ← Prev
                </button>
                <span className="page-info">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page >= pagination.pages}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
