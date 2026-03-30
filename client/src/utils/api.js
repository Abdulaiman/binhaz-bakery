const API_BASE = '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('binhaz_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  changePassword: (currentPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),

  // Dashboard
  dashboard: () => request('/dashboard'),

  // Branches
  getBranches: (page = 1, limit = 20) => request(`/branches?page=${page}&limit=${limit}`),
  createBranch: (data) => request('/branches', { method: 'POST', body: JSON.stringify(data) }),

  // Users
  getUsers: (page = 1, limit = 20, branchId = '') => {
    let url = `/users?page=${page}&limit=${limit}`;
    if (branchId) url += `&branchId=${branchId}`;
    return request(url);
  },
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  toggleUser: (id) => request(`/users/${id}/toggle-active`, { method: 'PATCH' }),

  // Employees
  getEmployees: (page = 1, limit = 20, branchId = '', shift = '') => {
    let url = `/employees?page=${page}&limit=${limit}`;
    if (branchId) url += `&branchId=${branchId}`;
    if (shift) url += `&shift=${shift}`;
    return request(url);
  },
  createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),

  // Attendance
  getAttendance: (date, branchId, shift = '') => {
    let url = `/attendance?date=${date}`;
    if (branchId) url += `&branchId=${branchId}`;
    if (shift) url += `&shift=${shift}`;
    return request(url);
  },
  getAttendanceDetail: (id) => request(`/attendance/${id}`),
  searchAttendance: (filters = {}, page = 1, limit = 20) => {
    let url = `/attendance/search?page=${page}&limit=${limit}`;
    Object.entries(filters).forEach(([key, val]) => {
      if (val) url += `&${key}=${encodeURIComponent(val)}`;
    });
    return request(url);
  },
  markAttendance: (data) => request('/attendance', { method: 'POST', body: JSON.stringify(data) }),
  lockAttendance: (data) => request('/attendance/lock', { method: 'POST', body: JSON.stringify(data) }),

  // Task Types
  getTaskTypes: () => request('/task-types'),
  createTaskType: (data) => request('/task-types', { method: 'POST', body: JSON.stringify(data) }),
  deleteTaskType: (id) => request(`/task-types/${id}`, { method: 'DELETE' }),

  // Payroll
  getPayroll: (startDate, endDate, branchId, page = 1, limit = 20, shift = '') => {
    let url = `/payroll?page=${page}&limit=${limit}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (branchId) url += `&branchId=${branchId}`;
    if (shift) url += `&shift=${shift}`;
    return request(url);
  },
  generatePayroll: (data) => request('/payroll/generate', { method: 'POST', body: JSON.stringify(data) }),
  getPayrollDetailedData: (id) => request(`/payroll/${id}/detailed-data`),

  // Audit Logs
  getAuditLogs: (page = 1, limit = 20, filters = {}) => {
    let url = `/audit-logs?page=${page}&limit=${limit}`;
    Object.entries(filters).forEach(([key, val]) => {
      if (val) url += `&${key}=${val}`;
    });
    return request(url);
  },
};
