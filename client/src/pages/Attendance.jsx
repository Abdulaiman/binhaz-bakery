import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { enqueueAttendance, syncOfflineAttendance, getQueuedAttendance } from '../utils/offlineQueue';

export default function Attendance() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [attendance, setAttendance] = useState({});
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(user?.branchId || '');
  const [message, setMessage] = useState('');
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      api.getBranches(1, 100).then(data => setBranches(data.branches)).catch(console.error);
    }
    // Check offline queue
    getQueuedAttendance().then((q) => setQueueCount(q.length)).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [date, selectedBranch, page]);

  const loadData = async () => {
    setLoading(true);
    setMessage('');
    try {
      const branchId = user?.role === 'SUPER_ADMIN' ? selectedBranch : user?.branchId;
      if (!branchId) {
        setEmployees([]);
        setPagination({ total: 0, pages: 1, page: 1 });
        setLoading(false);
        return;
      }
      
      const [empsData, attData] = await Promise.all([
        api.getEmployees(page, 20, branchId),
        api.getAttendance(date, branchId),
      ]);
      setEmployees(empsData.employees || []);
      setPagination(empsData.pagination || { total: 0, pages: 1, page: 1 });
      setLocked(attData.locked);

      // Build attendance map with wages
      const attMap = {};
      attData.attendance.forEach((a) => {
        attMap[a.employeeId] = { 
          present: a.present, 
          wage: a.dailyWage !== null ? a.dailyWage : a.employee.dailyPay 
        };
      });
      // For employees not in attData but in employees list, initialize with default pay
      empsData.employees.forEach(emp => {
        if (!attMap[emp.id]) {
          attMap[emp.id] = { present: false, wage: emp.dailyPay };
        }
      });
      setAttendance(attMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = (empId) => {
    if (locked && user?.role !== 'SUPER_ADMIN') return;
    setAttendance((prev) => ({
      ...prev,
      [empId]: { 
        ...prev[empId], 
        present: !prev[empId]?.present 
      },
    }));
  };

  const handleWageChange = (empId, wage) => {
    if (locked && user?.role !== 'SUPER_ADMIN') return;
    setAttendance((prev) => ({
      ...prev,
      [empId]: { 
        ...prev[empId], 
        wage: parseFloat(wage) || 0 
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    const branchId = user?.role === 'SUPER_ADMIN' ? selectedBranch : user?.branchId;
    const records = employees.map((emp) => ({
      employeeId: emp.id,
      present: !!attendance[emp.id]?.present,
      dailyWage: attendance[emp.id]?.wage ?? emp.dailyPay
    }));

    const payload = { date, branchId, records };

    try {
      if (!navigator.onLine) {
        await enqueueAttendance(payload);
        setMessage('Saved offline. Will sync when back online.');
        const q = await getQueuedAttendance();
        setQueueCount(q.length);
      } else {
        await api.markAttendance(payload);
        setMessage('Attendance saved successfully!');
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLock = async () => {
    if (!confirm(`Lock attendance for ${date}? This cannot be undone.`)) return;
    const branchId = user?.role === 'SUPER_ADMIN' ? selectedBranch : user?.branchId;
    try {
      await api.lockAttendance({ date, branchId });
      setLocked(true);
      setMessage('Attendance locked for this date.');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleSync = async () => {
    setSaving(true);
    try {
      const synced = await syncOfflineAttendance((data) => api.markAttendance(data));
      setQueueCount(0);
      setMessage(`Synced ${synced} offline record(s).`);
      loadData();
    } catch (err) {
      setMessage(`Sync error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const presentCountOnPage = employees.filter(emp => !!attendance[emp.id]?.present).length;

  return (
    <>
      <div className="page-header">
        <h1>Attendance</h1>
        <p>Mark daily attendance for employees</p>
      </div>
      <div className="page-content fade-in">
        <div className="toolbar">
          <div className="filter-item">
            <span>Date:</span>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => { setDate(e.target.value); setPage(1); }}
              style={{ maxWidth: 180 }}
            />
          </div>
          {user?.role === 'SUPER_ADMIN' && (
            <select
              className="form-input"
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setPage(1); }}
              style={{ maxWidth: 200 }}
            >
              <option value="">-- Select a branch --</option>
              {(branches || []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <div className="spacer" />
          {queueCount > 0 && (
            <button className="btn btn-secondary" onClick={handleSync} disabled={saving}>
              🔄 Sync ({queueCount})
            </button>
          )}
          {!locked && (
            <button className="btn btn-secondary" onClick={handleLock}>
              🔒 Lock Day
            </button>
          )}
        </div>

        {locked && (
          <div className={`alert ${user?.role === 'SUPER_ADMIN' ? 'alert-warning' : 'alert-error'}`}>
            {user?.role === 'SUPER_ADMIN' 
              ? '⚠️ Attendance for this date is locked, but you have SUPER_ADMIN override permissions.'
              : `🔒 Attendance for ${date} is locked. No further changes allowed.`}
          </div>
        )}

        {message && (
          <div className={`alert ${message.startsWith('Error') ? 'alert-error' : 'alert-success'}`}>
            {message}
          </div>
        )}

        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : (user?.role === 'SUPER_ADMIN' && !selectedBranch) ? (
          <div className="empty-state">
            <div className="empty-icon">🏪</div>
            <p>Please select a branch to view attendance.</p>
          </div>
        ) : (employees || []).length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No employees found for this branch.</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {presentCountOnPage}/{employees.length} present on this page ({pagination.total} total employees)
            </div>

            <div className="attendance-grid">
              {(employees || []).map((emp) => (
                <div
                  key={emp.id}
                  className={`attendance-row ${attendance[emp.id]?.present ? 'active' : ''}`}
                  onClick={() => toggleAttendance(emp.id)}
                  style={{ 
                    cursor: (locked && user?.role !== 'SUPER_ADMIN') ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '8px',
                    background: attendance[emp.id]?.present ? 'rgba(212, 175, 55, 0.1)' : 'var(--bg-card)',
                    border: attendance[emp.id]?.present ? '1px solid var(--gold)' : '1px solid transparent'
                  }}
                >
                  <label className="checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!attendance[emp.id]?.present}
                      onChange={() => toggleAttendance(emp.id)}
                      disabled={locked && user?.role !== 'SUPER_ADMIN'}
                    />
                  </label>
                  <span className="emp-name" style={{ flex: 1, marginLeft: '12px', fontWeight: 600 }}>{emp.name}</span>
                  
                  <div className="emp-pay-control" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pay: ₦</span>
                    <input
                      type="number"
                      className="form-input"
                      value={attendance[emp.id]?.wage ?? emp.dailyPay}
                      onChange={(e) => handleWageChange(emp.id, e.target.value)}
                      disabled={locked && user?.role !== 'SUPER_ADMIN'}
                      style={{ 
                        width: '90px', 
                        padding: '4px 8px', 
                        fontSize: '0.9rem',
                        textAlign: 'right',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px'
                      }}
                    />
                  </div>

                  {locked && user?.role !== 'SUPER_ADMIN' && (
                    <span className={`badge ${attendance[emp.id]?.present ? 'badge-success' : 'badge-error'}`} style={{ marginLeft: '12px' }}>
                      {attendance[emp.id]?.present ? 'Present' : 'Absent'}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {pagination.pages > 1 && (
              <div className="pagination" style={{ marginTop: 24, marginBottom: 24 }}>
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

            {(!locked || user?.role === 'SUPER_ADMIN') && (
              <div style={{ marginTop: 24 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ width: '100%' }}
                >
                  {saving ? <span className="spinner" /> : (
                    locked ? `Save Changes (Override Lock)` : `Save Page ${page} (${presentCountOnPage} present)`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
