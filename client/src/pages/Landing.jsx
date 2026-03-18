import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div className="landing-content fade-in">
        <h1 className="landing-logo">BINHAZ</h1>
        <p className="landing-tagline">Premium Bakery</p>
        <div className="landing-line" />
        <p className="landing-subtitle">
          Streamlined bakery management. Track employees, attendance, and payroll — all in one place.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>
          Sign In to Dashboard
        </button>
      </div>
    </div>
  );
}
