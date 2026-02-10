import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

const ROTATION = [
  { day: "MON", emoji: "🎓", type: "Vault Drop", color: "border-violet-500/40 text-violet-400", desc: "Name-drop + steps. Max follow conversion." },
  { day: "TUE", emoji: "🔥", type: "Truth Bomb", color: "border-emerald-500/40 text-emerald-400", desc: "Specific + visual one-liner. Repost bait." },
  { day: "WED", emoji: "💣", type: "Niche Take", color: "border-yellow-500/40 text-yellow-400", desc: "Industry-specific. NOT generic advice." },
  { day: "THU", emoji: "🎓", type: "Vault Drop", color: "border-violet-500/40 text-violet-400", desc: "2nd framework. Dollar anchor." },
  { day: "FRI", emoji: "🪟", type: "Window", color: "border-blue-500/40 text-blue-400", desc: "Real-time personal. DM trigger." },
  { day: "SAT", emoji: "🔥", type: "Truth Bomb", color: "border-emerald-500/40 text-emerald-400", desc: "Weekend scrollers. Vulnerability + relatability." },
  { day: "SUN", emoji: "🔥", type: "Truth Bomb", color: "border-emerald-500/40 text-emerald-400", desc: "3rd truth bomb. Data says these > hot takes for growth." },
];

const CHECKLIST = [
  { pts: "+2", q: "Does it have 2+ emotional triggers?", stat: "Single emotion avg 926 views. 2+ avg 4,929" },
  { pts: "+2", q: "Can the reader SEE a vivid scene in 1 second?", stat: "Visual threads: 3,116 avg views. Non-visual: 3,609" },
  { pts: "+1", q: "Does it name-drop an authority OR use a $ amount?", stat: "Name-drop threads avg 17,400 views" },
  { pts: "+1", q: "Is it SPECIFIC to your niche (not generic advice)?", stat: 'Thread #11 (niche take): 3.37% follow rate. Generic takes: 0.07%' },
  { pts: "+1", q: "Would someone screenshot or repost this?", stat: "Repost-worthy threads avg 9,296 views" },
  { pts: "+1", q: "Is the first line a hook, not a setup?", stat: "All 30 threads lead with statements. Zero top performers lead with questions." },
];

const TEMPLATES = [
  {
    emoji: "🎓",
    name: "Vault Drop",
    score: "5-6",
    color: "border-violet-500/40",
    badgeClass: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    template: `I [tracked/tested/built] [specific thing] and here's exactly what happened:

1. [Insight with number]
2. [Insight with number]
3. [Insight with number]

The takeaway: [bold statement with authority name-drop].

[CTA: Save this / Follow for more frameworks]`,
  },
  {
    emoji: "🔥",
    name: "Truth Bomb",
    score: "4-5",
    color: "border-emerald-500/40",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    template: `[Vivid scene in <15 words that triggers 2+ emotions].

That's it. That's the post.

[Optional: one-line expansion with specific data point]`,
  },
  {
    emoji: "💣",
    name: "Niche Hot Take",
    score: "4-5",
    color: "border-yellow-500/40",
    badgeClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    template: `[Industry-specific contrarian opinion — NOT generic advice].

Here's why everyone gets this wrong:

[2-3 lines of evidence from YOUR niche]

The real play: [specific alternative approach].`,
  },
  {
    emoji: "🪟",
    name: "Window",
    score: "4-5",
    color: "border-blue-500/40",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    template: `Just [real-time action in present tense].

Here's what happened:

[Vulnerable/honest moment with specific detail]

[Lesson or reflection — keep it raw, not polished]`,
  },
];

const Playbook = () => {
  usePageTitle("Playbook", "Your validated content strategy playbook");

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Revenue Playbook v3 — Validated
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Updated with 30-post patterns. Power law accepted: optimize for breakouts, not consistency.
          </p>
        </div>

        {/* SECTION 1: 7-Day Rotation */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            7-Day Rotation — Optimized for Follow Rate + Virality
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {ROTATION.map((r) => (
              <Card key={r.day} className={`border-2 ${r.color.split(" ")[0]}`}>
                <CardContent className="p-4 space-y-2">
                  <p className={`text-xs font-bold font-mono ${r.color.split(" ")[1]}`}>{r.day}</p>
                  <p className="text-lg">{r.emoji}</p>
                  <p className="text-sm font-semibold text-foreground">{r.type}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* SECTION 2: Pre-Post Checklist */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Pre-Post Checklist (Score 4+ Before Posting)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CHECKLIST.map((c, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex gap-4 items-start">
                  <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-500/10">
                    <span className="text-sm font-bold font-mono text-emerald-400">{c.pts}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{c.q}</p>
                    <p className="text-xs text-muted-foreground">{c.stat}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Score banner */}
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <p className="text-sm text-foreground font-medium text-center">
              <span className="text-destructive font-bold">Score 0-2 = Don't post.</span>{" "}
              <span className="text-yellow-400 font-bold">Score 3 = Rework it.</span>{" "}
              <span className="text-emerald-400 font-bold">Score 4+ = Ship it.</span>{" "}
              <span className="text-muted-foreground">Your viral threads all score 5+.</span>
            </p>
          </div>
        </section>

        {/* SECTION 3: Validated Templates */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Validated Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEMPLATES.map((t) => (
              <Card key={t.name} className={`border-2 ${t.color}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{t.emoji}</span>
                    <Badge className={`text-xs ${t.badgeClass}`}>{t.name}</Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Scores {t.score}
                    </Badge>
                  </div>
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed bg-card/50 rounded-lg p-4 border border-border">
                    {t.template}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default Playbook;
