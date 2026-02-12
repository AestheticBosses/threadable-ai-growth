import { useState, useEffect, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

const Landing = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "duplicate" | "error">("idle");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setStatus("loading");
    const { error } = await supabase.from("waitlist_signups").insert({ email: trimmed });
    if (error) {
      if (error.code === "23505") {
        setStatus("duplicate");
      } else {
        setStatus("error");
      }
    } else {
      setStatus("success");
    }
  };

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const featureTabs = [
    { title: "Regression insights", desc: "AI-powered analysis of what actually drives your metrics — with data to prove it." },
    { title: "Archetype discovery", desc: "Discovers your unique content archetypes and what each one drives." },
    { title: "Content queue", desc: "AI-generated posts with archetype tags, funnel stages, and scores." },
    { title: "Story vault", desc: "Your real data vault — the AI only uses facts you've verified." },
  ];

  const faqs = [
    { q: "How is this different from other AI writing tools?", a: "Most AI tools generate generic content from a prompt. Threadable analyzes YOUR existing posts with regression analysis, discovers YOUR unique content archetypes, and writes in YOUR voice using YOUR real stories and data. It's not a writing tool — it's a growth engine built on your data." },
    { q: "Do I need existing Threads posts?", a: "Having posts helps — Threadable can analyze 100+ posts to build your personalized playbook. But if you're starting fresh, we'll suggest niche-based archetypes and help you fill your Story Vault so the AI has real material to work with from day one." },
    { q: "Will posts sound like me or like AI?", a: "Like you. Threadable uses your Story Vault (real numbers, real stories, real offers) and Voice Training to match your tone. Every post goes through a context check to make sure it never makes up facts or misattributes your experience." },
    { q: "Can it actually post to Threads automatically?", a: "Yes. Threadable connects to the official Threads API and can auto-publish up to 30 posts per day at your optimal posting times. You can also review and approve posts before they go live." },
    { q: 'What does "regression analysis" mean?', a: "Statistical analysis that identifies which variables — post length, hook style, time of day, topic — actually correlate with your key metrics. Instead of guessing what works, you get data-backed answers specific to your audience." },
    { q: "How much does Threadable cost?", a: "We're launching with early access pricing soon. Join the waitlist to lock in founder pricing before we go live." },
  ];

  // Scroll reveal observer
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.animation = 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both';
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.step-card, .ba-card, .arch-card, .founder-grid').forEach(el => {
      (el as HTMLElement).style.opacity = '0';
      obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <style>{`
        :root {
          --bg: #0a0a0f;
          --bg-card: #0d0d14;
          --bg-elevated: #111118;
          --surface: #16151e;
          --surface-light: #1c1b26;
          --border: rgba(168, 85, 247, 0.12);
          --border-solid: #1e1d2a;
          --border-light: rgba(168, 85, 247, 0.25);
          --border-dashed: rgba(168, 85, 247, 0.18);
          --text: #e8e4de;
          --text-muted: #8a8680;
          --text-dim: #6b6766;
          --accent: #a855f7;
          --accent-glow: rgba(168, 85, 247, 0.15);
          --accent-light: #c084fc;
          --accent-deep: #7c3aed;
          --green: #22c55e;
          --green-dim: rgba(34, 197, 94, 0.15);
          --yellow: #eab308;
          --yellow-dim: rgba(234, 179, 8, 0.15);
          --red: #ef4444;
          --orange: #f97316;
          --blue: #3b82f6;
          --font-display: 'Instrument Serif', Georgia, serif;
          --font-body: 'DM Sans', -apple-system, sans-serif;
          --font-mono: 'Space Mono', monospace;
          --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
        }

        .landing-root { background: var(--bg); color: var(--text); font-family: var(--font-body); line-height: 1.6; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
        .landing-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 9999;
        }

        .landing-root nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0.9rem 2rem;
          backdrop-filter: blur(20px) saturate(1.5);
          background: rgba(10, 10, 15, 0.85);
          border-bottom: 1px solid var(--border-solid);
        }
        .nav-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
        .logo { display: flex; align-items: center; gap: 0.6rem; text-decoration: none; color: var(--text); cursor: pointer; }
        .logo-icon {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, var(--accent), var(--accent-deep));
          border-radius: 8px; display: flex; align-items: center; justify-content: center;
          font-size: 0.95rem; font-weight: 700; color: white;
        }
        .logo-text { font-family: var(--font-body); font-size: 1rem; font-weight: 600; letter-spacing: -0.01em; }
        .nav-links { display: flex; align-items: center; gap: 2rem; list-style: none; }
        .nav-links a { color: var(--text-muted); text-decoration: none; font-size: 0.85rem; transition: color 0.2s; cursor: pointer; }
        .nav-links a:hover { color: var(--text); }
        .nav-cta { display: flex; gap: 0.75rem; align-items: center; }
        .btn-primary {
          padding: 0.5rem 1.3rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600;
          color: white; background: linear-gradient(135deg, var(--accent), var(--accent-deep));
          text-decoration: none; border: none; cursor: pointer; font-family: var(--font-body);
          transition: all 0.25s var(--ease-out); box-shadow: 0 0 20px var(--accent-glow);
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 30px var(--accent-glow); filter: brightness(1.1); }
        .btn-large { padding: 0.85rem 2rem; font-size: 1rem; border-radius: 10px; }
        .btn-outline {
          padding: 0.85rem 2rem; border-radius: 10px; font-size: 1rem; font-weight: 500;
          color: var(--text); background: transparent; border: 1px solid var(--border-solid);
          text-decoration: none; cursor: pointer; font-family: var(--font-body); transition: all 0.25s;
        }
        .btn-outline:hover { border-color: var(--accent); background: rgba(168, 85, 247, 0.05); }

        .hero-section { padding: 9rem 2rem 4rem; text-align: center; position: relative; overflow: hidden; }
        .hero-section::before {
          content: ''; position: absolute; top: -250px; left: 50%; transform: translateX(-50%);
          width: 900px; height: 900px;
          background: radial-gradient(ellipse, rgba(168, 85, 247, 0.12) 0%, rgba(124, 58, 237, 0.05) 40%, transparent 65%);
          pointer-events: none;
        }
        .hero-inner { max-width: 820px; margin: 0 auto; position: relative; z-index: 1; }

        .superlabel {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.35rem 0.9rem; border-radius: 100px;
          background: var(--surface); border: 1px solid var(--border);
          font-family: var(--font-mono); font-size: 0.65rem; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent);
          margin-bottom: 1.75rem; animation: fadeUp 0.8s var(--ease-out) both;
        }
        .superlabel .sparkle { font-size: 0.8rem; }

        .landing-root h1 {
          font-family: var(--font-display); font-size: clamp(2.6rem, 5.5vw, 4rem);
          line-height: 1.08; letter-spacing: -0.03em; font-weight: 400; margin-bottom: 1.25rem;
          animation: fadeUp 0.8s 0.1s var(--ease-out) both;
          background: linear-gradient(90deg, var(--text) 30%, var(--accent-light));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .landing-root h1 em { font-style: italic; -webkit-text-fill-color: var(--accent-light); }

        .hero-sub {
          font-size: 1.05rem; color: var(--text-muted); max-width: 560px;
          margin: 0 auto 2.25rem; line-height: 1.7;
          animation: fadeUp 0.8s 0.2s var(--ease-out) both;
        }
        .hero-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-bottom: 2.5rem; animation: fadeUp 0.8s 0.3s var(--ease-out) both; }

        .hero-pills {
          display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-bottom: 3rem;
          animation: fadeUp 0.8s 0.35s var(--ease-out) both;
        }
        .pill {
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.4rem 0.85rem; border-radius: 100px;
          background: var(--surface); border: 1px solid var(--border-solid);
          font-size: 0.78rem; color: var(--text-dim); cursor: default; transition: all 0.3s var(--ease-out);
        }
        .pill:hover { border-color: var(--accent); color: var(--text); box-shadow: 0 0 16px var(--accent-glow); }

        .proof-bar { display: flex; align-items: center; justify-content: center; gap: 1.75rem; flex-wrap: wrap; animation: fadeUp 0.8s 0.4s var(--ease-out) both; }
        .proof-stat { display: flex; align-items: center; gap: 0.5rem; }
        .proof-number { font-family: var(--font-mono); font-size: 1.1rem; font-weight: 700; color: var(--accent-light); }
        .proof-label { font-size: 0.72rem; color: var(--text-dim); line-height: 1.3; }
        .proof-divider { width: 1px; height: 28px; background: var(--border-solid); }

        .app-preview { max-width: 1140px; margin: 3.5rem auto 0; padding: 0 1.5rem; animation: fadeUp 1s 0.5s var(--ease-out) both; }
        .preview-frame {
          border-radius: 14px; border: 1px solid var(--border-solid);
          background: var(--bg); overflow: hidden;
          box-shadow: 0 40px 80px -20px rgba(0,0,0,0.6), 0 0 80px rgba(168, 85, 247, 0.08);
        }
        .preview-topbar { display: flex; align-items: center; gap: 6px; padding: 10px 14px; border-bottom: 1px solid var(--border-solid); background: var(--bg-card); }
        .preview-dot { width: 12px; height: 12px; border-radius: 50%; }
        .preview-dot.r { background: #EF4444; } .preview-dot.y { background: #EAB308; } .preview-dot.g { background: #22C55E; }

        .preview-layout { display: grid; grid-template-columns: 190px 1fr; min-height: 480px; }

        .app-sidebar {
          background: var(--bg-card); border-right: 1px solid var(--border-solid);
          padding: 1rem 0.6rem; display: flex; flex-direction: column; gap: 2px;
        }
        .app-sidebar-brand { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.6rem 1rem; }
        .app-sidebar-brand .logo-icon { width: 26px; height: 26px; font-size: 0.75rem; border-radius: 6px; }
        .app-sidebar-brand span { font-size: 0.82rem; font-weight: 600; }
        .sidebar-item {
          display: flex; align-items: center; gap: 0.55rem;
          padding: 0.5rem 0.7rem; border-radius: 7px; font-size: 0.78rem; color: var(--text-muted);
          cursor: default; transition: all 0.15s;
        }
        .sidebar-item.active { background: var(--accent); color: white; font-weight: 500; }
        .sidebar-item .si-icon { font-size: 0.85rem; width: 18px; text-align: center; }

        .app-main { padding: 1.25rem 1.5rem; overflow: hidden; background: var(--bg); }

        .app-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem; }
        .app-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 2px; }
        .app-subtitle { font-size: 0.72rem; color: var(--text-dim); }
        .app-header-actions { display: flex; gap: 0.5rem; align-items: center; }
        .app-btn {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.4rem 0.85rem; border-radius: 7px; font-size: 0.7rem; font-weight: 600;
          border: none; cursor: default; font-family: var(--font-body);
        }
        .app-btn-purple { background: linear-gradient(135deg, var(--accent), var(--accent-deep)); color: white; }
        .app-btn-outline { background: transparent; border: 1px solid var(--border-solid); color: var(--text-muted); }
        .time-pills { display: flex; gap: 0; }
        .time-pill {
          padding: 0.3rem 0.6rem; font-size: 0.62rem; font-weight: 500;
          border: 1px solid var(--border-solid); color: var(--text-dim); cursor: default;
          background: transparent;
        }
        .time-pill:first-child { border-radius: 5px 0 0 5px; }
        .time-pill:last-child { border-radius: 0 5px 5px 0; }
        .time-pill.active { background: var(--green); color: var(--bg); border-color: var(--green); font-weight: 700; }

        .app-user { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .app-user-left { display: flex; align-items: center; gap: 0.6rem; }
        .app-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--surface-light); }
        .app-username { font-size: 0.82rem; font-weight: 500; }
        .app-followers { font-size: 0.78rem; color: var(--text-dim); }
        .app-followers b { font-family: var(--font-display); font-size: 1.1rem; color: var(--text); margin-left: 0.3rem; }

        .stat-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; margin-bottom: 1rem; }
        .stat-card {
          background: var(--bg-card); border: 1px solid var(--border-solid); border-radius: 8px;
          padding: 0.65rem 0.7rem;
        }
        .stat-label {
          font-family: var(--font-mono); font-size: 0.5rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-dim);
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem;
        }
        .stat-label-icon { font-size: 0.65rem; opacity: 0.5; }
        .stat-value { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.02em; }
        .stat-change { font-size: 0.55rem; color: var(--green); margin-top: 1px; }

        .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
        .chart-card {
          background: var(--bg-card); border: 1px solid var(--border-solid); border-radius: 8px;
          padding: 0.85rem; min-height: 130px; position: relative; overflow: hidden;
        }
        .chart-title { font-size: 0.75rem; font-weight: 600; margin-bottom: 0.5rem; }
        .mini-chart { width: 100%; height: 80px; }
        .chart-line { fill: none; stroke: var(--accent); stroke-width: 2; }
        .chart-area { fill: url(#purpleGrad); opacity: 0.3; }

        .landing-section { padding: 6rem 2rem; position: relative; scroll-margin-top: 80px; }
        .section-inner { max-width: 1100px; margin: 0 auto; }
        .section-label {
          display: inline-flex; align-items: center; gap: 0.4rem;
          font-family: var(--font-mono); font-size: 0.65rem; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent);
          margin-bottom: 0.75rem;
        }
        .section-title {
          font-family: var(--font-display); font-size: clamp(1.9rem, 3.5vw, 2.6rem);
          line-height: 1.15; letter-spacing: -0.02em; margin-bottom: 0.6rem; font-weight: 400;
        }
        .section-sub { font-size: 0.95rem; color: var(--text-muted); max-width: 560px; line-height: 1.65; margin-bottom: 2.5rem; }

        .feature-section { display: grid; grid-template-columns: 300px 1fr; gap: 2.5rem; align-items: start; }
        .feature-tabs { display: flex; flex-direction: column; gap: 3px; position: sticky; top: 100px; }
        .feature-tab {
          padding: 0.85rem 1rem; border-radius: 10px; cursor: pointer;
          transition: all 0.3s var(--ease-out); border: 1px solid transparent;
        }
        .feature-tab:hover { background: var(--bg-card); }
        .feature-tab.active { background: var(--bg-card); border-color: var(--border-solid); }
        .feature-tab-title { font-weight: 600; font-size: 0.88rem; margin-bottom: 0.2rem; }
        .feature-tab.active .feature-tab-title { color: var(--accent-light); }
        .feature-tab-desc { font-size: 0.75rem; color: var(--text-dim); line-height: 1.4; }

        .feature-visual { border-radius: 14px; border: 1px solid var(--border-solid); background: var(--bg-card); min-height: 380px; overflow: hidden; }
        .feature-visual-inner { padding: 1.5rem; display: none; flex-direction: column; gap: 0.75rem; animation: fadeIn 0.4s var(--ease-out); }
        .feature-visual-inner.active { display: flex; }

        .insight-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
        .insight-card-real {
          background: var(--bg); border: 1px solid var(--border-solid); border-radius: 10px; padding: 1rem;
        }
        .insight-cat {
          font-family: var(--font-mono); font-size: 0.55rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 0.5rem;
          display: flex; align-items: center; justify-content: space-between;
        }
        .insight-badges { display: flex; gap: 0.3rem; }
        .ibadge {
          font-size: 0.52rem; padding: 0.12rem 0.4rem; border-radius: 4px; font-weight: 700;
        }
        .ibadge-views { background: var(--green-dim); color: var(--green); }
        .ibadge-strong { background: var(--green-dim); color: var(--green); }
        .ibadge-moderate { background: var(--yellow-dim); color: var(--yellow); }
        .insight-headline { font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem; line-height: 1.35; }
        .insight-body { font-size: 0.68rem; color: var(--text-dim); line-height: 1.4; margin-bottom: 0.4rem; }
        .insight-action { font-size: 0.68rem; color: var(--green); font-weight: 600; }
        .insight-action::before { content: '→ '; }

        .archetype-grid-real { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 0.75rem; }
        .archetype-grid-real-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
        .arch-card {
          border: 1px dashed; border-radius: 10px; padding: 1rem;
          background: var(--bg-card); position: relative;
        }
        .arch-card-orange { border-color: rgba(249, 115, 22, 0.4); }
        .arch-card-green { border-color: rgba(34, 197, 94, 0.4); }
        .arch-card-yellow { border-color: rgba(234, 179, 8, 0.4); }
        .arch-card-red { border-color: rgba(239, 68, 68, 0.4); }
        .arch-card-purple { border-color: rgba(168, 85, 247, 0.4); }
        .arch-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem; }
        .arch-name { font-size: 0.82rem; font-weight: 700; display: flex; align-items: center; gap: 0.3rem; }
        .arch-name-orange { color: var(--orange); }
        .arch-name-green { color: var(--green); }
        .arch-name-yellow { color: var(--yellow); }
        .arch-name-red { color: var(--red); }
        .arch-name-purple { color: var(--accent-light); }
        .arch-pct {
          font-size: 0.62rem; padding: 0.15rem 0.5rem; border-radius: 100px;
          background: var(--surface); color: var(--text-dim); font-weight: 600;
        }
        .arch-desc { font-size: 0.68rem; color: var(--text-dim); margin-bottom: 0.5rem; line-height: 1.35; }
        .arch-stats { font-size: 0.65rem; color: var(--text-dim); margin-bottom: 0.5rem; }
        .arch-stats b { color: var(--text-muted); font-weight: 600; }
        .arch-stats .eng-highlight { color: var(--green); font-family: var(--font-mono); font-weight: 700; font-size: 0.7rem; }
        .arch-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.4rem; }
        .arch-tag {
          font-size: 0.55rem; padding: 0.15rem 0.45rem; border-radius: 4px;
          background: var(--surface-light); color: var(--text-dim); border: 1px solid var(--border-solid);
        }
        .arch-best { font-size: 0.62rem; color: var(--text-dim); font-style: italic; }

        .cq-calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.4rem; margin-bottom: 0.75rem; }
        .cq-day {
          text-align: center; padding: 0.5rem 0.3rem; border-radius: 8px;
          border: 1px solid var(--border-solid); background: var(--bg);
          font-size: 0.6rem; color: var(--text-dim);
        }
        .cq-day.today { border-color: var(--accent); color: var(--accent-light); }
        .cq-day-num { font-size: 1rem; font-weight: 700; color: var(--text); margin: 0.1rem 0; }
        .cq-day.today .cq-day-num { color: var(--accent-light); }
        .cq-day-posts { font-size: 0.55rem; }
        .cq-dots { display: flex; gap: 3px; justify-content: center; margin-top: 3px; }
        .cq-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
        .cq-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border-solid); margin-bottom: 0.6rem; }
        .cq-tab { padding: 0.4rem 0.7rem; font-size: 0.68rem; color: var(--text-dim); border-bottom: 2px solid transparent; cursor: default; }
        .cq-tab.active { color: var(--text); border-bottom-color: var(--accent); }
        .cq-funnel-pills { display: flex; gap: 0.4rem; margin-bottom: 0.75rem; }
        .cq-pill {
          font-size: 0.6rem; padding: 0.2rem 0.55rem; border-radius: 100px;
          border: 1px solid var(--border-solid); color: var(--text-dim); cursor: default;
        }
        .cq-pill.active { border-color: var(--green); color: var(--green); background: rgba(34,197,94,0.08); }
        .cq-post {
          background: var(--bg); border: 1px solid var(--border-solid); border-radius: 10px;
          padding: 1rem; margin-bottom: 0.5rem;
        }
        .cq-post-header { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
        .cq-badge { font-size: 0.58rem; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700; }
        .cq-badge-arch { background: var(--surface-light); color: var(--text); border: 1px solid var(--border-solid); }
        .cq-badge-tof { background: rgba(168,85,247,0.12); color: var(--accent-light); }
        .cq-badge-mof { background: rgba(234,179,8,0.12); color: var(--yellow); }
        .cq-badge-score { background: rgba(34,197,94,0.1); color: var(--green); }
        .cq-date { font-size: 0.62rem; color: var(--text-dim); margin-left: auto; }
        .cq-text { font-size: 0.78rem; color: var(--text-muted); line-height: 1.55; margin-bottom: 0.5rem; }
        .cq-chars { font-family: var(--font-mono); font-size: 0.58rem; color: var(--text-dim); margin-bottom: 0.5rem; }
        .cq-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
        .cq-action {
          display: inline-flex; align-items: center; gap: 0.25rem;
          padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.62rem; font-weight: 500;
          border: 1px solid var(--border-solid); background: var(--bg-card); color: var(--text-dim);
          cursor: default;
        }
        .cq-action-publish { background: linear-gradient(135deg, var(--accent), var(--accent-deep)); border-color: transparent; color: white; }

        .story-card {
          background: var(--bg); border: 1px dashed var(--border-dashed); border-radius: 10px; padding: 1rem;
        }
        .story-section-title { font-size: 0.82rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem; }
        .story-section-sub { font-size: 0.65rem; color: var(--text-dim); margin-bottom: 0.75rem; }
        .story-row {
          display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;
        }
        .story-input {
          background: var(--surface); border: 1px solid var(--border-solid); border-radius: 7px;
          padding: 0.5rem 0.7rem; font-size: 0.7rem; color: var(--text-muted);
        }
        .story-entry { margin-bottom: 0.75rem; padding: 0.75rem; background: var(--surface); border-radius: 8px; border: 1px solid var(--border-solid); }
        .story-entry-title { font-size: 0.75rem; font-weight: 600; margin-bottom: 0.2rem; }
        .story-entry-body { font-size: 0.65rem; color: var(--text-dim); line-height: 1.4; }

        .steps-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; }
        .step-card {
          background: var(--bg-card); border: 1px solid var(--border-solid); border-radius: 12px;
          padding: 1.75rem 1.25rem; position: relative; transition: all 0.3s var(--ease-out);
        }
        .step-card:hover { border-color: var(--border-light); transform: translateY(-3px); box-shadow: 0 16px 40px -10px rgba(0,0,0,0.3); }
        .step-number { font-family: var(--font-display); font-size: 2.5rem; color: var(--border-solid); line-height: 1; margin-bottom: 0.75rem; }
        .step-card:hover .step-number { color: rgba(168, 85, 247, 0.25); }
        .step-icon { font-size: 1.3rem; margin-bottom: 0.6rem; }
        .step-title { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.3rem; }
        .step-desc { font-size: 0.78rem; color: var(--text-dim); line-height: 1.5; }

        .before-after { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem; }
        .ba-card { border-radius: 14px; padding: 2rem 1.75rem; }
        .ba-before { background: var(--bg-card); border: 1px solid var(--border-solid); }
        .ba-after { background: linear-gradient(135deg, rgba(168,85,247,0.05), rgba(124,58,237,0.03)); border: 1px solid rgba(168,85,247,0.15); }
        .ba-label { font-family: var(--font-mono); font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1.25rem; }
        .ba-before .ba-label { color: var(--text-dim); }
        .ba-after .ba-label { color: var(--accent); }
        .ba-list { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; padding: 0; margin: 0; }
        .ba-list li { display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.85rem; line-height: 1.4; }
        .ba-before .ba-list li { color: var(--text-dim); }
        .ba-after .ba-list li { color: var(--text-muted); }
        .ba-icon { flex-shrink: 0; margin-top: 0.1rem; font-size: 0.85rem; }

        .founder-section-bg { background: var(--bg-card); border-top: 1px solid var(--border-solid); border-bottom: 1px solid var(--border-solid); }
        .founder-grid { display: grid; grid-template-columns: 240px 1fr; gap: 3rem; align-items: center; }
        .founder-image {
          aspect-ratio: 1; border-radius: 14px; background: linear-gradient(135deg, var(--surface), var(--bg-card));
          border: 1px dashed var(--border-dashed); display: flex; align-items: center; justify-content: center; font-size: 4rem;
          overflow: hidden;
        }
        .founder-content blockquote {
          font-family: var(--font-display); font-size: 1.35rem; line-height: 1.4;
          font-style: italic; margin-bottom: 1.25rem; color: var(--text); margin-left: 0; margin-right: 0;
        }
        .founder-name { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.15rem; }
        .founder-title { font-size: 0.78rem; color: var(--text-dim); margin-bottom: 0.85rem; }
        .founder-stats { display: flex; gap: 1.75rem; }
        .founder-stat-value { font-family: var(--font-mono); font-size: 1rem; font-weight: 700; color: var(--accent-light); }
        .founder-stat-label { font-size: 0.65rem; color: var(--text-dim); }

        .faq-grid { max-width: 680px; margin: 0 auto; }
        .faq-item { border-bottom: 1px solid var(--border-solid); }
        .faq-q {
          width: 100%; background: none; border: none; color: var(--text); font-family: var(--font-body);
          font-size: 0.95rem; font-weight: 500; text-align: left; padding: 1.1rem 0;
          cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 1rem; transition: color 0.2s;
        }
        .faq-q:hover { color: var(--accent-light); }
        .faq-icon { font-size: 1.1rem; color: var(--text-dim); transition: transform 0.3s var(--ease-out); flex-shrink: 0; }
        .faq-item.open .faq-icon { transform: rotate(45deg); }
        .faq-a { max-height: 0; overflow: hidden; transition: max-height 0.4s var(--ease-out); font-size: 0.85rem; color: var(--text-muted); line-height: 1.65; }
        .faq-item.open .faq-a { max-height: 300px; padding-bottom: 1rem; }

        .cta-section { text-align: center; padding: 7rem 2rem; position: relative; overflow: hidden; scroll-margin-top: 80px; }
        .cta-section::before {
          content: ''; position: absolute; bottom: -300px; left: 50%; transform: translateX(-50%);
          width: 900px; height: 600px;
          background: radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, rgba(124,58,237,0.05) 40%, transparent 65%);
          pointer-events: none;
        }
        .cta-inner { position: relative; z-index: 1; max-width: 680px; margin: 0 auto; }
        .cta-inner h2 {
          font-family: var(--font-display); font-size: clamp(2rem, 4.5vw, 3rem);
          line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 0.85rem; font-weight: 400;
        }
        .cta-inner h2 em { font-style: italic; color: var(--accent-light); }
        .cta-sub { font-size: 1rem; color: var(--text-muted); margin-bottom: 2rem; }

        .waitlist-form {
          display: flex; gap: 0; max-width: 520px; margin: 0 auto;
          border-radius: 12px; overflow: hidden;
        }
        .waitlist-input {
          flex: 1; padding: 1rem 1.25rem; font-size: 1rem; font-family: var(--font-body);
          background: var(--surface); border: 1px solid var(--border-solid);
          border-right: none; border-radius: 12px 0 0 12px;
          color: var(--text); outline: none; transition: border-color 0.2s;
        }
        .waitlist-input::placeholder { color: var(--text-dim); }
        .waitlist-input:focus { border-color: var(--accent); }
        .waitlist-btn {
          border-radius: 0 12px 12px 0; white-space: nowrap; padding: 1rem 1.5rem;
          font-size: 0.95rem; font-weight: 700;
        }

        .landing-footer {
          padding: 1.5rem 2rem; border-top: 1px solid var(--border-solid);
          text-align: center; font-size: 0.75rem; color: var(--text-dim);
        }
        .landing-footer a { color: var(--text-dim); text-decoration: none; }
        .landing-footer a:hover { color: var(--text-muted); }
        .footer-inner { max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; }

        .mobile-menu {
          display: none; background: none; border: none; cursor: pointer;
          flex-direction: column; gap: 4px; padding: 4px;
        }
        .mobile-menu span { display: block; width: 20px; height: 2px; background: var(--text-muted); border-radius: 1px; }

        .mobile-dropdown {
          display: none; position: fixed; top: 56px; left: 0; right: 0; z-index: 99;
          background: var(--bg-card); border-bottom: 1px solid var(--border-solid);
          flex-direction: column;
        }
        .mobile-dropdown.open { display: flex; }
        .mobile-dropdown a {
          padding: 1rem 2rem; color: var(--text-muted); text-decoration: none; font-size: 0.9rem;
          border-bottom: 1px solid var(--border-solid); cursor: pointer;
        }
        .mobile-dropdown a:hover { color: var(--text); }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        @media (max-width: 900px) {
          .preview-layout { grid-template-columns: 1fr; }
          .app-sidebar { display: none; }
          .stat-row { grid-template-columns: repeat(3, 1fr); }
          .app-header { flex-direction: column; gap: 0.75rem; }
          .app-header-actions { flex-wrap: wrap; }
          .feature-section { grid-template-columns: 1fr; }
          .feature-tabs { position: static; flex-direction: row; overflow-x: auto; gap: 0; }
          .feature-tab { min-width: 180px; flex-shrink: 0; }
          .steps-grid { grid-template-columns: 1fr 1fr; }
          .before-after { grid-template-columns: 1fr; }
          .founder-grid { grid-template-columns: 1fr; text-align: center; }
          .founder-image { max-width: 200px; margin: 0 auto; }
          .founder-stats { justify-content: center; }
          .archetype-grid-real { grid-template-columns: 1fr; }
          .archetype-grid-real-2 { grid-template-columns: 1fr; }
          .insight-grid { grid-template-columns: 1fr; }
          .cq-calendar { grid-template-columns: repeat(7, 1fr); }
          .cq-actions { flex-wrap: wrap; }
          .story-row { grid-template-columns: 1fr; }
          .waitlist-form { flex-direction: column; border-radius: 12px; }
          .waitlist-input { border-right: 1px solid var(--border-solid); border-radius: 12px 12px 0 0; }
          .waitlist-btn { border-radius: 0 0 12px 12px; }
        }
        @media (max-width: 600px) {
          .nav-links { display: none !important; }
          .mobile-menu { display: flex; }
          .hero-section { padding: 7rem 1.25rem 3rem; }
          .app-preview { display: none; }
          .steps-grid { grid-template-columns: 1fr; }
          .proof-bar { flex-direction: column; gap: 0.75rem; }
          .proof-divider { display: none; }
          .landing-section { padding: 4.5rem 1.25rem; }
          .stat-row { grid-template-columns: repeat(2, 1fr); }
          .feature-tabs { flex-direction: column; }
          .feature-tab { min-width: unset; }
          .cq-calendar { grid-template-columns: repeat(4, 1fr); }
          .cq-day:nth-child(n+5) { display: none; }
          .founder-stats { flex-wrap: wrap; gap: 1rem; }
          .footer-inner { flex-direction: column; text-align: center; }
        }
      `}</style>

      <div className="landing-root">
        {/* NAV */}
        <nav>
          <div className="nav-inner">
            <a href="#" className="logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <div className="logo-icon">T</div>
              <span className="logo-text">Threadable.ai</span>
            </a>
            <ul className="nav-links">
              <li><a onClick={() => scrollTo('features')}>Features</a></li>
              <li><a onClick={() => scrollTo('how-it-works')}>How It Works</a></li>
              <li><a onClick={() => scrollTo('story')}>Our Story</a></li>
              <li><a onClick={() => scrollTo('faq')}>FAQ</a></li>
            </ul>
            <div className="nav-cta">
              <button className="mobile-menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
                <span /><span /><span />
              </button>
              <a onClick={() => scrollTo('waitlist')} className="btn-primary" style={{ cursor: 'pointer' }}>Join the Waitlist</a>
            </div>
          </div>
        </nav>
        <div className={`mobile-dropdown${mobileMenuOpen ? ' open' : ''}`}>
          <a onClick={() => scrollTo('features')}>Features</a>
          <a onClick={() => scrollTo('how-it-works')}>How It Works</a>
          <a onClick={() => scrollTo('story')}>Our Story</a>
          <a onClick={() => scrollTo('faq')}>FAQ</a>
        </div>

        {/* HERO */}
        <section className="hero-section">
          <div className="hero-inner">
            <div className="superlabel"><span className="sparkle">✦</span> AI-Powered Threads Growth Engine</div>
            <h1>Grow your Threads audience<br /><em>without posting into the void</em></h1>
            <p className="hero-sub">Threadable analyzes what already works in your content, builds a custom playbook, writes posts in your voice, and auto-publishes — so your audience grows while you focus on what pays you.</p>
            <div className="hero-actions">
              <a onClick={() => scrollTo('waitlist')} className="btn-primary btn-large" style={{ cursor: 'pointer' }}>Join the Waitlist</a>
            </div>
            <div className="hero-pills">
              <span className="pill">📊 Regression analysis</span>
              <span className="pill">🧠 Voice matching</span>
              <span className="pill">✍️ Auto-write posts</span>
              <span className="pill">🚀 Auto-publish</span>
              <span className="pill">🎯 Funnel strategy</span>
            </div>
            <div className="proof-bar">
              <div className="proof-stat">
                <div>
                  <div className="proof-number">394K+</div>
                  <div className="proof-label">Interactions in 12 days<br />$0 ad spend</div>
                </div>
              </div>
              <div className="proof-divider" />
              <div className="proof-stat">
                <div>
                  <div className="proof-number">273</div>
                  <div className="proof-label">Posts analyzed<br />per account</div>
                </div>
              </div>
              <div className="proof-divider" />
              <div className="proof-stat">
                <div>
                  <div className="proof-number">30/day</div>
                  <div className="proof-label">Auto-publish<br />capacity</div>
                </div>
              </div>
            </div>
          </div>

          {/* APP PREVIEW */}
          <div className="app-preview">
            <div className="preview-frame">
              <div className="preview-topbar">
                <div className="preview-dot r" />
                <div className="preview-dot y" />
                <div className="preview-dot g" />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginLeft: 8 }}>threadable.ai</span>
              </div>
              <div className="preview-layout">
                {/* Sidebar */}
                <div className="app-sidebar">
                  <div className="app-sidebar-brand">
                    <div className="logo-icon">T</div>
                    <span>Threadable.ai</span>
                  </div>
                  <div className="sidebar-item active"><span className="si-icon">📊</span> Dashboard</div>
                  <div className="sidebar-item"><span className="si-icon">💡</span> Insights</div>
                  <div className="sidebar-item"><span className="si-icon">📋</span> Playbook</div>
                  <div className="sidebar-item"><span className="si-icon">✍️</span> Content Queue</div>
                  <div className="sidebar-item"><span className="si-icon">📖</span> My Story</div>
                  <div className="sidebar-item"><span className="si-icon">🎤</span> Voice</div>
                  <div className="sidebar-item"><span className="si-icon">⚙️</span> Settings</div>
                  <div style={{ flex: 1 }} />
                  <div style={{ padding: '0.5rem 0.7rem', fontSize: '0.65rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: 'white', fontWeight: 700 }}>J</div>
                    jourdan@aestheticbo...
                  </div>
                </div>

                {/* Main Content — Dashboard */}
                <div className="app-main">
                  <div className="app-header">
                    <div>
                      <div className="app-title">Dashboard</div>
                      <div className="app-subtitle">Your Threads analytics at a glance.</div>
                    </div>
                    <div className="app-header-actions">
                      <button className="app-btn app-btn-purple">🔄 Fetch My Posts</button>
                      <button className="app-btn app-btn-purple">🧠 Run Full Analysis</button>
                      <div className="time-pills">
                        <button className="time-pill active">All time</button>
                        <button className="time-pill">7 days</button>
                        <button className="time-pill">30 days</button>
                        <button className="time-pill">90 days</button>
                      </div>
                    </div>
                  </div>

                  <div className="app-user">
                    <div className="app-user-left">
                      <div className="app-avatar" />
                      <span className="app-username">Jourdan Eloriaga</span>
                    </div>
                    <span className="app-followers">Followers <b>2,075</b></span>
                  </div>

                  <div className="stat-row">
                    {[
                      { label: 'VIEWS', icon: '👁', value: '158,612' },
                      { label: 'LIKES', icon: '♡', value: '2,555' },
                      { label: 'REPLIES', icon: '💬', value: '670' },
                      { label: 'REPOSTS', icon: '🔁', value: '195' },
                      { label: 'QUOTES', icon: '❝', value: '31' },
                      { label: 'POSTS', icon: '📄', value: '273' },
                    ].map(s => (
                      <div className="stat-card" key={s.label}>
                        <div className="stat-label">{s.label} <span className="stat-label-icon">{s.icon}</span></div>
                        <div className="stat-value">{s.value}</div>
                        <div className="stat-change">↑ 100.0%</div>
                      </div>
                    ))}
                  </div>

                  <div className="chart-row">
                    <div className="chart-card">
                      <div className="chart-title">Follower Growth</div>
                      <svg className="mini-chart" viewBox="0 0 300 80" preserveAspectRatio="none">
                        <defs><linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0} /></linearGradient></defs>
                        <path className="chart-area" d="M0,70 L40,68 L80,65 L120,62 L160,58 L200,40 L240,35 L280,20 L300,15 L300,80 L0,80 Z" />
                        <path className="chart-line" d="M0,70 L40,68 L80,65 L120,62 L160,58 L200,40 L240,35 L280,20 L300,15" />
                      </svg>
                    </div>
                    <div className="chart-card">
                      <div className="chart-title">Views Per Post</div>
                      <svg className="mini-chart" viewBox="0 0 300 80" preserveAspectRatio="none">
                        <path className="chart-area" d="M0,75 L15,10 L30,45 L45,50 L60,55 L75,60 L90,62 L105,64 L120,66 L135,67 L150,68 L165,69 L180,70 L195,71 L210,72 L225,73 L240,74 L255,74 L270,75 L285,75 L300,75 L300,80 L0,80 Z" />
                        <path className="chart-line" d="M0,75 L15,10 L30,45 L45,50 L60,55 L75,60 L90,62 L105,64 L120,66 L135,67 L150,68 L165,69 L180,70 L195,71 L210,72 L225,73 L240,74 L255,74 L270,75 L285,75 L300,75" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES — ANALYZE */}
        <section id="features" className="landing-section">
          <div className="section-inner">
            <div className="section-label">✦ Analyze</div>
            <div className="section-title">Your content has patterns.<br />Threadable finds them.</div>
            <p className="section-sub">Regression analysis on your existing posts reveals exactly what drives views, engagement, and follows — then builds your strategy around it.</p>

            <div className="feature-section">
              <div className="feature-tabs">
                {featureTabs.map((tab, i) => (
                  <div key={i} className={`feature-tab${activeTab === i ? ' active' : ''}`} onClick={() => setActiveTab(i)}>
                    <div className="feature-tab-title">{tab.title}</div>
                    <div className="feature-tab-desc">{tab.desc}</div>
                  </div>
                ))}
              </div>

              <div className="feature-visual">
                {/* Tab 0: Regression Insights */}
                <div className={`feature-visual-inner${activeTab === 0 ? ' active' : ''}`}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.15rem' }}>AI-Powered Regression Insights</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>Deep analysis of what drives your content performance, powered by Claude.</div>
                  <div className="insight-grid">
                    <div className="insight-card-real">
                      <div className="insight-cat">HOOK TYPE <div className="insight-badges"><span className="ibadge ibadge-views">views</span><span className="ibadge ibadge-strong">strong</span></div></div>
                      <div className="insight-headline">Authority name-drops in opening lines drive massive view counts</div>
                      <div className="insight-body">Post #2 'Alex Hormozi's speed runner group' got 15,602 views, while generic hooks like Post #13 only got 1,982 views</div>
                      <div className="insight-action">Lead with recognizable names/brands when possible</div>
                    </div>
                    <div className="insight-card-real">
                      <div className="insight-cat">EMOTIONAL TRIGGERS <div className="insight-badges"><span className="ibadge ibadge-strong">strong</span></div></div>
                      <div className="insight-headline">Vulnerability + parental motivation creates highest engagement rates</div>
                      <div className="insight-body">Post #8 'No job ever loved you back' achieved 9.96% engagement rate, Post #48 about dads got 3.92% engagement</div>
                      <div className="insight-action">Combine business struggle with family motivation</div>
                    </div>
                    <div className="insight-card-real">
                      <div className="insight-cat">SPECIFICITY LEVEL <div className="insight-badges"><span className="ibadge ibadge-views">views</span><span className="ibadge ibadge-strong">strong</span></div></div>
                      <div className="insight-headline">Exact dollar amounts and specific numbers dramatically increase views</div>
                      <div className="insight-body">Posts with specific amounts ($5000, $100M, $30K/m) average 8,000+ views while vague posts get under 900</div>
                      <div className="insight-action">Always include specific numbers when possible</div>
                    </div>
                    <div className="insight-card-real">
                      <div className="insight-cat">CONTENT STRUCTURE <div className="insight-badges"><span className="ibadge ibadge-views">views</span><span className="ibadge ibadge-strong">strong</span></div></div>
                      <div className="insight-headline">Teaser hooks with implied value deliver get massive views</div>
                      <div className="insight-body">Post #1 'I paid $5000 to find out...' got 23,279 views, while direct advice posts average under 1,600</div>
                      <div className="insight-action">Create curiosity gaps with value promises</div>
                    </div>
                  </div>
                </div>

                {/* Tab 1: Archetype Discovery */}
                <div className={`feature-visual-inner${activeTab === 1 ? ' active' : ''}`}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.15rem' }}>Your Content Archetypes</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>AI-discovered patterns unique to your content.</div>
                  <div className="archetype-grid-real">
                    <div className="arch-card arch-card-orange">
                      <div className="arch-header"><span className="arch-name arch-name-orange">💫 Authority Insider Drop</span><span className="arch-pct">20%</span></div>
                      <div className="arch-desc">Leverages proximity to known figures to deliver insider...</div>
                      <div className="arch-stats">Posts: <b>168</b> &nbsp; Avg Views: <b>523</b> &nbsp; Avg Eng: <span className="eng-highlight">6.54%</span></div>
                      <div className="arch-tags"><span className="arch-tag">recognizable authority name</span><span className="arch-tag">specific dollar amount or outcome</span><span className="arch-tag">curiosity gap</span></div>
                      <div className="arch-best">Best: "I paid $5000 to find out what a social funnel is o..."</div>
                    </div>
                    <div className="arch-card arch-card-green">
                      <div className="arch-header"><span className="arch-name arch-name-green">🤯 Entrepreneurial Reality Check</span><span className="arch-pct">30%</span></div>
                      <div className="arch-desc">Brutally honest takes about the entrepreneurship experience...</div>
                      <div className="arch-stats">Posts: <b>43</b> &nbsp; Avg Views: <b>961</b> &nbsp; Avg Eng: <span className="eng-highlight">12.45%</span></div>
                      <div className="arch-tags"><span className="arch-tag">universal entrepreneur struggle</span><span className="arch-tag">specific time references</span><span className="arch-tag">vulnerability</span></div>
                      <div className="arch-best">Best: "I was in Alex Hormozi's speed runner group when he..."</div>
                    </div>
                    <div className="arch-card arch-card-yellow">
                      <div className="arch-header"><span className="arch-name arch-name-yellow">👨 Dad Builder Motivation</span><span className="arch-pct">15%</span></div>
                      <div className="arch-desc">Combines business building with fatherhood motivation, hittin...</div>
                      <div className="arch-stats">Posts: <b>25</b> &nbsp; Avg Views: <b>194</b> &nbsp; Avg Eng: <span className="eng-highlight">10.16%</span></div>
                      <div className="arch-tags"><span className="arch-tag">parent reference</span><span className="arch-tag">sacrifice/struggle element</span><span className="arch-tag">time specificity</span></div>
                      <div className="arch-best">Best: "Nobody claps for the first 10 followers. But those..."</div>
                    </div>
                  </div>
                  <div className="archetype-grid-real-2">
                    <div className="arch-card arch-card-red">
                      <div className="arch-header"><span className="arch-name arch-name-red">💣 Industry Hot Take Bomb</span><span className="arch-pct">20%</span></div>
                      <div className="arch-desc">Contrarian statements about marketing/business that challen...</div>
                      <div className="arch-stats">Posts: <b>14</b> &nbsp; Avg Views: <b>576</b> &nbsp; Avg Eng: <span className="eng-highlight">2.57%</span></div>
                      <div className="arch-tags"><span className="arch-tag">controversial statement</span><span className="arch-tag">industry-specific callout</span><span className="arch-tag">strong language</span></div>
                    </div>
                    <div className="arch-card arch-card-purple">
                      <div className="arch-header"><span className="arch-name arch-name-purple">📱 Millennial Entrepreneur Truth</span><span className="arch-pct">15%</span></div>
                      <div className="arch-desc">Speaks directly to 30-40 year old entrepreneurs with real...</div>
                      <div className="arch-stats">Posts: <b>23</b> &nbsp; Avg Views: <b>715</b> &nbsp; Avg Eng: <span className="eng-highlight">9.78%</span></div>
                      <div className="arch-tags"><span className="arch-tag">age reference</span><span className="arch-tag">real experience vs fake guru contrast</span><span className="arch-tag">cultural references</span></div>
                    </div>
                  </div>
                </div>

                {/* Tab 2: Content Queue */}
                <div className={`feature-visual-inner${activeTab === 2 ? ' active' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Content Queue</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>0 posts scheduled for today</div>
                    </div>
                    <button className="app-btn app-btn-purple" style={{ fontSize: '0.65rem' }}>✨ Generate Posts ▾</button>
                  </div>
                  <div className="cq-calendar">
                    <div className="cq-day"><div>Mon</div><div className="cq-day-num">9</div><div className="cq-day-posts">0 posts</div></div>
                    <div className="cq-day"><div>Tue</div><div className="cq-day-num">10</div><div className="cq-day-posts">0 posts</div></div>
                    <div className="cq-day today"><div>Wed</div><div className="cq-day-num">11</div><div className="cq-day-posts">0 posts</div></div>
                    <div className="cq-day"><div>Thu</div><div className="cq-day-num">12</div><div className="cq-day-posts">2 posts</div><div className="cq-dots"><div className="cq-dot" /><div className="cq-dot" /></div></div>
                    <div className="cq-day"><div>Fri</div><div className="cq-day-num">13</div><div className="cq-day-posts">0 posts</div></div>
                    <div className="cq-day"><div>Sat</div><div className="cq-day-num">14</div><div className="cq-day-posts">2 posts</div><div className="cq-dots"><div className="cq-dot" /><div className="cq-dot" /></div></div>
                    <div className="cq-day"><div>Sun</div><div className="cq-day-num">15</div><div className="cq-day-posts">0 posts</div></div>
                  </div>
                  <div className="cq-tabs">
                    <div className="cq-tab active">All (7)</div>
                    <div className="cq-tab">Draft (6)</div>
                    <div className="cq-tab">Approved (0)</div>
                    <div className="cq-tab">Scheduled (0)</div>
                    <div className="cq-tab">Published (0)</div>
                    <div className="cq-tab">Failed (1)</div>
                  </div>
                  <div className="cq-funnel-pills">
                    <span className="cq-pill active">All Funnel (7)</span>
                    <span className="cq-pill">TOF · Reach (6)</span>
                    <span className="cq-pill">MOF · Trust (1)</span>
                    <span className="cq-pill">BOF · Convert (0)</span>
                  </div>
                  <div className="cq-post">
                    <div className="cq-post-header">
                      <span className="cq-badge cq-badge-arch">Product Launch</span>
                      <span className="cq-badge cq-badge-mof">MOF · Trust</span>
                      <span className="cq-badge cq-badge-score">Score: 5/6</span>
                      <span className="cq-date">📅 Feb 12, 04:00</span>
                    </div>
                    <div className="cq-text">Get your hands on the AI playbook that actually speaks like a human so you can stop wasting 4 hours a day on content.<br /><br />Millennial founders are tired of the hustle culture "post 5x a day" hamster wheel. We want results so we can go to our kids' soccer games.</div>
                    <div className="cq-chars">425 chars</div>
                    <div className="cq-actions">
                      <span className="cq-action">✓ Approve</span>
                      <span className="cq-action">🔄 Regenerate</span>
                      <span className="cq-action">📊 Score</span>
                      <span className="cq-action">✏️ Edit</span>
                      <span className="cq-action">🔧 Fix Context</span>
                      <span className="cq-action cq-action-publish">🚀 Post Now</span>
                    </div>
                  </div>
                </div>

                {/* Tab 3: Story Vault */}
                <div className={`feature-visual-inner${activeTab === 3 ? ' active' : ''}`}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.15rem' }}>My Story</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>Your real data vault. The AI uses ONLY these facts — never makes anything up.</div>
                  <div className="story-card" style={{ marginBottom: '0.75rem' }}>
                    <div className="story-section-title"># My Numbers</div>
                    <div className="story-section-sub">Real metrics the AI can reference. Never made up.</div>
                    <div className="story-row">
                      <div className="story-input">Monthly Revenue</div>
                      <div className="story-input">$350K/m</div>
                      <div className="story-input">Natura IV Bar & Med Spa in which I am CMO</div>
                    </div>
                  </div>
                  <div className="story-card">
                    <div className="story-section-title">📖 My Stories</div>
                    <div className="story-section-sub">Real experiences the AI can reference in posts.</div>
                    <div className="story-entry">
                      <div className="story-entry-title">IT to Creator — The Escape (Origin)</div>
                      <div className="story-entry-body">Started career in IT making ~$60K/year. Felt boxed in, unfulfilled, creatively constrained. But had "platform fluency" from growing up on MySpace → Facebook → IG → Vine → YouTube...</div>
                    </div>
                    <div className="story-entry">
                      <div className="story-entry-title">COVID, Loss, and Urgency — The Stack That Changed Everything</div>
                      <div className="story-entry-body">COVID hit and got laid off. First child was born. Father passed away suddenly during quarantine...</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="landing-section" style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-solid)', borderBottom: '1px solid var(--border-solid)' }}>
          <div className="section-inner">
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <div className="section-label" style={{ justifyContent: 'center' }}>✦ How It Works</div>
              <div className="section-title">From zero to auto-publishing<br />in four steps</div>
            </div>
            <div className="steps-grid">
              {[
                { num: '01', icon: '🔗', title: 'Connect Threads', desc: 'Link your account and Threadable fetches your entire post history — every metric, every engagement signal.' },
                { num: '02', icon: '🧬', title: 'Run Analysis', desc: 'AI runs regression analysis, discovers your content archetypes, and builds a custom playbook from your real data.' },
                { num: '03', icon: '✍️', title: 'Generate Content', desc: 'Posts written in your voice, using your stories, scored against your playbook. Edit, approve, or regenerate.' },
                { num: '04', icon: '📡', title: 'Auto-Publish', desc: 'Schedule up to 30 posts per day. Threadable publishes at optimal times while you build what actually pays you.' },
              ].map(step => (
                <div className="step-card" key={step.num}>
                  <div className="step-number">{step.num}</div>
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-title">{step.title}</div>
                  <div className="step-desc">{step.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BEFORE / AFTER */}
        <section className="landing-section">
          <div className="section-inner">
            <div style={{ textAlign: 'center' }}>
              <div className="section-title">Your Threads growth,<br />before and after</div>
              <p className="section-sub" style={{ margin: '0 auto' }}>Stop guessing. Start compounding.</p>
            </div>
            <div className="before-after">
              <div className="ba-card ba-before">
                <div className="ba-label">Before Threadable</div>
                <ul className="ba-list">
                  <li><span className="ba-icon">✕</span> Staring at a blank screen every morning</li>
                  <li><span className="ba-icon">✕</span> Posting random content and hoping something hits</li>
                  <li><span className="ba-icon">✕</span> No idea what drives views vs. engagement</li>
                  <li><span className="ba-icon">✕</span> Spending 2+ hours/day on content</li>
                  <li><span className="ba-icon">✕</span> Your best posts are accidents you can't repeat</li>
                  <li><span className="ba-icon">✕</span> Followers growing at random or not at all</li>
                </ul>
              </div>
              <div className="ba-card ba-after">
                <div className="ba-label">After Threadable ✦</div>
                <ul className="ba-list">
                  <li><span className="ba-icon">✦</span> A full week of content generated in minutes</li>
                  <li><span className="ba-icon">✦</span> Every post follows a data-backed playbook</li>
                  <li><span className="ba-icon">✦</span> Regression analysis tells you exactly what works</li>
                  <li><span className="ba-icon">✦</span> Content runs on autopilot, up to 30 posts/day</li>
                  <li><span className="ba-icon">✦</span> Proven archetypes you can replicate on demand</li>
                  <li><span className="ba-icon">✦</span> Consistent, compounding audience growth</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FOUNDER */}
        <section id="story" className="landing-section founder-section-bg">
          <div className="section-inner">
            <div className="section-label">✦ Our Story</div>
            <div className="section-title" style={{ marginBottom: '2rem' }}>I built the tool I couldn't find.</div>
            <div className="founder-grid">
              <div className="founder-image">
                <img src="/placeholder-jourdan.jpg" alt="Jourdan Eloriaga" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
              </div>
              <div className="founder-content">
                <blockquote>"I scaled a med spa from $0 to $350K/month. I'd driven $8M+ in sales. I understood content strategy at a level most people charge $10K to teach. And I still couldn't keep up on Threads."</blockquote>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '1rem' }}>Writing 3-5 posts a day. Studying what worked. Analyzing what flopped. It was eating 3-4 hours daily — hours I needed for client work, for building offers, for being a present father.</p>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '1rem' }}>So I ran an experiment. 30 threads in 12 days. I tracked every variable — hook type, emotional triggers, post length, authority name-drops, time of day. I ran regression analysis on all of it.</p>
                <p style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.65, marginBottom: '1.5rem', fontWeight: 500 }}>The result: 394K+ organic interactions. Zero ad spend. And a clear, data-backed system for what actually works on Threads.</p>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '1.5rem' }}>I didn't set out to build a SaaS. I just got tired of doing it all manually. The tool I needed didn't exist — so I built it.</p>
                <div style={{ borderTop: '1px solid var(--border-solid)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <div className="founder-name">Jourdan Eloriaga</div>
                  <div className="founder-title">Founder, Threadable.ai · Ex-soul singer turned marketer · Father first.</div>
                  <div className="founder-stats">
                    <div><div className="founder-stat-value">$8M+</div><div className="founder-stat-label">med spa sales generated</div></div>
                    <div><div className="founder-stat-value">$350K/m</div><div className="founder-stat-label">med spa scaled as CMO</div></div>
                    <div><div className="founder-stat-value">200+</div><div className="founder-stat-label">franchise locations</div></div>
                    <div><div className="founder-stat-value">394K</div><div className="founder-stat-label">interactions in 12 days</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="landing-section">
          <div className="section-inner">
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <div className="section-title">Questions? Answers.</div>
            </div>
            <div className="faq-grid">
              {faqs.map((faq, i) => (
                <div className={`faq-item${openFaq === i ? ' open' : ''}`} key={i}>
                  <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    {faq.q}
                    <span className="faq-icon">+</span>
                  </button>
                  <div className="faq-a">{faq.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA / WAITLIST */}
        <section className="cta-section" id="waitlist">
          <div className="cta-inner">
            <h2>Your best content strategy<br /><em>is waiting.</em></h2>
            <p className="cta-sub">Join the waitlist. Be the first to know when Threadable goes live.</p>
            {status === "success" ? (
              <p style={{ fontSize: '1rem', color: 'var(--accent)', fontWeight: 600 }}>
                You're on the list! We'll notify you when Threadable goes live. 🎉
              </p>
            ) : status === "duplicate" ? (
              <p style={{ fontSize: '1rem', color: 'var(--accent)', fontWeight: 600 }}>
                You're already on the waitlist! We'll be in touch soon. ✨
              </p>
            ) : (
              <form className="waitlist-form" onSubmit={handleSubmit}>
                <input
                  type="email"
                  className="waitlist-input"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" className="btn-primary btn-large waitlist-btn" disabled={status === "loading"} style={{ opacity: status === "loading" ? 0.7 : 1 }}>
                  {status === "loading" ? "Joining..." : "Join the Waitlist →"}
                </button>
              </form>
            )}
            {status === "error" && (
              <p style={{ fontSize: '0.85rem', color: 'var(--red)', marginTop: '1rem' }}>Something went wrong. Please try again.</p>
            )}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="landing-footer">
          <div className="footer-inner">
            <a href="#" className="logo" style={{ fontSize: '0.85rem' }} onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <div className="logo-icon" style={{ width: 24, height: 24, fontSize: '0.7rem', borderRadius: 6 }}>T</div>
              <span className="logo-text" style={{ fontSize: '0.9rem' }}>Threadable.ai</span>
            </a>
            <div><a href="#">Privacy</a> · <a href="#">Terms</a></div>
            <div>© 2026 Threadable.ai. All rights reserved.</div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Landing;
