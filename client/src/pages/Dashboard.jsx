import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    api.dashboard()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Welcome back</p>
        </div>
        <div className="page-content">
          <div className="loading-page"><div className="spinner" /></div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.email}</p>
      </div>
      <div className="page-content fade-in">
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon">👥</span>
            <span className="stat-value">{stats?.totalEmployees || 0}</span>
            <span className="stat-label">Employees</span>
          </div>

          {user?.role === 'SUPER_ADMIN' && (
            <div className="stat-card">
              <span className="stat-icon">🏪</span>
              <span className="stat-value">{stats?.totalBranches || 0}</span>
              <span className="stat-label">Branches</span>
            </div>
          )}

          <div className="stat-card">
            <span className="stat-icon">📋</span>
            <span className="stat-value">{stats?.todayAttendance?.rate || 0}%</span>
            <span className="stat-label">Today's Attendance</span>
          </div>

          <div className="stat-card">
            <span className="stat-icon">✅</span>
            <span className="stat-value">
              {stats?.todayAttendance?.present || 0}/{stats?.todayAttendance?.total || 0}
            </span>
            <span className="stat-label">Present Today</span>
          </div>

          <div className="stat-card">
            <span className="stat-icon">💰</span>
            <span className="stat-value">
              ₦{(stats?.monthlyPayrollTotal || 0).toLocaleString()}
            </span>
            <span className="stat-label">
              Payroll ({stats?.currentMonth || 'N/A'})
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
