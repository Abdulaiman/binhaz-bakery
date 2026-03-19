import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', address: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Create Admin modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', branchId: '', role: 'ADMIN' });
  const [adminResult, setAdminResult] = useState(null);

  const loadBranches = () => {
    setLoading(true);
    api.getBranches(page, 20) // Set a consistent limit
      .then((data) => {
        setBranches(data.branches);
        setPagination(data.pagination);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadBranches(); }, [page]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.createBranch(form);
      setForm({ name: '', address: '' });
      setShowModal(false);
      loadBranches();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = await api.createUser({
        email: adminForm.email,
        role: adminForm.role,
        branchId: adminForm.role === 'ADMIN' ? adminForm.branchId : null,
      });
      setAdminResult(result);
      setAdminForm({ email: '', branchId: '', role: 'ADMIN' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Branch Management</h1>
        <p>Manage bakery branches and assign admins</p>
      </div>
      <div className="page-content fade-in">
        <div className="toolbar">
          <div className="spacer" />
          <button className="btn btn-secondary" onClick={() => { setShowAdminModal(true); setAdminResult(null); setError(''); }}>
            + Create Admin
          </button>
          <button className="btn btn-primary" onClick={() => { setShowModal(true); setError(''); }}>
            + New Branch
          </button>
        </div>

        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : branches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏪</div>
            <p>No branches yet. Create your first branch to get started.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Branch Name</th>
                    <th>Address</th>
                    <th>Admins</th>
                    <th>Employees</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.id}>
                      <td data-label="Branch Name" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</td>
                      <td data-label="Address">{b.address || '—'}</td>
                      <td data-label="Admins"><span className="badge badge-info">{b._count?.users || 0}</span></td>
                      <td data-label="Employees"><span className="badge badge-gold">{b._count?.employees || 0}</span></td>
                      <td data-label="Created">{new Date(b.createdAt).toLocaleDateString()}</td>
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

        {/* Create Branch Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>New Branch</h2>
              {error && <div className="alert alert-error">{error}</div>}
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>Branch Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Main Branch"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Address (optional)</label>
                  <input
                    className="form-input"
                    placeholder="Branch address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <span className="spinner" /> : 'Create Branch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Admin Modal */}
        {showAdminModal && (
          <div className="modal-overlay" onClick={() => setShowAdminModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Create Admin</h2>
              {error && <div className="alert alert-error">{error}</div>}

              {adminResult ? (
                <div>
                  <div className="alert alert-success">
                    Admin created successfully!
                  </div>
                  <div className="card" style={{ marginBottom: 16 }}>
                    <p style={{ marginBottom: 8 }}><strong>Email:</strong> {adminResult.user.email}</p>
                    <p style={{ marginBottom: 8 }}><strong>Temporary Password:</strong></p>
                    <code style={{
                      display: 'block',
                      padding: '12px',
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--gold)',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      textAlign: 'center'
                    }}>
                      {adminResult.temporaryPassword}
                    </code>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                      Share this password securely. The admin will be forced to change it on first login.
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={() => setShowAdminModal(false)} style={{ width: '100%' }}>
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateAdmin}>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="admin@example.com"
                      value={adminForm.email}
                      onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select
                      className="form-input"
                      value={adminForm.role}
                      onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                    >
                      <option value="ADMIN">Regular Admin</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                  </div>
                  {adminForm.role === 'ADMIN' && (
                    <div className="form-group">
                      <label>Assign to Branch</label>
                      <select
                        className="form-input"
                        value={adminForm.branchId}
                        onChange={(e) => setAdminForm({ ...adminForm, branchId: e.target.value })}
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
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAdminModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? <span className="spinner" /> : 'Create Admin'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
