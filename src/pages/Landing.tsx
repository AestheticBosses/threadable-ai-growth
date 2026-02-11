import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageTitle } from "@/hooks/usePageTitle";
import threadableIcon from "@/assets/threadable-icon.png";
import {
  Zap,
  BarChart3,
  CalendarClock,
  Mic2,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Shield,
} from "lucide-react";

const FEATURES = [
  {
    icon: BarChart3,
    title: "Deep Post Analytics",
    description:
      "Regression analysis on every post. Know exactly which hooks, archetypes, and formats drive engagement.",
  },
  {
    icon: Zap,
    title: "AI Content Engine",
    description:
      "Posts generated from YOUR voice, YOUR stories, YOUR data — not generic templates. Every post scored before publishing.",
  },
  {
    icon: CalendarClock,
    title: "Smart Queue",
    description:
      "One-click scheduling with optimal timing. Auto-generated weekly content plans based on your strategy.",
  },
  {
    icon: Mic2,
    title: "Voice Cloning",
    description:
      "Feed it your best posts and it learns how you write. Generated content sounds like you, not a robot.",
  },
  {
    icon: TrendingUp,
    title: "Weekly Strategy",
    description:
      "AI-built playbooks with archetype mix, funnel distribution, and hook formulas tailored to your niche.",
  },
  {
    icon: Shield,
    title: "Story Vault",
    description:
      "Store your numbers, origin stories, and offers. The AI references real context so it never misattributes your wins.",
  },
];

const PROOF_POINTS = [
  "Posts scored 5.2/6 avg vs 2.1 without",
  "70% less time writing content",
  "Voice-matched content in < 48 hours",
];

export default function Landing() {
  usePageTitle("Grow on Threads with AI", "Threadable.ai — AI-powered Threads growth engine. Analyze, strategize, generate, and schedule content that sounds like you.");

  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <img src={threadableIcon} alt="Threadable" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold tracking-tight">Threadable.ai</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Log in
            </Button>
            <Button size="sm" onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}>
              Join Waitlist
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl px-5 pb-24 pt-20 text-center md:pt-32 md:pb-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Threads Growth
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
            Stop guessing.
            <br />
            <span className="bg-gradient-to-r from-primary to-[hsl(300_80%_65%)] bg-clip-text text-transparent">
              Start growing.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Threadable analyzes your best-performing content, clones your voice, and generates a
            week of scored, strategy-aligned posts — ready to publish in one click.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {PROOF_POINTS.map((point) => (
              <span
                key={point}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                {point}
              </span>
            ))}
          </div>

          <form
            onSubmit={handleWaitlist}
            className="mx-auto mt-10 flex max-w-md gap-2"
            id="waitlist"
          >
            {submitted ? (
              <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.1)] px-4 py-3 text-sm font-medium text-[hsl(var(--success))]">
                <CheckCircle2 className="h-4 w-4" />
                You're on the list. We'll be in touch.
              </div>
            ) : (
              <>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
                <Button type="submit" className="h-11 shrink-0 gap-1.5 px-5">
                  Join Waitlist <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </form>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/40 bg-card/50">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Everything you need to dominate Threads
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              From analysis to publishing — one platform, zero guesswork.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5 text-primary transition-colors group-hover:bg-primary/20">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-4xl px-5 py-20 md:py-28">
          <h2 className="mb-14 text-center text-3xl font-bold tracking-tight md:text-4xl">
            How it works
          </h2>
          <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-4 md:gap-6">
            {[
              { step: "01", title: "Connect Threads", desc: "Link your account. We analyze your last 100+ posts." },
              { step: "02", title: "Build Your Vault", desc: "Add your stats, stories, and offers so AI knows your context." },
              { step: "03", title: "Generate Strategy", desc: "AI builds a weekly playbook: archetypes, funnel mix, and hooks." },
              { step: "04", title: "Publish & Grow", desc: "Review scored posts, tweak if needed, and schedule with one click." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {s.step}
                </div>
                <h3 className="mb-1 text-sm font-semibold">{s.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/40 bg-card/50">
        <div className="mx-auto max-w-2xl px-5 py-20 text-center md:py-28">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Ready to stop writing mid posts?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Join the waitlist and be first to get AI-powered content that actually sounds like you.
          </p>
          <Button
            size="lg"
            className="mt-8 gap-2"
            onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
          >
            Join the Waitlist <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={threadableIcon} alt="" className="h-5 w-5 rounded" />
            <span>© {new Date().getFullYear()} Threadable.ai</span>
          </div>
          <button onClick={() => navigate("/login")} className="hover:text-foreground transition-colors">
            Log in →
          </button>
        </div>
      </footer>
    </div>
  );
}
