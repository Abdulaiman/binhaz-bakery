import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div className="landing-content">
        <h1 className="landing-logo">BINHAZ</h1>
        <p className="landing-tagline">Bakery Management System</p>
        <div className="landing-line" />
        <p className="landing-subtitle">
          Experience the art of streamlined management. <br />
          Track attendance, manage employees, and generate payroll with precision.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/login')} style={{ padding: '16px 40px', fontSize: '1rem', letterSpacing: '2px' }}>
          ENTER DASHBOARD
        </button>
      </div>
    </div>
  );
}
