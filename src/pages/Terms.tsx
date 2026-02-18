import { Link } from "react-router-dom";
import { useEffect } from "react";

const Terms = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
        .legal-content h3 {
          font-size: 1rem;
          font-weight: 700;
          color: white;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
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
          <h1>Terms of Service</h1>
          <p className="legal-subtitle">Effective Date: February 18, 2026 | Company: Threadable.ai (operated by Aesthetic Bosses LLC)</p>

          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using Threadable.ai ("Threadable," "we," "us," or "our"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. These Terms apply to all visitors, users, and others who access or use the Service.</p>

          <h2>2. Description of Service</h2>
          <p>Threadable is an AI-powered content strategy and scheduling platform designed to help creators grow their presence on Meta Threads. The Service includes:</p>
          <ul>
            <li>AI-powered content analysis and regression insights based on your post performance</li>
            <li>Automated content generation in your voice and style</li>
            <li>Content scheduling and auto-publishing to Threads on your behalf</li>
            <li>Strategy generation, archetype discovery, and audience growth tools</li>
            <li>A knowledge base, story vault, and identity profile to personalize AI outputs</li>
          </ul>
          <p>We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time with reasonable notice.</p>

          <h2>3. User Accounts</h2>
          <p>To use the Service, you must create an account with a valid email address and password. You are responsible for:</p>
          <ul>
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activity that occurs under your account</li>
            <li>Notifying us immediately of any unauthorized use of your account</li>
          </ul>
          <p>You must be at least 18 years of age to create an account. By creating an account, you represent and warrant that you meet this age requirement.</p>

          <h2>4. User Content</h2>
          <p>You retain full ownership of all content you create, upload, or provide through the Service, including your identity profile, stories, writing samples, knowledge base entries, and any posts you publish.</p>
          <p>By using the Service, you grant Threadable a limited, non-exclusive license to use your content solely for the purpose of providing and improving the Service — including processing it through AI models to generate personalized content strategies, drafts, and insights.</p>
          <p>We do not sell your content, use it to train AI models for third parties, or share it with any party other than the AI providers necessary to operate the Service (OpenAI and Anthropic), as described in our Privacy Policy.</p>

          <h2>5. Prohibited Uses</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Violate any applicable law or regulation</li>
            <li>Publish spam, misleading content, or engage in coordinated inauthentic behavior</li>
            <li>Harass, threaten, or harm other individuals</li>
            <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
            <li>Reverse engineer, decompile, or attempt to extract source code from the Service</li>
            <li>Use the Service to generate content that violates Meta's Community Standards or Threads Terms of Use</li>
            <li>Resell, sublicense, or commercialize access to the Service without our written consent</li>
          </ul>

          <h2>6. Third-Party Services</h2>
          <p>The Service integrates with Meta's Threads API to access your account data and publish content on your behalf. By connecting your Threads account, you also agree to Meta's Terms of Service and Platform Terms.</p>
          <p>We are not responsible for any changes to Meta's API, platform policies, or service availability that may affect the functionality of Threadable. Your use of connected third-party services is subject to their respective terms and privacy policies.</p>

          <h2>7. Intellectual Property</h2>
          <p>All proprietary technology, software, designs, and branding that make up the Threadable platform are owned by Aesthetic Bosses LLC and protected by applicable intellectual property laws. You may not copy, reproduce, or create derivative works from any part of the platform without our express written permission.</p>
          <p>AI-generated content produced by the Service using your inputs is owned by you. We make no claim to ownership of the posts, strategies, or other outputs generated on your behalf.</p>

          <h2>8. Disclaimer of Warranties</h2>
          <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, THREADABLE DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
          <p>We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components. We do not guarantee specific outcomes such as follower growth, engagement increases, or revenue from your use of the Service.</p>

          <h2>9. Limitation of Liability</h2>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, AESTHETIC BOSSES LLC AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.</p>
          <p>OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.</p>

          <h2>10. Termination</h2>
          <p>You may terminate your account at any time through the Settings page. Upon termination, your account and all associated data will be deleted within 30 days as described in our Privacy Policy.</p>
          <p>We reserve the right to suspend or terminate your account immediately if you violate these Terms, engage in prohibited uses, or if continued provision of the Service becomes legally or technically untenable.</p>

          <h2>11. Changes to Terms</h2>
          <p>We may update these Terms from time to time. We will notify you of material changes by posting a notice within the Service or by email. Your continued use of the Service after changes take effect constitutes your acceptance of the updated Terms.</p>

          <h2>12. Governing Law</h2>
          <p>These Terms shall be governed by and construed in accordance with the laws of the State of Colorado, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved in the state or federal courts located in Colorado.</p>

          <h2>13. Contact</h2>
          <p>If you have questions about these Terms, please contact us at:</p>
          <p>
            Threadable.ai (Aesthetic Bosses LLC)<br />
            Email: <a href="mailto:support@threadable.ai">support@threadable.ai</a><br />
            Website: <a href="https://threadable.ai" target="_blank" rel="noopener noreferrer">https://threadable.ai</a>
          </p>

          <div className="legal-divider" />
          <Link to="/" className="legal-back">← Back to Home</Link>
        </div>
      </div>
    </>
  );
};

export default Terms;
