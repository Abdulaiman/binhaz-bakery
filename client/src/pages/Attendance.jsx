import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { enqueueAttendance, syncOfflineAttendance, getQueuedAttendance } from '../utils/offlineQueue';

export default function Attendance() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('MORNING');
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
  const [taskTypes, setTaskTypes] = useState([]);
  const [expandedEmp, setExpandedEmp] = useState(null);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      api.getBranches(1, 100).then(data => setBranches(data.branches)).catch(console.error);
    }
    api.getTaskTypes().then(data => setTaskTypes(data.taskTypes || [])).catch(console.error);
    getQueuedAttendance().then((q) => setQueueCount(q.length)).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [date, selectedBranch, shift, page]);

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
        api.getEmployees(page, 20, branchId, shift),
        api.getAttendance(date, branchId, shift),
      ]);
      setEmployees(empsData.employees || []);
      setPagination(empsData.pagination || { total: 0, pages: 1, page: 1 });
      setLocked(attData.locked);

      // Build attendance map with wages, tasks, remarks
      const attMap = {};
      attData.attendance.forEach((a) => {
        attMap[a.employeeId] = { 
          present: a.present, 
          wage: a.dailyWage !== null ? a.dailyWage : a.employee.dailyPay,
          taskPerformed: a.taskPerformed || '',
          remark: a.remark || '',
          markedBy: a.markedBy?.email || '',
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          id: a.id,
        };
      });
      // For employees not in attData, initialize with defaults
      empsData.employees.forEach(emp => {
        if (!attMap[emp.id]) {
          attMap[emp.id] = { present: false, wage: emp.dailyPay, taskPerformed: '', remark: '' };
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

  const handleTaskChange = (empId, task) => {
    if (locked && user?.role !== 'SUPER_ADMIN') return;
    setAttendance((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], taskPerformed: task },
    }));
  };

  const handleRemarkChange = (empId, remark) => {
    if (locked && user?.role !== 'SUPER_ADMIN') return;
    setAttendance((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], remark },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    const branchId = user?.role === 'SUPER_ADMIN' ? selectedBranch : user?.branchId;
    const records = employees.map((emp) => ({
      employeeId: emp.id,
      present: !!attendance[emp.id]?.present,
      dailyWage: attendance[emp.id]?.wage ?? emp.dailyPay,
      taskPerformed: attendance[emp.id]?.taskPerformed || null,
      remark: attendance[emp.id]?.remark || null,
    }));

    const payload = { date, shift, branchId, records };

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
  const isDisabled = locked && user?.role !== 'SUPER_ADMIN';

  return (
    <>
      <div className="page-header">
        <h1>Attendance</h1>
        <p>Mark daily attendance by shift for employees</p>
      </div>
      <div className="page-content fade-in">
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
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

          <div className="shift-toggle" style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => { setShift('MORNING'); setPage(1); }}
              style={{
                padding: '8px 16px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                background: shift === 'MORNING' ? 'var(--gold)' : 'var(--bg-card)',
                color: shift === 'MORNING' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              🌅 Morning
            </button>
            <button
              type="button"
              onClick={() => { setShift('EVENING'); setPage(1); }}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderLeft: '1px solid var(--border-color)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                background: shift === 'EVENING' ? 'var(--gold)' : 'var(--bg-card)',
                color: shift === 'EVENING' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              🌙 Evening
            </button>
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
            <p>No employees found for this branch and shift.</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {presentCountOnPage}/{employees.length} present on this page ({pagination.total} total employees) • {shift === 'MORNING' ? '🌅 Morning' : '🌙 Evening'} Shift
            </div>

            <div className="attendance-grid">
              {(employees || []).map((emp) => {
                const att = attendance[emp.id] || {};
                const isExpanded = expandedEmp === emp.id;
                return (
                  <div
                    key={emp.id}
                    className={`attendance-card ${att.present ? 'active' : ''}`}
                    style={{
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '10px',
                      background: att.present ? 'rgba(212, 175, 55, 0.08)' : 'var(--bg-card)',
                      border: att.present ? '1px solid var(--gold)' : '1px solid var(--border-color)',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Main row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px',
                        cursor: isDisabled ? 'default' : 'pointer',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                      onClick={() => toggleAttendance(emp.id)}
                    >
                      <label className="checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!!att.present}
                          onChange={() => toggleAttendance(emp.id)}
                          disabled={isDisabled}
                        />
                      </label>
                      <span style={{ flex: 1, fontWeight: 600, minWidth: '120px' }}>{emp.name}</span>
                      
                      {emp.shift === 'BOTH' && (
                        <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>🔄 Both</span>
                      )}

                      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>₦</span>
                        <input
                          type="number"
                          className="form-input"
                          value={att.wage ?? emp.dailyPay}
                          onChange={(e) => handleWageChange(emp.id, e.target.value)}
                          disabled={isDisabled}
                          style={{ 
                            width: '85px', padding: '4px 8px', fontSize: '0.85rem',
                            textAlign: 'right', border: '1px solid var(--border-color)', borderRadius: '4px'
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => { e.stopPropagation(); setExpandedEmp(isExpanded ? null : emp.id); }}
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      >
                        {isExpanded ? '▲ Less' : '▼ More'}
                      </button>
                    </div>

                    {/* Expanded detail section */}
                    {isExpanded && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          padding: '12px 16px',
                          borderTop: '1px solid var(--border-color)',
                          background: 'rgba(0,0,0,0.15)',
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                              Task Performed
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <select
                                className="form-input"
                                value={taskTypes.some(t => t.name === att.taskPerformed) ? att.taskPerformed : (att.taskPerformed ? '__OTHER__' : '')}
                                onChange={(e) => {
                                  if (e.target.value === '__OTHER__') {
                                    handleTaskChange(emp.id, '');
                                  } else {
                                    handleTaskChange(emp.id, e.target.value);
                                  }
                                }}
                                disabled={isDisabled}
                                style={{ flex: 1, minWidth: '140px' }}
                              >
                                <option value="">-- Select task --</option>
                                {taskTypes.map(t => (
                                  <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                                <option value="__OTHER__">Other (custom)</option>
                              </select>
                              {(!taskTypes.some(t => t.name === att.taskPerformed) && att.taskPerformed !== '') || 
                               (att.taskPerformed === '') ? null : null}
                              {/* Show custom input if "Other" is selected or if the value doesn't match any preset */}
                              {(att.taskPerformed !== '' && !taskTypes.some(t => t.name === att.taskPerformed)) && (
                                <input
                                  className="form-input"
                                  placeholder="Describe task..."
                                  value={att.taskPerformed}
                                  onChange={(e) => handleTaskChange(emp.id, e.target.value)}
                                  disabled={isDisabled}
                                  style={{ flex: 1, minWidth: '140px' }}
                                />
                              )}
                            </div>
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                              Remark (optional)
                            </label>
                            <textarea
                              className="form-input"
                              placeholder="e.g. Paid extra for overtime, late arrival, etc."
                              value={att.remark || ''}
                              onChange={(e) => handleRemarkChange(emp.id, e.target.value)}
                              disabled={isDisabled}
                              rows={2}
                              style={{ resize: 'vertical', width: '100%' }}
                            />
                          </div>

                          {/* Show audit info if record exists */}
                          {att.markedBy && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                              <span>Marked by: <strong>{att.markedBy}</strong></span>
                              {att.updatedAt && (
                                <span style={{ marginLeft: '12px' }}>Last updated: {new Date(att.updatedAt).toLocaleString()}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
                    locked ? `Save Changes (Override Lock)` : `Save ${shift} Shift — Page ${page} (${presentCountOnPage} present)`
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
