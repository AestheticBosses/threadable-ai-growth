import { useState, useEffect, useRef, CSSProperties } from "react";

const LOGO_SRC = "/threadable-logo.png";

const COLORS = {
  black: "#0a0a0f",
  darkGray: "#0d0d14",
  cardBg: "#13131a",
  borderDark: "#2a2a35",
  textPrimary: "#e8e4de",
  textSecondary: "#8a8680",
  accent: "#a855f7",
  accentDim: "rgba(168, 85, 247, 0.08)",
  accentGlow: "rgba(168, 85, 247, 0.15)",
  white: "#e8e4de",
};

interface Feature {
  icon: string;
  title: string;
  desc: string;
}

interface FAQ {
  q: string;
  a: string;
}

interface Stat {
  num: string;
  label: string;
}

interface AffiliateItem {
  num: string;
  label: string;
  sub: string;
}

interface PricingTier {
  name: string;
  monthly: number;
  annual: number;
  annualTotal: number;
  desc: string;
  popular: boolean;
  features: string[];
  cta: string;
}

const features: Feature[] = [
  {
    icon: "◎",
    title: "Know Before You Post",
    desc: "Every post gets a virality score before you hit publish — based on hook type, emotional triggers, and format patterns validated across real Threads data.",
  },
  {
    icon: "⚡",
    title: "Post at the Exact Right Moment",
    desc: "Threadable finds your audience's active windows and your competitors' dead zones — so your content lands when attention is highest.",
  },
  {
    icon: "↻",
    title: "Batch Once, Publish All Week",
    desc: "Write everything in one sprint. Threadable queues and auto-publishes via the Threads API — your presence runs while you're off the clock.",
  },
  {
    icon: "△",
    title: "Sound Like You, Not Like AI",
    desc: "Feed it your best-performing content. Threadable learns your tone, your cadence, your edge — and amplifies what already works.",
  },
  {
    icon: "◈",
    title: "Track What Actually Makes Money",
    desc: "Forget vanity metrics. See which posts drive followers, which drive DMs, and which ones are actually generating inbound leads.",
  },
  {
    icon: "✦",
    title: "Frameworks That Are Already Proven",
    desc: "Built on the 5-pillar system behind $8M+ in content-driven sales: Proof, Systems, Philosophy, Behind-the-Scenes, and Direct Response.",
  },
];

const faqs: FAQ[] = [
  {
    q: "When does Threadable launch?",
    a: "We're in private beta now. Waitlist members get first access — and early members lock in founding pricing that won't be available after launch.",
  },
  {
    q: "Is this just another scheduling tool?",
    a: "Scheduling tools post on time. Threadable tells you what to post, when to post it, and scores how it'll perform — before you publish. It's the difference between a calendar and a strategist.",
  },
  {
    q: "Do I need to be on Threads already?",
    a: "No. Threadable works whether you have 50 followers or 50,000. The AI scoring and strategy engine works the same — it just means your first posts will already be optimized.",
  },
  {
    q: "What happens after I join the waitlist?",
    a: "You'll get an email when we open access. Waitlist members get priority onboarding, founding member pricing, and early input on features.",
  },
  {
    q: "Who is this built for?",
    a: "Consultants, agency owners, creators, and digital product builders who know organic content is the play but don't have 3-4 hours a day to execute it.",
  },
];

interface NavBarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

function NavBar({ activeSection, setActiveSection }: NavBarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = ["Features", "Pricing", "Affiliate", "About"];

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "0 24px",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: scrolled ? "rgba(10,10,10,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? `1px solid ${COLORS.borderDark}` : "1px solid transparent",
        transition: "all 0.3s ease",
      } as CSSProperties}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <img
          src={LOGO_SRC}
          alt="Threadable"
          style={{ height: 36, objectFit: "contain" }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        {links.map((link) => (
          <button
            key={link}
            onClick={() => {
              setActiveSection(link.toLowerCase());
              document.getElementById(link.toLowerCase())?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{
              background: "none",
              border: "none",
              color: activeSection === link.toLowerCase() ? COLORS.accent : COLORS.textSecondary,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              letterSpacing: 0.5,
              transition: "color 0.2s",
              padding: 0,
            } as CSSProperties}
          >
            {link}
          </button>
        ))}
        <button
          style={{
            background: COLORS.accent,
            color: COLORS.black,
            border: "none",
            padding: "8px 20px",
            borderRadius: 6,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: 0.3,
          } as CSSProperties}
        >
          Join the Waitlist
        </button>
      </div>
    </nav>
  );
}

