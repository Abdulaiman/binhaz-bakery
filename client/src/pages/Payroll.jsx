import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [selectedShift, setSelectedShift] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [downloadingDetailed, setDownloadingDetailed] = useState(null);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      api.getBranches(1, 100).then(data => setBranches(data.branches)).catch(console.error);
    }
  }, []);

  useEffect(() => {
    loadPayrolls();
  }, [startDate, endDate, selectedBranch, selectedShift, page]);

  const loadPayrolls = async () => {
    setLoading(true);
    try {
      const branchId = user?.role === 'SUPER_ADMIN' ? selectedBranch : user?.branchId;
      const data = await api.getPayroll(startDate, endDate, branchId, page, 20, selectedShift);
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
      await api.generatePayroll({ startDate, endDate, branchId, shift: selectedShift || 'ALL' });
      setMessage('Payroll generated successfully!');
      setPage(1);
      loadPayrolls();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const shiftLabel = (s) => {
    if (s === 'MORNING') return '🌅 Morning';
    if (s === 'EVENING') return '🌙 Evening';
    return '🔄 All Shifts';
  };

  // ---- SUMMARY PDF ----
  const downloadSummaryPDF = (payroll, e) => {
    e.stopPropagation();
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(44, 62, 80);
      doc.text('BINHAZ PREMIUM BAKERY', 14, 22);
      
      doc.setFontSize(16);
      doc.text('Payroll Summary Report', 14, 32);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Branch: ${payroll.branch?.name || 'Unknown'}`, 14, 44);
      doc.text(`Period: ${payroll.startDate} to ${payroll.endDate}`, 14, 52);
      doc.text(`Shift: ${shiftLabel(payroll.shift)}`, 14, 60);
      doc.text(`Total Amount: N${payroll.totalAmount.toLocaleString()}`, 14, 68);
      
      // Table body
      const tableData = payroll.items.map((item, i) => [
        i + 1,
        item.employee?.name || 'Unknown',
        shiftLabel(item.employee?.shift),
        `N${(item.employee?.dailyPay || 0).toLocaleString()}`,
        `${item.daysWorked} days`,
        `N${item.totalPay.toLocaleString()}`
      ]);
      
      autoTable(doc, {
        startY: 76,
        head: [['#', 'Employee', 'Shift', 'Standard Rate', 'Days Worked', 'Actual Pay']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [212, 175, 55], textColor: [30, 30, 30] },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          5: { fontStyle: 'bold' },
        },
      });
      
      // Summary footer
      const finalY = (doc).lastAutoTable?.finalY || 80;
      doc.setFontSize(12);
      doc.setTextColor(44, 62, 80);
      doc.text(`Total Payroll: N${payroll.totalAmount.toLocaleString()}`, 14, finalY + 12);
      doc.text(`Employees: ${payroll.items.length}`, 14, finalY + 20);
      
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(`Generated on ${new Date().toLocaleDateString()} | BINHAZ Premium Bakery`, 14, finalY + 32);
      
      doc.save(`Payroll_Summary_${(payroll.branch?.name || 'Branch').replace(/\s+/g, '_')}_${payroll.startDate}_to_${payroll.endDate}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Could not generate PDF. Please try again.');
    }
  };

  // ---- DETAILED PDF ----
  const downloadDetailedPDF = async (payroll, e) => {
    e.stopPropagation();
    setDownloadingDetailed(payroll.id);
    try {
      const { attendanceRecords } = await api.getPayrollDetailedData(payroll.id);
      
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(44, 62, 80);
      doc.text('BINHAZ PREMIUM BAKERY', 14, 22);
      
      doc.setFontSize(16);
      doc.text('Detailed Payroll Report', 14, 32);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Branch: ${payroll.branch?.name || 'Unknown'}`, 14, 44);
      doc.text(`Period: ${payroll.startDate} to ${payroll.endDate}`, 14, 52);
      doc.text(`Shift: ${shiftLabel(payroll.shift)}`, 14, 60);
      doc.text(`Total Amount: N${payroll.totalAmount.toLocaleString()}`, 14, 68);
      doc.text(`Total Attendance Records: ${attendanceRecords.length}`, 14, 76);
      
      // Summary table
      doc.setFontSize(14);
      doc.setTextColor(44, 62, 80);
      doc.text('Payment Summary', 14, 90);
      
      const summaryData = payroll.items.map((item, i) => [
        i + 1,
        item.employee?.name || 'Unknown',
        shiftLabel(item.employee?.shift),
        `N${(item.employee?.dailyPay || 0).toLocaleString()}`,
        `${item.daysWorked} days`,
        `N${item.totalPay.toLocaleString()}`
      ]);
      
      autoTable(doc, {
        startY: 96,
        head: [['#', 'Employee', 'Shift', 'Rate', 'Days', 'Total Pay']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [212, 175, 55], textColor: [30, 30, 30] },
        columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 5: { fontStyle: 'bold' } },
      });
      
      let currentY = (doc).lastAutoTable?.finalY || 100;
      
      // Group attendance by employee
      const byEmployee = {};
      attendanceRecords.forEach(rec => {
        const empName = rec.employee?.name || 'Unknown';
        if (!byEmployee[empName]) byEmployee[empName] = [];
        byEmployee[empName].push(rec);
      });
      
      // Detailed per-employee attendance
      for (const [empName, records] of Object.entries(byEmployee)) {
        // Check if we need a new page
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }
        
        currentY += 14;
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text(`${empName}`, 14, currentY);
        currentY += 2;
        
        const detailRows = records.map(rec => [
          rec.date,
          rec.shift === 'MORNING' ? 'Morning' : 'Evening',
          rec.present ? 'Present' : 'Absent',
          `N${(rec.dailyWage ?? rec.employee?.dailyPay ?? 0).toLocaleString()}`,
          rec.taskPerformed || '—',
          rec.remark || '—',
        ]);
        
        autoTable(doc, {
          startY: currentY + 2,
          head: [['Date', 'Shift', 'Status', 'Wage', 'Task', 'Remark']],
          body: detailRows,
          theme: 'striped',
          headStyles: { fillColor: [80, 80, 80] },
          styles: { fontSize: 8 },
          columnStyles: {
            4: { cellWidth: 30 },
            5: { cellWidth: 40 },
          },
        });
        
        currentY = (doc).lastAutoTable?.finalY || currentY + 20;
      }
      
      // Footer
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }
      currentY += 12;
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(`Generated on ${new Date().toLocaleDateString()} | BINHAZ Premium Bakery | Detailed Report`, 14, currentY);
      
      doc.save(`Payroll_Detailed_${(payroll.branch?.name || 'Branch').replace(/\s+/g, '_')}_${payroll.startDate}_to_${payroll.endDate}.pdf`);
    } catch (err) {
      console.error('Detailed PDF Error:', err);
      alert('Could not generate detailed PDF. Please try again.');
    } finally {
      setDownloadingDetailed(null);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Payroll</h1>
        <p>Generate and view payroll reports by shift and date range</p>
      </div>
      <div className="page-content fade-in">
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
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

          <select
            className="form-input"
            value={selectedShift}
            onChange={(e) => { setSelectedShift(e.target.value); setPage(1); }}
            style={{ maxWidth: 160 }}
          >
            <option value="">All Shifts</option>
            <option value="MORNING">🌅 Morning</option>
            <option value="EVENING">🌙 Evening</option>
          </select>

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
                    flexWrap: 'wrap',
                    gap: '8px',
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
                    <span className="badge badge-info" style={{ fontSize: '0.65rem', marginTop: '4px' }}>
                      {shiftLabel(payroll.shift)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gold)' }}>
                      ₦{payroll.totalAmount.toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-sm btn-primary" 
                        onClick={(e) => downloadSummaryPDF(payroll, e)}
                        title="Summary PDF"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: 'bold' }}
                      >
                        📊 Summary
                      </button>
                      <button 
                        className="btn btn-sm btn-secondary" 
                        onClick={(e) => downloadDetailedPDF(payroll, e)}
                        title="Detailed PDF"
                        disabled={downloadingDetailed === payroll.id}
                        style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: 'bold' }}
                      >
                        {downloadingDetailed === payroll.id ? <span className="spinner" /> : '📋 Detailed'}
                      </button>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {payroll.items.length} employees • {expandedId === payroll.id ? '▲' : '▼'}
                      </span>
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
                            <th>Shift</th>
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
                              <td data-label="Shift">
                                <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                                  {shiftLabel(item.employee?.shift)}
                                </span>
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
