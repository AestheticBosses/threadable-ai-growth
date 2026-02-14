import { Link } from "react-router-dom";
import { useEffect } from "react";

const Privacy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <style>{`
        .privacy-root {
          background: #0a0a0f;
          color: #e8e4de;
          font-family: 'DM Sans', -apple-system, sans-serif;
          line-height: 1.7;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }
        .privacy-root a { color: #a855f7; text-decoration: none; }
        .privacy-root a:hover { text-decoration: underline; }
        .privacy-nav {
          padding: 0.9rem 2rem;
          border-bottom: 1px solid #1e1d2a;
          background: rgba(10, 10, 15, 0.95);
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(20px);
        }
        .privacy-nav-inner {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .privacy-logo-icon {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, #a855f7, #7c3aed);
          border-radius: 8px; display: flex; align-items: center; justify-content: center;
          font-size: 0.95rem; font-weight: 700; color: white;
        }
        .privacy-logo-text { font-size: 1rem; font-weight: 600; letter-spacing: -0.01em; color: #e8e4de; }
        .privacy-content {
          max-width: 800px;
          margin: 0 auto;
          padding: 3rem 2rem 4rem;
        }
        .privacy-content h1 {
          font-size: 2.2rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.5rem;
          letter-spacing: -0.02em;
        }
        .privacy-subtitle {
          font-size: 0.9rem;
          color: #6b6766;
          margin-bottom: 2.5rem;
        }
        .privacy-content h2 {
          font-size: 1.15rem;
          font-weight: 700;
          color: white;
          margin-top: 2.25rem;
          margin-bottom: 0.75rem;
        }
        .privacy-content h3 {
          font-size: 1rem;
          font-weight: 700;
          color: white;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .privacy-content p {
          color: #d1ccc5;
          margin-bottom: 1rem;
          line-height: 1.75;
        }
        .privacy-content ul {
          color: #d1ccc5;
          margin-bottom: 1rem;
          padding-left: 1.5rem;
        }
        .privacy-content li {
          margin-bottom: 0.35rem;
          line-height: 1.65;
        }
        .privacy-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
        }
        .privacy-table th, .privacy-table td {
          border: 1px solid #2a2935;
          padding: 0.65rem 0.85rem;
          text-align: left;
          line-height: 1.6;
        }
        .privacy-table th {
          background: #111118;
          color: white;
          font-weight: 600;
          font-size: 0.85rem;
        }
        .privacy-table td {
          color: #d1ccc5;
        }
        .privacy-back {
          margin-top: 3rem;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          color: #a855f7;
          font-weight: 500;
          font-size: 0.9rem;
        }
        .privacy-divider {
          height: 1px;
          background: #1e1d2a;
          margin: 2.5rem 0;
        }
      `}</style>
      <div className="privacy-root">
        <nav className="privacy-nav">
          <div className="privacy-nav-inner">
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
              <div className="privacy-logo-icon">T</div>
              <span className="privacy-logo-text">Threadable.ai</span>
            </Link>
          </div>
        </nav>

        <div className="privacy-content">
          <h1>Privacy Policy</h1>
          <p className="privacy-subtitle">Effective Date: February 9, 2026 | Last Updated: February 13, 2026</p>

          <p>Threadable.ai ("Threadable," "we," "us," or "our") is a content strategy and scheduling platform for Meta Threads. This Privacy Policy explains how we collect, use, store, and protect your information when you use our website and services at threadable.ai (the "Service").</p>
          <p>By using Threadable, you agree to the practices described in this policy. If you do not agree, please do not use the Service.</p>

          <h2>1. Information We Collect</h2>
          <p>We collect the following categories of information:</p>

          <h3>a) Account Information</h3>
          <ul>
            <li>Email address and password (for account creation and authentication)</li>
            <li>Name (if provided)</li>
          </ul>

          <h3>b) Threads Account Data</h3>
          <p>When you connect your Meta Threads account via OAuth, we access and store:</p>
          <ul>
            <li>Your Threads user ID, username, display name, and profile picture URL</li>
            <li>Your Threads access token (encrypted, used to interact with the Threads API on your behalf)</li>
            <li>Your published posts and their content (text, media type, timestamps)</li>
            <li>Post engagement metrics (views, likes, replies, reposts, quotes, shares, clicks)</li>
            <li>Follower count and follower demographics (age, gender, country, city — where available via the Threads API)</li>
          </ul>
          <p>Important: We only access data that you explicitly authorize through Meta's OAuth flow. We never access your Threads password, direct messages, or private account information.</p>

          <h3>c) User-Provided Content</h3>
          <ul>
            <li>Your identity profile: niche, about you, desired perception, main goal, personal information, and target audience descriptions (entered during onboarding and setup)</li>
            <li>Your stories: personal and professional narratives you provide for content creation</li>
            <li>Your offers: product and service descriptions, pricing, and URLs</li>
            <li>Your sales funnel: customer journey steps including offer names, prices, URLs, and goals for each stage</li>
            <li>Your knowledge base: text, URLs, and documents you upload for the AI to reference when creating content</li>
            <li>Writing samples you provide for voice training</li>
            <li>Content templates you create or customize</li>
            <li>Chat conversations with Threadable AI (stored as session history)</li>
            <li>Edits you make to AI-generated content</li>
          </ul>

          <h3>d) AI-Generated Content</h3>
          <ul>
            <li>Content archetypes and rules derived from regression analysis of your posts</li>
            <li>Content strategies, branding plans, and funnel strategies generated by AI</li>
            <li>AI-drafted posts and their performance scores</li>
            <li>Post analysis breakdowns ("Why this post works" reports)</li>
            <li>Regression analysis results identifying your content performance patterns</li>
          </ul>

          <h3>e) Automatically Collected Information</h3>
          <ul>
            <li>Browser type, device type, and operating system</li>
            <li>IP address</li>
            <li>Pages visited and actions taken within the Service</li>
            <li>Cookies and similar tracking technologies (see Section 7)</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <table className="privacy-table">
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Data Used</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Authenticate your account and manage sessions</td><td>Email, password, access tokens</td></tr>
              <tr><td>Fetch and analyze your Threads posts and engagement data</td><td>Threads account data, post metrics, profile picture</td></tr>
              <tr><td>Run regression analysis to identify content performance patterns</td><td>Post content, engagement metrics, posting times</td></tr>
              <tr><td>Generate personalized content strategies and archetypes</td><td>Identity profile, stories, offers, sales funnel, regression insights</td></tr>
              <tr><td>Generate AI-written posts in your voice</td><td>Voice profile, writing samples, top-performing posts, knowledge base, templates (processed via OpenAI and Anthropic)</td></tr>
              <tr><td>Score posts for quality before publishing</td><td>Post content, regression data, voice profile, archetype rules</td></tr>
              <tr><td>Publish and schedule posts to Threads on your behalf</td><td>Post content, Threads access token</td></tr>
              <tr><td>Provide AI chat assistance for content creation</td><td>Chat history, identity profile, voice profile, knowledge base, archetypes</td></tr>
              <tr><td>Generate weekly performance reports and strategy adjustments</td><td>Post metrics, follower data, engagement trends</td></tr>
              <tr><td>Improve the Service</td><td>Usage data, aggregate analytics</td></tr>
            </tbody>
          </table>

          <h2>3. Third-Party Services</h2>
          <p>We use the following third-party services to operate Threadable:</p>

          <h3>a) Meta Threads API</h3>
          <p>We use Meta's official Threads API to access your Threads account data, fetch post insights, and publish content on your behalf. Your use of this integration is also subject to Meta's Privacy Policy and Meta Platform Terms.</p>

          <h3>b) AI Providers (OpenAI and Anthropic)</h3>
          <p>We use OpenAI's API and Anthropic's Claude API to power content generation, voice analysis, content scoring, regression insights, and strategy creation. When we send data to these AI providers:</p>
          <ul>
            <li>We send your voice profile, identity information, stories, offers, sales funnel, knowledge base, and post content for AI processing</li>
            <li>We do NOT send your email, password, Threads access tokens, or personal identifiers to AI providers</li>
          </ul>
          <p>OpenAI processes this data according to their API Data Usage Policy. Anthropic processes this data according to their Usage Policy. As of the effective date of this policy, neither OpenAI nor Anthropic use API inputs to train their models.</p>

          <h3>c) Supabase</h3>
          <p>We use Supabase for authentication, database hosting, serverless functions, and file storage. Your data is stored on Supabase's infrastructure. See Supabase's Privacy Policy.</p>

          <h2>4. Data Storage and Security</h2>
          <ul>
            <li>Your data is stored in a PostgreSQL database hosted by Supabase with Row Level Security (RLS) enabled, ensuring you can only access your own data.</li>
            <li>Threads access tokens are stored encrypted and are never exposed to the client-side application.</li>
            <li>All data transmission occurs over HTTPS/TLS encryption.</li>
            <li>API keys and secrets are stored in secure environment variables, not in client-side code.</li>
            <li>We implement authentication checks on all API endpoints and database operations.</li>
          </ul>
          <p>While we take reasonable measures to protect your data, no method of electronic storage or transmission is 100% secure. We cannot guarantee absolute security.</p>

          <h2>5. Data Retention</h2>
          <ul>
            <li>Account data: Retained for as long as your account is active.</li>
            <li>Threads post data and analytics: Retained for as long as your account is active to provide historical analysis and performance tracking.</li>
            <li>AI-generated content (posts, strategies, archetypes, analysis): Retained until you delete it or delete your account.</li>
            <li>Chat history: Retained for as long as your account is active. Individual chat sessions can be deleted at any time.</li>
            <li>Knowledge base items: Retained until you delete them or delete your account.</li>
            <li>Access tokens: Retained and refreshed automatically. Deleted immediately upon disconnection or account deletion.</li>
          </ul>
          <p>Upon account deletion, we will delete all your personal data, including stored posts, analytics, generated content, voice profiles, chat history, knowledge base items, and access tokens within 30 days. Some data may persist in encrypted backups for up to 90 days before being permanently removed.</p>

          <h2>6. Your Rights and Choices</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access your data:</strong> View all data we store about you through your account dashboard.</li>
            <li><strong>Edit your data:</strong> Update your profile, niche, and preferences at any time.</li>
            <li><strong>Disconnect Threads:</strong> Revoke our access to your Threads account at any time through Settings. This immediately stops all data fetching and publishing.</li>
            <li><strong>Delete your content:</strong> Delete any or all AI-generated posts from your queue.</li>
            <li><strong>Delete your chat history:</strong> Delete individual chat sessions or all chat history at any time.</li>
            <li><strong>Delete knowledge base items:</strong> Remove any uploaded knowledge base content at any time.</li>
            <li><strong>Delete your account:</strong> Permanently delete your account and all associated data through Settings.</li>
            <li><strong>Export your data:</strong> Request a copy of your data by contacting us at the email below.</li>
            <li><strong>Revoke Meta permissions:</strong> You can also revoke Threadable's access directly from your Threads app under Settings → Account → Website Permissions.</li>
          </ul>

          <h2>7. Cookies</h2>
          <p>We use essential cookies to maintain your authentication session. We do not use third-party advertising cookies or tracking pixels. We may use basic analytics to understand how the Service is used in aggregate.</p>

          <h2>8. Children's Privacy</h2>
          <p>Threadable is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that a child under 18 has provided us with personal information, we will take steps to delete such information.</p>

          <h2>9. Data Sharing</h2>
          <p>We do not sell, rent, or trade your personal information to third parties. We only share data as described in Section 3 (with Meta, OpenAI, Anthropic, and Supabase) as necessary to provide the Service.</p>
          <p>We may disclose your information if required by law, legal process, or government request, or to protect the rights, property, or safety of Threadable, our users, or the public.</p>

          <h2>10. International Data Transfers</h2>
          <p>Your data may be processed and stored in the United States or other countries where our service providers operate. By using the Service, you consent to the transfer of your data to these locations.</p>

          <h2>11. California Privacy Rights (CCPA)</h2>
          <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete your personal information, and the right to opt-out of the sale of personal information. We do not sell personal information.</p>
          <p>To exercise your CCPA rights, contact us at the email address below.</p>

          <h2>12. European Privacy Rights (GDPR)</h2>
          <p>If you are located in the European Economic Area (EEA) or United Kingdom, you have additional rights under the General Data Protection Regulation (GDPR), including the right to access, rectification, erasure, restriction, data portability, and objection. Our legal basis for processing your data is your consent (provided when you create an account and connect your Threads account) and our legitimate interest in providing and improving the Service.</p>
          <p>To exercise your GDPR rights, contact us at the email address below.</p>

          <h2>13. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice within the Service or sending you an email. Your continued use of the Service after changes are posted constitutes acceptance of the updated policy.</p>

          <h2>14. Contact Us</h2>
          <p>If you have questions about this Privacy Policy or your data, contact us at:</p>
          <p>
            Threadable.ai<br />
            Email: <a href="mailto:privacy@threadable.ai">privacy@threadable.ai</a><br />
            Website: <a href="https://threadable.ai" target="_blank" rel="noopener noreferrer">https://threadable.ai</a>
          </p>

          <div className="privacy-divider" />
          <Link to="/" className="privacy-back">← Back to Home</Link>
        </div>
      </div>
    </>
  );
};

export default Privacy;
