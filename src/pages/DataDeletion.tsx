import { Link } from "react-router-dom";
import { useEffect } from "react";

const DataDeletion = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleRequestDeletion = () => {
    window.location.href = "mailto:support@threadable.ai?subject=Data%20Deletion%20Request&body=Hello%2C%0A%0AI%20would%20like%20to%20request%20the%20deletion%20of%20all%20my%20personal%20data%20associated%20with%20my%20Threadable.ai%20account.%0A%0AEmail%3A%20%5Byour%20account%20email%5D%0A%0AThank%20you.";
  };

  return (
    <>
      <style>{`
        .legal-root {
          background: #0a0a0f;
          color: #e8e4de;
          font-family: 'DM Sans', -apple-system, sans-serif;
          line-height: 1.7;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }
        .legal-root a { color: #a855f7; text-decoration: none; }
        .legal-root a:hover { text-decoration: underline; }
        .legal-nav {
          padding: 0.9rem 2rem;
          border-bottom: 1px solid #1e1d2a;
          background: rgba(10, 10, 15, 0.95);
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(20px);
        }
        .legal-nav-inner {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .legal-logo-icon {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, #a855f7, #7c3aed);
          border-radius: 8px; display: flex; align-items: center; justify-content: center;
          font-size: 0.95rem; font-weight: 700; color: white;
        }
        .legal-logo-text { font-size: 1rem; font-weight: 600; letter-spacing: -0.01em; color: #e8e4de; }
        .legal-content {
          max-width: 800px;
          margin: 0 auto;
          padding: 3rem 2rem 4rem;
        }
        .legal-content h1 {
          font-size: 2.2rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.5rem;
          letter-spacing: -0.02em;
        }
        .legal-subtitle {
          font-size: 0.9rem;
          color: #6b6766;
          margin-bottom: 2.5rem;
        }
        .legal-content h2 {
          font-size: 1.15rem;
          font-weight: 700;
          color: white;
          margin-top: 2.25rem;
          margin-bottom: 0.75rem;
        }
        .legal-content p {
          color: #d1ccc5;
          margin-bottom: 1rem;
          line-height: 1.75;
        }
        .legal-content ul {
          color: #d1ccc5;
          margin-bottom: 1rem;
          padding-left: 1.5rem;
        }
        .legal-content li {
          margin-bottom: 0.35rem;
          line-height: 1.65;
        }
        .legal-back {
          margin-top: 3rem;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          color: #a855f7;
          font-weight: 500;
          font-size: 0.9rem;
        }
        .legal-divider {
          height: 1px;
          background: #1e1d2a;
          margin: 2.5rem 0;
        }
        .deletion-cta-box {
          background: #111118;
          border: 1px solid #2a2935;
          border-radius: 12px;
          padding: 2rem;
          margin: 2rem 0;
          text-align: center;
        }
        .deletion-cta-box p {
          margin-bottom: 1.25rem;
        }
        .deletion-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #a855f7, #7c3aed);
          color: white;
          font-weight: 600;
          font-size: 0.95rem;
          padding: 0.75rem 1.75rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .deletion-btn:hover {
          opacity: 0.88;
          text-decoration: none;
        }
        .info-box {
          background: #0f0f1a;
          border: 1px solid #1e1d2a;
          border-left: 3px solid #a855f7;
          border-radius: 0 8px 8px 0;
          padding: 1rem 1.25rem;
          margin: 1.5rem 0;
        }
        .info-box p {
          margin: 0;
          font-size: 0.9rem;
          color: #b8b0aa;
        }
      `}</style>
      <div className="legal-root">
        <nav className="legal-nav">
          <div className="legal-nav-inner">
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
              <div className="legal-logo-icon">T</div>
              <span className="legal-logo-text">Threadable.ai</span>
            </Link>
          </div>
        </nav>

        <div className="legal-content">
          <h1>User Data Deletion</h1>
          <p className="legal-subtitle">Your data belongs to you. Here's how to request its removal.</p>

          <p>Threadable.ai is committed to your privacy and your right to control your personal data. You can request the deletion of all data associated with your account at any time.</p>

          <h2>How to Request Deletion</h2>
          <p>Send an email to <a href="mailto:support@threadable.ai">support@threadable.ai</a> with the subject line <strong>"Data Deletion Request"</strong> from the email address associated with your Threadable account. We will confirm receipt and process your request within 30 days.</p>

          <div className="deletion-cta-box">
            <p>Click below to open a pre-filled email with the correct subject line:</p>
            <button className="deletion-btn" onClick={handleRequestDeletion}>
              ✉ Request Data Deletion
            </button>
          </div>

          <h2>What Gets Deleted</h2>
          <p>Upon a confirmed deletion request, we will permanently remove:</p>
          <ul>
            <li>Your account and login credentials</li>
            <li>Your identity profile (niche, about you, goals, audiences, offers, sales funnel)</li>
            <li>Your story vault and personal narratives</li>
            <li>All post history, analytics, and engagement data fetched from Threads</li>
            <li>AI-generated content (drafts, strategies, archetypes, analysis reports)</li>
            <li>Your knowledge base entries and uploaded documents</li>
            <li>Your voice profile and writing samples</li>
            <li>All chat history and sessions</li>
            <li>Your Threads access token and connected account credentials</li>
            <li>Any content templates or preferences you created</li>
          </ul>

          <h2>Timeline</h2>
          <p>All personal data will be deleted within <strong>30 days</strong> of your confirmed request. Some data may persist in encrypted backups for up to 90 days before being permanently purged from all systems.</p>

          <h2>Immediate Access Revocation</h2>
          <div className="info-box">
            <p>💡 If you want to immediately stop Threadable from accessing your Threads account — without deleting your Threadable account — you can disconnect Threads in <Link to="/settings">Settings → Threads Connection</Link>. This instantly revokes our access token and stops all data fetching and publishing. You can also revoke access directly from the Threads app under Settings → Account → Website Permissions.</p>
          </div>

          <h2>Questions</h2>
          <p>If you have any questions about your data or the deletion process, contact us at <a href="mailto:support@threadable.ai">support@threadable.ai</a>.</p>

          <div className="legal-divider" />
          <Link to="/" className="legal-back">← Back to Home</Link>
        </div>
      </div>
    </>
  );
};

export default DataDeletion;
