import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

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
    template: `I [tracked/studied/analyzed] [specific thing] for [time period].

Here's the exact breakdown of [what drove X vs what drove Y]:

1. [Specific finding with data]
2. [Specific finding with data]
3. [Specific finding with data]
4. [Specific finding with data]

The takeaway: [Contrarian reframe of the metric people obsess over].`,
  },
  {
    emoji: "🔥",
    name: "Truth Bomb",
    score: "4-5",
    color: "border-emerald-500/40",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    template: `[Universal truth in under 15 words that makes the reader feel SEEN.]

[Optional: one vivid sentence that creates a mental image.]`,
  },
  {
    emoji: "💣",
    name: "Niche Hot Take",
    score: "4-5",
    color: "border-yellow-500/40",
    badgeClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    template: `If your [INDUSTRY ROLE] tells you to [COMMON BAD ADVICE],

[EXTREME VISCERAL REACTION].

[Why in 1 sentence — optional]`,
  },
  {
    emoji: "🪟",
    name: "Window",
    score: "3-4",
    color: "border-blue-500/40",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    template: `[THING HAPPENING RIGHT NOW — today/tomorrow]

[1-2 raw sentences of context]

[NO business tie-in. Pure human.]`,
  },
];

const RULES = [
  "Accept the power law. 10% of posts = 60%+ of results. Volume is the strategy.",
  "2+ emotional triggers per post or don't post. Single-emotion threads die.",
  "Vivid visual > abstract truth.",
  "Name-drop authority in LINE ONE for Vault Drops. Proven 4x view multiplier.",
  "NICHE hot takes only. Generic contrarian advice is your worst-performing content.",
  "Post 2 Vault Drops/week. They drive ~72% of total follows.",
  "Truth Bombs need specificity. \"No job loved you back\" works. \"Business is hard\" doesn't.",
  "Window posts must be REAL-TIME. Present tense, not past tense.",
  "Profanity is a spice, not a strategy. Near-zero correlation with views.",
  "Run every post through the pre-post checklist. Score 4+ or rewrite.",
];

const MOCK_POSTS = [
  { text: "I tracked 47 SaaS founders' content strategies for 6 months.\n\nHere's exactly what separated the ones who grew from the ones who stalled:\n\n1. Top growers posted 2x Vault Drops/week (frameworks with numbers)\n2. 89% of viral posts had 2+ emotional triggers\n3. Authority name-drops in line 1 = 4x more views\n4. Generic advice posts averaged 0.07% follow rate\n\nThe takeaway: Gary Vee was right about volume. But Alex Hormozi was right about specificity.\n\nSave this. Follow for more data-backed frameworks.", cat: "Vault Drop", score: 5 },
  { text: "Your boss didn't \"quiet fire\" you.\n\nYou just finally noticed the silence.", cat: "Truth Bomb", score: 5 },
  { text: "If your marketing agency tells you to \"just be consistent,\"\n\nRun.\n\nConsistency without strategy is just organized failure.", cat: "Niche Hot Take", score: 4 },
  { text: "I studied every post from my top 5 competitors this quarter.\n\nThe data is clear:\n\n1. Short truth bombs (<25 words) get 3x more reposts\n2. Educational posts with $ amounts get 17,400 avg views\n3. Behind-the-scenes posts convert 5x better to DMs\n4. Hot takes WITHOUT niche specificity die every time\n\nStop copying what looks good. Copy what the DATA says works.", cat: "Vault Drop", score: 6 },
  { text: "Just got off a call where the client said \"we tried content marketing, it didn't work.\"\n\nThey posted 8 times in 3 months.\n\nThat's not trying. That's testing the water with your pinky toe.", cat: "Window", score: 4 },
  { text: "Nobody cares about your morning routine.\n\nThey care about the moment at 2am when you almost quit.", cat: "Truth Bomb", score: 5 },
  { text: "If your social media manager tells you to \"ride trending audio,\"\n\nFire them.\n\nYour audience doesn't follow you for dance moves.", cat: "Niche Hot Take", score: 5 },
  { text: "The best content strategy I've ever seen?\n\nA founder who posted his P&L every single Friday.\n\nNo filters. No spin. Just numbers.\n\nHe grew from 200 to 47,000 followers in 9 months.\n\nVulnerability at scale is the ultimate growth hack.", cat: "Truth Bomb", score: 4 },
  { text: "Currently rewriting my entire content calendar from scratch.\n\nWhy? Because I realized I was optimizing for likes when I should have been optimizing for follows.\n\nDifferent metric. Completely different strategy.", cat: "Window", score: 4 },
  { text: "I analyzed $2.3M worth of creator revenue across 12 accounts.\n\nHere's what actually drives income (not vanity metrics):\n\n1. Follow rate per post matters more than total views\n2. DM conversion comes from Window posts, not Vault Drops\n3. Reposts from Truth Bombs feed the top of funnel\n4. Hot Takes with niche specificity = highest follow rate per view\n\nThe takeaway: Daniel Priestley's Key Person of Influence model applies to every platform.", cat: "Vault Drop", score: 6 },
];

const DAY_SCHEDULE = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_SCHEDULE = ["08:00", "12:00", "08:00", "17:00", "08:00", "10:00", "09:00", "12:00", "17:00", "09:00"];

const Playbook = () => {
  usePageTitle("Playbook", "Your validated content strategy playbook");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const now = new Date();
      const startDay = new Date(now);
      startDay.setDate(startDay.getDate() + 1);
      // Find next Monday
      while (startDay.getDay() !== 1) {
        startDay.setDate(startDay.getDate() + 1);
      }

      const rows = MOCK_POSTS.map((p, i) => {
        const schedDate = new Date(startDay);
        const dayIdx = i < 7 ? i : i - 7;
        schedDate.setDate(schedDate.getDate() + dayIdx);
        const [h, m] = TIME_SCHEDULE[i].split(":").map(Number);
        schedDate.setHours(h, m, 0, 0);

        return {
          user_id: user.id,
          text_content: p.text,
          content_category: p.cat,
          pre_post_score: p.score,
          status: "draft" as const,
          ai_generated: true,
          scheduled_for: schedDate.toISOString(),
        };
      });

      const { error } = await supabase.from("scheduled_posts").insert(rows);
      if (error) throw error;

      toast({ title: "10 draft posts generated!", description: "Head to Content Queue to review and schedule." });
      navigate("/queue");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

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
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed rounded-lg p-4 border border-border" style={{ background: "rgba(0,0,0,0.3)" }}>
                    {t.template}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* SECTION 4: 10 Rules */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">10 Rules — Validated by 30 Posts</h2>
          <div className="rounded-lg border-2 border-destructive/40 p-5 space-y-3" style={{ background: "rgba(239,68,68,0.06)" }}>
            <ol className="space-y-3">
              {RULES.map((rule, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 font-mono font-bold text-destructive">{i + 1}.</span>
                  <span className="text-foreground">{rule}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* SECTION 5: Generate Button */}
        <section className="flex justify-center py-4">
          <Button
            size="lg"
            disabled={generating}
            onClick={handleGenerate}
            className="gap-2 px-8 py-4 text-base rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {generating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            {generating ? "Generating..." : "✨ Generate This Week's Content →"}
          </Button>
        </section>
      </div>
    </AppLayout>
  );
};

export default Playbook;
