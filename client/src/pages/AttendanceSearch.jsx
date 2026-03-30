import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function AttendanceSearch() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    employeeName: '',
    shift: '',
    taskPerformed: '',
    dateFrom: '',
    dateTo: '',
    branchId: user?.branchId || '',
  });

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      api.getBranches(1, 100).then(data => setBranches(data.branches)).catch(console.error);
    }
  }, []);

  useEffect(() => {
    handleSearch();
  }, [page]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const data = await api.searchAttendance(filters, page, 20);
      setRecords(data.records || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    handleSearch();
  };

  const handleReset = () => {
    setFilters({
      employeeName: '',
      shift: '',
      taskPerformed: '',
      dateFrom: '',
      dateTo: '',
      branchId: user?.branchId || '',
    });
    setPage(1);
  };

  return (
    <>
      <div className="page-header">
        <h1>Search Attendance</h1>
        <p>Search and filter attendance records across dates and shifts</p>
      </div>
      <div className="page-content fade-in">
        {/* Filter toggle for mobile */}
        <button
          className="btn btn-secondary"
          onClick={() => setShowFilters(!showFilters)}
          style={{ marginBottom: '12px', width: '100%' }}
        >
          {showFilters ? '▲ Hide Filters' : '▼ Show Filters'}
        </button>

        {showFilters && (
          <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Employee Name</label>
                <input
                  className="form-input"
                  name="employeeName"
                  placeholder="Search by name..."
                  value={filters.employeeName}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Shift</label>
                <select className="form-input" name="shift" value={filters.shift} onChange={handleFilterChange}>
                  <option value="">All Shifts</option>
                  <option value="MORNING">🌅 Morning</option>
                  <option value="EVENING">🌙 Evening</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Task</label>
                <input
                  className="form-input"
                  name="taskPerformed"
                  placeholder="e.g. Mixing..."
                  value={filters.taskPerformed}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>From Date</label>
                <input className="form-input" type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>To Date</label>
                <input className="form-input" type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} />
              </div>

              {user?.role === 'SUPER_ADMIN' && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Branch</label>
                  <select className="form-input" name="branchId" value={filters.branchId} onChange={handleFilterChange}>
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={handleReset}>Clear</button>
              <button type="submit" className="btn btn-primary">🔍 Search</button>
            </div>
          </form>
        )}

        {/* Results count */}
        {!loading && (
          <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {pagination.total} record(s) found
          </div>
        )}

        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <p>No attendance records match your search. Try adjusting the filters.</p>
          </div>
        ) : (
          <>
            {records.map((rec) => {
              const isExpanded = expandedId === rec.id;
              return (
                <div
                  key={rec.id}
                  className="card"
                  style={{
                    marginBottom: '10px',
                    padding: 0,
                    overflow: 'hidden',
                    border: rec.present ? '1px solid var(--gold)' : '1px solid var(--border-color)',
                  }}
                >
                  {/* Summary row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                  >
                    <span className={`badge ${rec.present ? 'badge-success' : 'badge-error'}`} style={{ fontSize: '0.7rem' }}>
                      {rec.present ? 'PRESENT' : 'ABSENT'}
                    </span>
                    <span style={{ fontWeight: 600, flex: 1, minWidth: '100px' }}>{rec.employee?.name || 'Unknown'}</span>
                    <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                      {rec.shift === 'MORNING' ? '🌅 Morning' : '🌙 Evening'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rec.date}</span>
                    {rec.dailyWage != null && (
                      <span style={{ fontWeight: 600, color: 'var(--gold)', fontSize: '0.85rem' }}>₦{rec.dailyWage.toLocaleString()}</span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', fontSize: '0.8rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Employee</span>
                          <strong>{rec.employee?.name}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Branch</span>
                          <strong>{rec.branch?.name || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Date</span>
                          <strong>{rec.date}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Shift</span>
                          <strong>{rec.shift === 'MORNING' ? '🌅 Morning' : '🌙 Evening'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Status</span>
                          <strong>{rec.present ? '✅ Present' : '❌ Absent'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Daily Wage</span>
                          <strong style={{ color: 'var(--gold)' }}>₦{(rec.dailyWage ?? rec.employee?.dailyPay ?? 0).toLocaleString()}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Standard Rate</span>
                          <strong>₦{(rec.employee?.dailyPay ?? 0).toLocaleString()}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Marked By</span>
                          <strong>{rec.markedBy?.email || '—'}</strong>
                        </div>
                      </div>

                      {rec.taskPerformed && (
                        <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(212,175,55,0.1)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--gold)' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Task Performed</span>
                          <strong style={{ fontSize: '0.85rem' }}>{rec.taskPerformed}</strong>
                        </div>
                      )}

                      {rec.remark && (
                        <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(100,100,255,0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #6c7ce0' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Remark</span>
                          <span style={{ fontSize: '0.85rem' }}>{rec.remark}</span>
                        </div>
                      )}

                      <div style={{ marginTop: '8px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Created: {new Date(rec.createdAt).toLocaleString()}
                        {rec.updatedAt && <span style={{ marginLeft: '12px' }}>Updated: {new Date(rec.updatedAt).toLocaleString()}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {pagination.pages > 1 && (
              <div className="pagination" style={{ marginTop: 24 }}>
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
