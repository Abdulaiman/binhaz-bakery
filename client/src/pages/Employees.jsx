import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', dailyPay: '', branchId: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [filterBranchId, setFilterBranchId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [empsData, brData] = await Promise.all([
        api.getEmployees(page, 20, filterBranchId),
        api.getBranches(1, 100)
      ]);
      setEmployees(empsData.employees);
      setPagination(empsData.pagination);
      setBranches(brData.branches);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, filterBranchId]);

  const openCreate = () => {
    setEditId(null);
    setForm({ name: '', dailyPay: '', branchId: user?.branchId || '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditId(emp.id);
    setForm({ name: emp.name, dailyPay: String(emp.dailyPay), branchId: emp.branchId });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editId) {
        await api.updateEmployee(editId, { name: form.name, dailyPay: parseFloat(form.dailyPay) });
      } else {
        await api.createEmployee({
          name: form.name,
          dailyPay: parseFloat(form.dailyPay),
          branchId: form.branchId,
        });
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp) => {
    if (!confirm(`Remove "${emp.name}"? This action is reversible (soft delete).`)) return;
    try {
      await api.deleteEmployee(emp.id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Employees</h1>
        <p>Manage bakery staff and daily pay rates</p>
      </div>
      <div className="page-content fade-in">
        <div className="toolbar">
          {user?.role === 'SUPER_ADMIN' && (
            <select
              className="form-input"
              value={filterBranchId}
              onChange={(e) => { setFilterBranchId(e.target.value); setPage(1); }}
              style={{ maxWidth: 200 }}
            >
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <div className="badge badge-gold" style={{ padding: '8px 12px' }}>
            {pagination.total} EMPLOYEES
          </div>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={openCreate}>+ Add Employee</button>
        </div>

        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : (employees || []).length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p>No employees yet. Add your first employee.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Daily Pay</th>
                    <th>Branch</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(employees || []).map((emp) => (
                    <tr key={emp.id}>
                      <td data-label="Name" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</td>
                      <td data-label="Daily Pay">₦{emp.dailyPay.toLocaleString()}</td>
                      <td data-label="Branch"><span className="badge badge-gold">{(emp.branch || {}).name || '—'}</span></td>
                      <td data-label="Actions">
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(emp)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(emp)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>{editId ? 'Edit Employee' : 'Add Employee'}</h2>
              {error && <div className="alert alert-error">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    className="form-input"
                    placeholder="Employee name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Daily Pay (₦)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 3000"
                    value={form.dailyPay}
                    onChange={(e) => setForm({ ...form, dailyPay: e.target.value })}
                    required
                  />
                </div>
                {user?.role === 'SUPER_ADMIN' && !editId && (
                  <div className="form-group">
                    <label>Branch</label>
                    <select
                      className="form-input"
                      value={form.branchId}
                      onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                      required
                    >
                      <option value="">Select branch</option>
                      {(branches || []).map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <span className="spinner" /> : (editId ? 'Save Changes' : 'Add Employee')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
