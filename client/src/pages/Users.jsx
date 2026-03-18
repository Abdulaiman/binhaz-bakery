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
      </div>
    </>
  );
}
