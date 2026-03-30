import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function TaskTypes() {
  const { user } = useAuth();
  const [taskTypes, setTaskTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTaskName, setNewTaskName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getTaskTypes();
      setTaskTypes(data.taskTypes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await api.createTaskType({ name: newTaskName.trim() });
      setNewTaskName('');
      load();
      setMessage('Task type added successfully!');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type) => {
    if (!confirm(`Delete task type "${type.name}"? This will not affect existing attendance records but will remove it from the dropdown choices.`)) return;
    try {
      await api.deleteTaskType(type.id);
      load();
      setMessage('Task type deleted.');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="empty-state">
        <div className="empty-icon">🚫</div>
        <h2>Access Denied</h2>
        <p>Only Super Admins can manage task types.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Task Types</h1>
        <p>Manage the preset options available in the attendance task dropdown</p>
      </div>
      <div className="page-content fade-in">
        <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
          <h3>Add New Task Type</h3>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <input
              className="form-input"
              placeholder="e.g. Mixing, Baking..."
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Add Task'}
            </button>
          </form>
          {message && (
            <div className={`alert ${message.startsWith('Error') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: '12px', marginBottom: 0 }}>
              {message}
            </div>
          )}
        </div>

        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : taskTypes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No preset task types found. Add your first one above!</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {taskTypes.map((type) => (
                  <tr key={type.id}>
                    <td style={{ fontWeight: 600 }}>{type.name}</td>
                    <td>{new Date(type.createdAt).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-danger btn-sm" 
                        onClick={() => handleDelete(type)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
