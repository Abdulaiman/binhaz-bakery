import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Payroll() {
  const { user } = useAuth();
  
  // Default to current month range
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [payrolls, setPayrolls] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(user?.branchId || '');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      api.getBranches(1, 100).then(data => setBranches(data.branches)).catch(console.error);
    }
  }, []);

  useEffect(() => {
    loadPayrolls();
  }, [startDate, endDate, selectedBranch, page]);

  const loadPayrolls = async () => {
    setLoading(true);
    try {
      const branchId = user?.role === 'SUPER_ADMIN' ? selectedBranch : user?.branchId;
      const data = await api.getPayroll(startDate, endDate, branchId, page);
      setPayrolls(data.payrolls);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    const branchId = user?.role === 'SUPER_ADMIN' ? selectedBranch : user?.branchId;
    if (!branchId) {
      setMessage('Please select a branch');
      return;
    }

    setGenerating(true);
    setMessage('');
    try {
      await api.generatePayroll({ startDate, endDate, branchId });
      setMessage('Payroll generated successfully!');
      setPage(1);
      loadPayrolls();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Payroll</h1>
        <p>Generate and view payroll reports for any date range</p>
      </div>
      <div className="page-content fade-in">
        <div className="toolbar">
          <div className="filter-item">
            <span>From:</span>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              style={{ maxWidth: 160 }}
            />
          </div>
          <div className="filter-item">
            <span>To:</span>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              style={{ maxWidth: 160 }}
            />
          </div>
          {user?.role === 'SUPER_ADMIN' && (
            <select
              className="form-input"
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setPage(1); }}
              style={{ maxWidth: 200 }}
            >
              <option value="">All branches</option>
              {(branches || []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <div className="spacer" />
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? <span className="spinner" /> : '⚡ Generate Payroll'}
          </button>
        </div>

        {message && (
          <div className={`alert ${message.startsWith('Error') ? 'alert-error' : 'alert-success'}`}>
            {message}
          </div>
        )}

        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : (payrolls || []).length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <p>No payroll data found for this range. Generate payroll to see results.</p>
          </div>
        ) : (
          <>
            {(payrolls || []).map((payroll) => (
              <div key={payroll.id} className="card" style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedId(expandedId === payroll.id ? null : payroll.id)}
                >
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--gold)', fontSize: '1.1rem' }}>
                      {payroll.branch?.name || 'Unknown Branch'}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {payroll.startDate} to {payroll.endDate}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gold)' }}>
                      ₦{payroll.totalAmount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {payroll.items.length} employees • {expandedId === payroll.id ? '▲' : '▼'}
                    </div>
                  </div>
                </div>

                {expandedId === payroll.id && (
                  <div style={{ marginTop: 16 }}>
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Employee</th>
                            <th>Daily Rate</th>
                            <th>Days Worked</th>
                            <th>Total Pay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payroll.items.map((item) => (
                            <tr key={item.id}>
                              <td data-label="Employee" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {item.employee?.name || 'Unknown'}
                              </td>
                              <td data-label="Daily Rate">₦{(item.employee?.dailyPay || 0).toLocaleString()}</td>
                              <td data-label="Days Worked">
                                <span className={`badge ${item.daysWorked > 0 ? 'badge-success' : 'badge-error'}`}>
                                  {item.daysWorked} days
                                </span>
                              </td>
                              <td data-label="Total Pay" style={{ fontWeight: 600, color: 'var(--gold)' }}>
                                ₦{item.totalPay.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}

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