function Hero() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "120px 24px 80px",
        position: "relative",
        overflow: "hidden",
      } as CSSProperties}
    >
      {/* Background grid effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${COLORS.borderDark} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.borderDark} 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          opacity: 0.3,
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
        } as CSSProperties}
      />

      {/* Accent glow */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 600,
          background: `radial-gradient(circle, ${COLORS.accentGlow} 0%, transparent 70%)`,
          filter: "blur(80px)",
          pointerEvents: "none",
        } as CSSProperties}
      />

      <div
        style={{
          position: "relative",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        } as CSSProperties}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: COLORS.accentDim,
            border: `1px solid rgba(168,85,247,0.2)`,
            borderRadius: 100,
            padding: "6px 16px",
            marginBottom: 32,
          } as CSSProperties}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: COLORS.accent,
              animation: "pulse 2s infinite",
            } as CSSProperties}
          />
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 12,
              color: COLORS.accent,
              letterSpacing: 1,
            } as CSSProperties}
          >
            I GENERATED 394K+ ORGANIC INTERACTIONS ON THREADS IN 12 DAYS — $0 AD SPEND
          </span>
        </div>

        <h1
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: "clamp(42px, 6vw, 80px)",
            fontWeight: 400,
            color: COLORS.textPrimary,
            lineHeight: 1.05,
            maxWidth: 800,
            margin: "0 auto 24px",
            letterSpacing: -2,
          } as CSSProperties}
        >
          Stop posting into the void.
          <br />
          <span style={{ color: COLORS.accent, fontStyle: "italic" }}>Start posting into a system.</span>
        </h1>

        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 18,
            color: COLORS.textSecondary,
            maxWidth: 560,
            margin: "0 auto 40px",
            lineHeight: 1.7,
          } as CSSProperties}
        >
          Threadable scores your content for virality, finds your optimal posting windows, and auto-publishes — so your audience grows in the background while you build what actually pays you.
        </p>

        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            style={{
              background: COLORS.accent,
              color: COLORS.black,
              border: "none",
              padding: "14px 36px",
              borderRadius: 8,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: 0.3,
              transition: "transform 0.2s, box-shadow 0.2s",
            } as CSSProperties}
            onMouseEnter={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.transform = "translateY(-2px)";
              target.style.boxShadow = `0 8px 30px ${COLORS.accentGlow}`;
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.transform = "translateY(0)";
              target.style.boxShadow = "none";
            }}
          >
            Join the Waitlist →
          </button>
          <button
            style={{
              background: "transparent",
              color: COLORS.textPrimary,
              border: `1px solid ${COLORS.borderDark}`,
              padding: "14px 36px",
              borderRadius: 8,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
              transition: "border-color 0.2s",
            } as CSSProperties}
            onMouseEnter={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.borderColor = COLORS.accent;
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.borderColor = COLORS.borderDark;
            }}
          >
            Watch the 90-Sec Demo
          </button>
        </div>

        {/* Social proof bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
            marginTop: 64,
            paddingTop: 32,
            borderTop: `1px solid ${COLORS.borderDark}`,
          } as CSSProperties}
        >
          {[
            { num: "394K+", label: "Organic engagement" },
            { num: "12", label: "Days to prove it" },
            { num: "$0", label: "Ad spend" },
          ].map((stat: Stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 28,
                  fontWeight: 700,
                  color: COLORS.accent,
                } as CSSProperties}
              >
                {stat.num}
              </div>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  color: COLORS.textSecondary,
                  letterSpacing: 0.5,
                  marginTop: 4,
                } as CSSProperties}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section style={{ padding: "100px 24px", maxWidth: 800, margin: "0 auto" }}>
      <p
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
          color: COLORS.accent,
          letterSpacing: 3,
          marginBottom: 24,
        } as CSSProperties}
      >
        THE PROBLEM
      </p>
      <h2
        style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: "clamp(28px, 4vw, 44px)",
          fontWeight: 400,
          color: COLORS.textPrimary,
          lineHeight: 1.2,
          marginBottom: 32,
          letterSpacing: -1,
        } as CSSProperties}
      >
        I scaled a med spa from $0 to $350K/month.
        <br />
        <span style={{ color: COLORS.textSecondary }}>Then I tried to grow on Threads.</span>
      </h2>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 16,
          color: COLORS.textSecondary,
          lineHeight: 1.8,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        } as CSSProperties}
      >
        <p>
          I'd built an agency doing $50K/mo. I'd driven <strong style={{ color: COLORS.textPrimary }}>$8M+ in sales</strong> for med spas and aesthetic clinics. I understood content strategy at a level most people charge $10K to teach.
        </p>
        <p>
          And I still couldn't keep up.
        </p>
        <p>
          Studying what was working. Writing 3-5 posts a day. Figuring out when to publish. Analyzing what flopped. It was eating 3-4 hours daily — hours I needed for client work, for building offers, for being a present father.
        </p>
        <p>
          So I ran an experiment. <strong style={{ color: COLORS.textPrimary }}>30 threads in 12 days.</strong> I tracked every variable — hook type, emotional triggers, post length, authority name-drops, time of day. I ran regression analysis on all of it.
        </p>
        <p>
          The result: <strong style={{ color: COLORS.accent }}>394K+ organic interactions. Zero ad spend.</strong> And a clear, data-backed system for what actually works on Threads.
        </p>
        <p>
          The problem was never strategy. It was execution at scale.
        </p>

        {/* Divider */}
        <div style={{ width: 40, height: 1, background: COLORS.borderDark, margin: "8px 0" }} />

        <p>
          <strong style={{ color: COLORS.textPrimary }}>You're living this right now.</strong> You know Threads is the biggest organic opportunity in 2026. You've seen people blow up on it. But you're juggling clients, fulfilling deliverables, and trying to build something that doesn't chain you to a laptop 12 hours a day.
        </p>
        <p>
          You've tried scheduling tools — they post on time but can't tell you{" "}
          <em style={{ color: COLORS.textPrimary }}>what</em> to post. You've tried AI writers — they sound like every other AI writer. Meanwhile, your competitors are showing up daily and your prospects are choosing them because their digital presence looks stronger.
        </p>
        <p style={{ color: COLORS.accent, fontWeight: 600 }}>
          That gap between "knowing what to do" and "having time to do it" is costing you clients right now.
        </p>
        <p style={{ color: COLORS.textPrimary, fontWeight: 500, fontSize: 18 }}>
          That's why I built Threadable.
        </p>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <p
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
            color: COLORS.accent,
            letterSpacing: 3,
            marginBottom: 16,
          } as CSSProperties}
        >
          THE ENGINE
        </p>
        <h2
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 400,
            color: COLORS.textPrimary,
            letterSpacing: -1,
          } as CSSProperties}
        >
          What 30 threads, 394K interactions,
          <br />
          <span style={{ fontStyle: "italic", color: COLORS.accent }}>and a regression model taught us.</span>
        </h2>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 1,
          background: COLORS.borderDark,
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${COLORS.borderDark}`,
        } as CSSProperties}
      >
        {features.map((f, i) => (
          <div
            key={i}
            style={{
              background: COLORS.cardBg,
              padding: 40,
              transition: "background 0.3s",
              cursor: "default",
            } as CSSProperties}
            onMouseEnter={(e) => {
              const target = e.currentTarget as HTMLDivElement;
              target.style.background = "#1a1a24";
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget as HTMLDivElement;
              target.style.background = COLORS.cardBg;
            }}
          >
            <span
              style={{
                fontSize: 28,
                display: "block",
                marginBottom: 20,
                filter: "grayscale(0)",
              } as CSSProperties}
            >
              {f.icon}
            </span>
            <h3
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 17,
                fontWeight: 600,
                color: COLORS.textPrimary,
                marginBottom: 12,
              } as CSSProperties}
            >
              {f.title}
            </h3>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                color: COLORS.textSecondary,
                lineHeight: 1.7,
              } as CSSProperties}
            >
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const [annual, setAnnual] = useState(false);

  const tiers: PricingTier[] = [
    {
      name: "Starter",
      monthly: 29,
      annual: 24.17,
      annualTotal: 290,
      desc: "Get your feet wet with AI-powered Threads content.",
      popular: false,
      features: [
        "50 AI-generated posts / mo",
        "Basic content calendar & scheduling",
        "1 Threads account",
        "Manual publishing (copy + paste)",
        "Basic analytics dashboard",
      ],
      cta: "Join the Waitlist",
    },
    {
      name: "Growth",
      monthly: 59,
      annual: 49.17,
      annualTotal: 590,
      desc: "The full engine. Auto-publish, regression strategy, and real analytics.",
      popular: true,
      features: [
        "200 AI-generated posts / mo",
        "Regression-based content strategy",
        "1 Threads account",
        "Auto-publishing via Threads API",
        "Optimal posting time recommendations",
        "Engagement analytics + trend tracking",
        "Content pillar tagging & performance",
        "Hashtag optimization",
      ],
      cta: "Join the Waitlist",
    },
    {
      name: "Scale",
      monthly: 97,
      annual: 80.83,
      annualTotal: 970,
      desc: "For power users who want prediction, testing, and multi-account reach.",
      popular: false,
      features: [
        "Unlimited AI-generated posts",
        "Everything in Growth",
        "Up to 3 Threads accounts",
        "Predict performance before posting",
        "Content A/B testing suggestions",
        "Viral pattern detection",
        "Weekly AI strategy report",
        "Priority support + early access",
      ],
      cta: "Join the Waitlist",
    },
  ];

  return (
    <section id="pricing" style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <p
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
            color: COLORS.accent,
            letterSpacing: 3,
            marginBottom: 16,
          } as CSSProperties}
        >
          PRICING
        </p>
        <h2
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 400,
            color: COLORS.textPrimary,
            letterSpacing: -1,
            marginBottom: 16,
          } as CSSProperties}
        >
          Pick the plan that matches
          <br />
          <span style={{ fontStyle: "italic", color: COLORS.accent }}>where you're going.</span>
        </h2>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 16,
            color: COLORS.textSecondary,
            maxWidth: 500,
            margin: "0 auto 32px",
            lineHeight: 1.7,
          } as CSSProperties}
        >
          Join the waitlist today. Be first in line when we launch.
        </p>

        {/* Annual toggle */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            background: COLORS.cardBg,
            border: `1px solid ${COLORS.borderDark}`,
            borderRadius: 100,
            padding: "6px 8px",
          } as CSSProperties}
        >
          <button
            onClick={() => setAnnual(false)}
            style={{
              background: !annual ? COLORS.accent : "transparent",
              color: !annual ? COLORS.black : COLORS.textSecondary,
              border: "none",
              padding: "8px 20px",
              borderRadius: 100,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            } as CSSProperties}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            style={{
              background: annual ? COLORS.accent : "transparent",
              color: annual ? COLORS.black : COLORS.textSecondary,
              border: "none",
              padding: "8px 20px",
              borderRadius: 100,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            } as CSSProperties}
          >
            Annual
          </button>
          {!annual && (
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10,
                color: COLORS.accent,
                letterSpacing: 0.5,
                paddingRight: 8,
              } as CSSProperties}
            >
              Save 2 months
            </span>
          )}
        </div>
      </div>

      {/* Tier cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(255px, 1fr))",
          gap: 16,
          alignItems: "stretch",
        } as CSSProperties}
      >
        {tiers.map((tier, i) => {
          const price = annual ? tier.annual : tier.monthly;
          const isPopular = tier.popular;

          return (
            <div
              key={i}
              style={{
                background: isPopular
                  ? `linear-gradient(180deg, #1a1028 0%, ${COLORS.cardBg} 100%)`
                  : COLORS.cardBg,
                border: isPopular
                  ? `1px solid rgba(168,85,247,0.3)`
                  : `1px solid ${COLORS.borderDark}`,
                borderRadius: 16,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                overflow: "hidden",
                transition: "border-color 0.3s, transform 0.2s",
              } as CSSProperties}
              onMouseEnter={(e) => {
                const target = e.currentTarget as HTMLDivElement;
                if (!isPopular) target.style.borderColor = "rgba(168,85,247,0.15)";
                target.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget as HTMLDivElement;
                if (!isPopular) target.style.borderColor = COLORS.borderDark;
                target.style.transform = "translateY(0)";
              }}
            >
              {isPopular && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      top: -30,
                      right: -30,
                      width: 120,
                      height: 120,
                      background: `radial-gradient(circle, ${COLORS.accentGlow}, transparent 70%)`,
                      filter: "blur(40px)",
                      pointerEvents: "none",
                    } as CSSProperties}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      background: COLORS.accent,
                      color: COLORS.black,
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      padding: "4px 10px",
                      borderRadius: 4,
                    } as CSSProperties}
                  >
                    MOST POPULAR
                  </div>
                </>
              )}

              {/* Tier name */}
              <p
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 11,
                  color: isPopular ? COLORS.accent : COLORS.textSecondary,
                  letterSpacing: 2,
                  marginBottom: 12,
                  textTransform: "uppercase",
                } as CSSProperties}
              >
                {tier.name}
              </p>

              {/* Price */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 40,
                    fontWeight: 700,
                    color: COLORS.textPrimary,
                    lineHeight: 1,
                  } as CSSProperties}
                >
                  ${annual ? Math.floor(price) : price}
                </span>
                {annual && (
                  <span
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 16,
                      color: COLORS.textSecondary,
                    } as CSSProperties}
                  >
                    .{String(price).split(".")[1] || "00"}
                  </span>
                )}
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    color: COLORS.textSecondary,
                    marginLeft: 2,
                  } as CSSProperties}
                >
                  /mo
                </span>
              </div>

              {annual && (
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    color: COLORS.textSecondary,
                    marginBottom: 16,
                    opacity: 0.7,
                  } as CSSProperties}
                >
                  ${tier.annualTotal}/yr — billed annually
                </p>
              )}
              {!annual && <div style={{ marginBottom: 16 }} />}

              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  color: COLORS.textSecondary,
                  lineHeight: 1.6,
                  marginBottom: 24,
                  minHeight: 42,
                } as CSSProperties}
              >
                {tier.desc}
              </p>

              {/* Features list */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  flex: 1,
                  marginBottom: 28,
                } as CSSProperties}
              >
                {tier.features.map((feat, fi) => (
                  <div
                    key={fi}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      color: COLORS.textPrimary,
                      lineHeight: 1.4,
                    } as CSSProperties}
                  >
                    <span
                      style={{
                        color: isPopular ? COLORS.accent : COLORS.textSecondary,
                        fontSize: 14,
                        flexShrink: 0,
                        marginTop: 1,
                      } as CSSProperties}
                    >
                      ✓
                    </span>
                    {feat}
                  </div>
                ))}
              </div>

              {/* CTA button */}
              <button
                style={{
                  background: isPopular ? COLORS.accent : "transparent",
                  color: isPopular ? COLORS.black : COLORS.textPrimary,
                  border: isPopular ? "none" : `1px solid ${COLORS.borderDark}`,
                  padding: "12px 24px",
                  borderRadius: 8,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  width: "100%",
                } as CSSProperties}
                onMouseEnter={(e) => {
                  const target = e.target as HTMLButtonElement;
                  if (isPopular) {
                    target.style.boxShadow = `0 8px 24px ${COLORS.accentGlow}`;
                  } else {
                    target.style.borderColor = COLORS.accent;
                    target.style.color = COLORS.accent;
                  }
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLButtonElement;
                  if (isPopular) {
                    target.style.boxShadow = "none";
                  } else {
                    target.style.borderColor = COLORS.borderDark;
                    target.style.color = COLORS.textPrimary;
                  }
                }}
              >
                {tier.cta}
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom callouts */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 32,
          marginTop: 48,
          flexWrap: "wrap",
        } as CSSProperties}
      >
        <div
          style={{
            background: COLORS.accentDim,
            border: `1px solid rgba(168,85,247,0.15)`,
            borderRadius: 10,
            padding: "16px 24px",
            textAlign: "center",
            maxWidth: 320,
          } as CSSProperties}
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: COLORS.textSecondary,
              lineHeight: 1.6,
            } as CSSProperties}
          >
            <strong style={{ color: COLORS.accent }}>40% affiliate commission</strong> on every
            plan — recurring, uncapped.{" "}
            <span style={{ opacity: 0.7 }}>Refer 10 Growth users = $236/mo passive.</span>
          </p>
        </div>
        <div
          style={{
            background: COLORS.cardBg,
            border: `1px solid ${COLORS.borderDark}`,
            borderRadius: 10,
            padding: "16px 24px",
            textAlign: "center",
            maxWidth: 320,
          } as CSSProperties}
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: COLORS.textSecondary,
              lineHeight: 1.6,
            } as CSSProperties}
          >
            One Threads client from better content — even a{" "}
            <strong style={{ color: COLORS.textPrimary }}>$500 project</strong> — and the Growth
            plan pays for itself{" "}
            <strong style={{ color: COLORS.accent }}>8x over</strong>.
          </p>
        </div>
      </div>
    </section>
  );
}

