import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/branches', label: 'Branches', icon: '🏪', roles: ['SUPER_ADMIN'] },
  { to: '/employees', label: 'Employees', icon: '👥', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/attendance', label: 'Attendance', icon: '📋', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/payroll', label: 'Payroll', icon: '💰', roles: ['SUPER_ADMIN'] },
  { to: '/audit-logs', label: 'Audit Logs', icon: '📝', roles: ['SUPER_ADMIN'] },
  { to: '/users', label: 'Users', icon: '👤', roles: ['SUPER_ADMIN'] },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNav = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`app-sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h2>BINHAZ</h2>
          <p>Premium Bakery</p>
        </div>

        <nav className="sidebar-nav">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => isActive ? 'active' : ''}
              onClick={onClose}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <strong>{user?.email}</strong>
            <span className="badge badge-gold" style={{ marginTop: 4 }}>{user?.role}</span>
            {user?.branchName && (
              <span style={{ display: 'block', marginTop: 4, fontSize: '0.75rem' }}>
                📍 {user.branchName}
              </span>
            )}
          </div>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ width: '100%' }}>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
