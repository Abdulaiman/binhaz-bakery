import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBranchId, setFilterBranchId] = useState('');
  
  // Create Admin modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', branchId: '', role: 'ADMIN' });
  const [adminResult, setAdminResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [uData, bData] = await Promise.all([
        api.getUsers(page, 20, filterBranchId),
        api.getBranches(1, 100)
      ]);
      setUsers(uData.users);
      setPagination(uData.pagination);
      setBranches(bData.branches);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, filterBranchId]);

  const handleToggle = async (userId) => {
    try {
      await api.toggleUser(userId);
      load();
    } catch (err) {
      alert(err.message);
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
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users;

  return (
    <>
      <div className="page-header">
        <h1>User Management</h1>
        <p>Manage system administrators and their branch assignments</p>
      </div>
      <div className="page-content fade-in">
        <div className="toolbar">
          {user?.role === 'SUPER_ADMIN' && (
            <select
              className="form-input"
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
              style={{ maxWidth: 200 }}
            >
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <div className="badge badge-gold" style={{ padding: '8px 12px' }}>
            {pagination.total} USERS
          </div>
          <div className="spacer" />
          {user?.role === 'SUPER_ADMIN' && (
            <button className="btn btn-secondary" onClick={() => { setShowAdminModal(true); setAdminResult(null); setError(''); }}>
              + Create Admin
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p>No users found matching your criteria.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Branch</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td data-label="Email" style={{ fontWeight: 600 }}>{u.email}</td>
                      <td data-label="Role">
                        <span className={`badge ${u.role === 'SUPER_ADMIN' ? 'badge-error' : 'badge-gold'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td data-label="Branch">
                        {u.branch?.name || <span style={{ color: 'var(--text-muted)' }}>Global</span>}
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${u.isActive ? 'badge-success' : 'badge-error'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td data-label="Actions">
                        {u.id !== user.id && (
                          <button 
                            className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => handleToggle(u.id)}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
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