function Affiliate() {
  return (
    <section id="affiliate" style={{ padding: "100px 24px", maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, #1a1028 100%)`,
          border: `1px solid ${COLORS.borderDark}`,
          borderRadius: 20,
          padding: "64px 56px",
          position: "relative",
          overflow: "hidden",
        } as CSSProperties}
      >
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -80,
            width: 300,
            height: 300,
            background: `radial-gradient(circle, rgba(168,85,247,0.06), transparent 70%)`,
            filter: "blur(60px)",
            pointerEvents: "none",
          } as CSSProperties}
        />

        <div style={{ position: "relative" }}>
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 11,
              color: COLORS.accent,
              letterSpacing: 3,
              marginBottom: 16,
            } as CSSProperties}
          >
            EARN WHILE YOU POST
          </p>
          <h2
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 400,
              color: COLORS.textPrimary,
              lineHeight: 1.2,
              marginBottom: 24,
              letterSpacing: -1,
            } as CSSProperties}
          >
            You're already recommending tools to people.
            <br />
            <span style={{ color: COLORS.accent, fontStyle: "italic" }}>This one pays you back.</span>
          </h2>

          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 16,
              color: COLORS.textSecondary,
              lineHeight: 1.8,
              maxWidth: 600,
              marginBottom: 24,
            } as CSSProperties}
          >
            If you talk about content strategy, Threads growth, or building an audience — you're already doing the work. Threadable's affiliate program pays you <strong style={{ color: COLORS.textPrimary }}>40% recurring commission</strong> on every person you refer, on every plan, for as long as they're a member. Not a one-time bounty. Recurring passive income for a recommendation you'd make anyway.
          </p>

          {/* Quick math - moved up as the closer */}
          <div
            style={{
              background: COLORS.accentDim,
              border: `1px solid rgba(168,85,247,0.15)`,
              borderRadius: 12,
              padding: 24,
              marginBottom: 32,
            } as CSSProperties}
          >
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                color: COLORS.accent,
                letterSpacing: 2,
                marginBottom: 8,
              } as CSSProperties}
            >
              THE MATH
            </p>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                color: COLORS.textSecondary,
                lineHeight: 1.7,
              } as CSSProperties}
            >
              Refer <strong style={{ color: COLORS.textPrimary }}>10 people</strong> →{" "}
              <strong style={{ color: COLORS.accent }}>$236/mo</strong>. Refer{" "}
              <strong style={{ color: COLORS.textPrimary }}>25</strong> →{" "}
              <strong style={{ color: COLORS.accent }}>$590/mo</strong>. Refer{" "}
              <strong style={{ color: COLORS.textPrimary }}>50</strong> →{" "}
              <strong style={{ color: COLORS.accent }}>$1,180/mo</strong>. That's a car payment, a mortgage assist, or a vacation fund — from sharing a link.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 24,
              marginBottom: 40,
            } as CSSProperties}
          >
            {[
              { num: "$11–$39", label: "Per active referral", sub: "Recurring, not one-time" },
              { num: "No ceiling", label: "Refer as many as you want", sub: "We don't cap commissions. Ever." },
              { num: "Monthly", label: "Direct to your account", sub: "No 90-day hold. No minimums." },
              { num: "40%", label: "Of every plan", sub: "The more they grow, the more you earn" },
            ].map((s: AffiliateItem, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${COLORS.borderDark}`,
                  borderRadius: 12,
                  padding: 24,
                } as CSSProperties}
              >
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 22,
                    fontWeight: 700,
                    color: COLORS.accent,
                    marginBottom: 4,
                  } as CSSProperties}
                >
                  {s.num}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    color: COLORS.textPrimary,
                    marginBottom: 4,
                  } as CSSProperties}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    color: COLORS.textSecondary,
                  } as CSSProperties}
                >
                  {s.sub}
                </div>
              </div>
            ))}
          </div>

          <button
            style={{
              background: COLORS.accent,
              color: COLORS.black,
              border: "none",
              padding: "14px 36px",
              borderRadius: 8,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
            } as CSSProperties}
            onMouseEnter={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.transform = "translateY(-2px)";
              target.style.boxShadow = `0 8px 30px ${COLORS.accentGlow}`;
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.transform = "translateY(0)";
              target.style.boxShadow = "none";
            }}
          >
            Get Your Affiliate Link →
          </button>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" style={{ padding: "100px 24px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <p
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
            color: COLORS.accent,
            letterSpacing: 3,
            marginBottom: 16,
          } as CSSProperties}
        >
          THE BACKSTORY
        </p>
        <h2
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 400,
            color: COLORS.textPrimary,
            letterSpacing: -1,
            marginBottom: 24,
            lineHeight: 1.2,
          } as CSSProperties}
        >
          I didn't set out to build a SaaS.{" "}
          <span style={{ fontStyle: "italic", color: COLORS.accent }}>I just got tired of doing it all manually.</span>
        </h2>
      </div>

      {/* Story */}
      <div
        style={{
          background: COLORS.cardBg,
          border: `1px solid ${COLORS.borderDark}`,
          borderRadius: 16,
          padding: 48,
          marginBottom: 48,
        } as CSSProperties}
      >
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            color: COLORS.textSecondary,
            lineHeight: 1.8,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          } as CSSProperties}
        >
          <p>
            I'm Jourdan. I've spent the last several years in the aesthetics industry — scaling Natura Med Spa from <strong style={{ color: COLORS.textPrimary }}>$0 to $350K/month</strong>, leading marketing as VP for a national wellness franchise, and running an agency that's generated <strong style={{ color: COLORS.textPrimary }}>$8M+ in sales</strong>. Before all of that, I was a soul singer. Life takes turns.
          </p>
          <p>
            The one constant across every win: <strong style={{ color: COLORS.textPrimary }}>organic content built authority faster than any ad budget ever could.</strong>
          </p>
          <p>
            When Threads took off, I saw the opportunity immediately. But executing on it — writing daily, tracking what worked, publishing at the right times — was eating hours I didn't have. I was a father trying to be present. A business owner trying to scale. Something had to give, and it wasn't going to be my family or my clients.
          </p>
          <p>
            So I ran an experiment, tracked every variable across 30 posts, and built the system that became Threadable. Not because I wanted to start a software company — but because the tool I needed didn't exist.
          </p>
        </div>

        {/* Philosophy line */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: `1px solid ${COLORS.borderDark}`,
          } as CSSProperties}
        >
          <p
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 20,
              color: COLORS.accent,
              fontStyle: "italic",
              lineHeight: 1.5,
              textAlign: "center",
            } as CSSProperties}
          >
            Your growth platform should work as hard as you do — so you can get paid to be you.
          </p>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section style={{ padding: "100px 24px", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <p
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
            color: COLORS.accent,
            letterSpacing: 3,
            marginBottom: 16,
          } as CSSProperties}
        >
          FAQ
        </p>
        <h2
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: "clamp(28px, 4vw, 36px)",
            fontWeight: 400,
            color: COLORS.textPrimary,
            letterSpacing: -1,
          } as CSSProperties}
        >
          Questions you're probably asking.
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {faqs.map((faq, i) => (
          <div
            key={i}
            style={{
              borderBottom: `1px solid ${COLORS.borderDark}`,
              cursor: "pointer",
            } as CSSProperties}
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            <div
              style={{
                padding: "20px 0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              } as CSSProperties}
            >
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15,
                  fontWeight: 500,
                  color: openIndex === i ? COLORS.accent : COLORS.textPrimary,
                  transition: "color 0.2s",
                } as CSSProperties}
              >
                {faq.q}
              </span>
              <span
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 18,
                  color: COLORS.textSecondary,
                  transform: openIndex === i ? "rotate(45deg)" : "rotate(0deg)",
                  transition: "transform 0.3s",
                } as CSSProperties}
              >
                +
              </span>
            </div>
            <div
              style={{
                maxHeight: openIndex === i ? 200 : 0,
                overflow: "hidden",
                transition: "max-height 0.3s ease",
              } as CSSProperties}
            >
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  color: COLORS.textSecondary,
                  lineHeight: 1.7,
                  paddingBottom: 20,
                } as CSSProperties}
              >
                {faq.a}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section
      style={{
        padding: "120px 24px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      } as CSSProperties}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 500,
          height: 500,
          background: `radial-gradient(circle, ${COLORS.accentGlow}, transparent 60%)`,
          filter: "blur(100px)",
          pointerEvents: "none",
        } as CSSProperties}
      />
      <div style={{ position: "relative" }}>
        <h2
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 400,
            color: COLORS.textPrimary,
            lineHeight: 1.15,
            maxWidth: 600,
            margin: "0 auto 24px",
            letterSpacing: -2,
          } as CSSProperties}
        >
          Your best content strategy
          <br />
          <span style={{ color: COLORS.accent, fontStyle: "italic" }}>is waiting.</span>
        </h2>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 16,
            color: COLORS.textSecondary,
            maxWidth: 440,
            margin: "0 auto 40px",
            lineHeight: 1.7,
          } as CSSProperties}
        >
          Join the waitlist. Be the first to know when Threadable goes live.
        </p>
        <button
          style={{
            background: COLORS.accent,
            color: COLORS.black,
            border: "none",
            padding: "16px 44px",
            borderRadius: 10,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            transition: "transform 0.2s, box-shadow 0.2s",
          } as CSSProperties}
          onMouseEnter={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.transform = "translateY(-2px)";
            target.style.boxShadow = `0 12px 40px ${COLORS.accentGlow}`;
          }}
          onMouseLeave={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.transform = "translateY(0)";
            target.style.boxShadow = "none";
          }}
        >
          Join the Waitlist →
        </button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      style={{
        padding: "48px 24px",
        borderTop: `1px solid ${COLORS.borderDark}`,
        maxWidth: 1100,
        margin: "0 auto",
      } as CSSProperties}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 24,
        } as CSSProperties}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <img
            src={LOGO_SRC}
            alt="Threadable"
            style={{ height: 28, objectFit: "contain" }}
          />
        </div>

        <div style={{ display: "flex", gap: 32 }}>
          {["Features", "Pricing", "Affiliate", "About", "Privacy", "Terms"].map((link) => (
            <span
              key={link}
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                color: COLORS.textSecondary,
                cursor: "pointer",
                transition: "color 0.2s",
              } as CSSProperties}
              onMouseEnter={(e) => {
                const target = e.target as HTMLSpanElement;
                target.style.color = COLORS.textPrimary;
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLSpanElement;
                target.style.color = COLORS.textSecondary;
              }}
            >
              {link}
            </span>
          ))}
        </div>

        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: COLORS.textSecondary,
            opacity: 0.5,
          } as CSSProperties}
        >
          © 2026 Threadable. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default function ThreadableWebsite() {
  const [activeSection, setActiveSection] = useState("");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Mono:wght@400;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: ${COLORS.black}; color: ${COLORS.textPrimary}; -webkit-font-smoothing: antialiased; }
        ::selection { background: ${COLORS.accent}; color: ${COLORS.black}; }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        
        html { scroll-behavior: smooth; }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.black}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.borderDark}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.textSecondary}; }
      `}</style>

      <div style={{ minHeight: "100vh", background: COLORS.black }}>
        <NavBar activeSection={activeSection} setActiveSection={setActiveSection} />
        <Hero />
        <ProblemSection />
        <Features />
        <Pricing />
        <Affiliate />
        <About />
        <FAQ />
        <CTA />
        <Footer />
      </div>
    </>
  );
}
