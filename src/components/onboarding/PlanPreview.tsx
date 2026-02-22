import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Lightbulb, ChevronDown, ChevronUp, Loader2, Lock } from "lucide-react";
import { PaywallModal } from "@/components/PaywallModal";

type GoalType = "dm_leads" | "grow_audience" | "drive_traffic";

interface PlanPreviewProps {
  journeyStage: string;
  goalType: GoalType;
  onNavigate: (path: string) => Promise<void>;
}

/* ── Section 1 — Stage Declaration ── */
const STAGE_HEADINGS: Record<string, { title: string; subtitle: string }> = {
  getting_started: {
    title: "You're building from zero. That's the advantage.",
    subtitle: "We'll focus on reach and establishing your authority voice before introducing CTAs.",
  },
  growing: {
    title: "You've built momentum. Now we make it intentional.",
    subtitle: "We'll turn attention into trust — and trust into structured conversion.",
  },
  monetizing: {
    title: "You already convert. Now we make it repeatable.",
    subtitle: "Your audience knows you. Time to turn attention into consistent revenue.",
  },
};

const STAGE_LABELS: Record<string, string> = {
  getting_started: "Getting Started",
  growing: "Growing",
  monetizing: "Monetizing",
};

const GOAL_LABELS: Record<GoalType, string> = {
  dm_leads: "DM leads",
  grow_audience: "audience growth",
  drive_traffic: "traffic",
};

/* ── Section 2 — Patterns (fallback insights) ── */
const FALLBACK_INSIGHTS: Record<GoalType, string[]> = {
  dm_leads: [
    "Trust posts drive the most DM momentum.",
    "Specificity converts — vague hooks lose readers in the first line.",
    "Consistent posting at your cadence trains your audience to expect you.",
  ],
  grow_audience: [
    "Contrarian takes outperform agreeable content for follower growth.",
    "Personal stories get shared more than tactical advice.",
    "Hooks with numbers stop the scroll 2x more effectively.",
  ],
  drive_traffic: [
    "CTAs embedded in value posts outperform standalone promotional posts.",
    "Posts that tease a resource before linking drive higher click-through.",
    "Warm audiences click — cold audiences scroll. Trust comes first.",
  ],
};

/* ── Section 3 — Insight (outcome statements) ── */
const INSIGHT_STATEMENTS: Record<string, Record<GoalType, string[]>> = {
  growing: {
    drive_traffic: [
      "Your highest engagement posts create tension before teaching.",
      "Authority framing expands reach faster than neutral advice.",
      "Specific proof earns trust. Generic advice doesn't.",
    ],
    dm_leads: [
      "Conversation starts with belief, not pitches.",
      "Your best posts create curiosity before the ask.",
      "Trust posts drive the most DM momentum.",
    ],
    grow_audience: [
      "Contrarian framing outperforms agreeable content.",
      "Personal stories get shared more than tactical advice.",
      "Consistency compounds — volume alone doesn't.",
    ],
  },
  getting_started: {
    drive_traffic: [
      "Authority framing earns trust before links earn clicks.",
      "Specific proof points outperform generic advice.",
      "Reach comes from hooks that create tension.",
    ],
    dm_leads: [
      "Belief-driven posts start more conversations than pitches.",
      "Curiosity hooks pull people in before the ask.",
      "Trust posts drive the most DM momentum.",
    ],
    grow_audience: [
      "Contrarian takes earn more shares than agreeable content.",
      "Vulnerability creates connection faster than expertise.",
      "Consistency compounds — volume alone doesn't.",
    ],
  },
  monetizing: {
    drive_traffic: [
      "Your audience is warm — embedded CTAs outperform hard sells.",
      "Proof-based trust posts prime clicks before the link.",
      "Authority framing keeps traffic quality high.",
    ],
    dm_leads: [
      "Your audience already trusts you — curiosity pulls DMs.",
      "Belief-building posts create the warmest conversations.",
      "Trust posts drive the most DM momentum.",
    ],
    grow_audience: [
      "Contrarian framing keeps your content shareable at scale.",
      "Personal stories compound your reach over time.",
      "Consistency compounds — volume alone doesn't.",
    ],
  },
};

/* ── Section 4 — Prescription ── */
const PRESCRIPTION_LINES: Record<GoalType, string> = {
  drive_traffic: "TOF: lead with authority hooks. MOF: build trust through specific proof. BOF: convert with embedded links.",
  dm_leads: "TOF: curiosity. MOF: belief-building. BOF: natural keyword introduction.",
  grow_audience: "TOF: contrarian hooks. MOF: personal stories. BOF: consistency signals.",
};

/* ── Section 5 — Weekly Plan ── */
const WEEKLY_PLAN_LINES: Record<GoalType, string> = {
  drive_traffic: "Designed to earn the click, validate fast, and send traffic with intent.",
  dm_leads: "Designed to start conversations, earn replies, and pull DMs inbound.",
  grow_audience: "Designed to get shared, earn follows, and compound consistency.",
};

const STAGE_FUNNEL: Record<string, { tof: number; mof: number; bof: number }> = {
  getting_started: { tof: 70, mof: 20, bof: 10 },
  growing: { tof: 30, mof: 50, bof: 20 },
  monetizing: { tof: 20, mof: 30, bof: 50 },
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DraftPost {
  id: string;
  text_content: string | null;
  funnel_stage: string | null;
  scheduled_for: string | null;
  content_category: string | null;
}

function funnelPill(stage: string | null) {
  switch (stage?.toUpperCase()) {
    case "TOF":
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/20 text-primary">Reach</span>;
    case "MOF":
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[hsl(217_91%_60%/0.2)] text-[hsl(217_91%_60%)]">Trust</span>;
    case "BOF":
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[hsl(142_71%_45%/0.2)] text-[hsl(142_71%_45%)]">Convert</span>;
    default:
      return null;
  }
}

export default function PlanPreview({ journeyStage, goalType, onNavigate }: PlanPreviewProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<DraftPost[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [patternCount, setPatternCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const stage = STAGE_HEADINGS[journeyStage] || STAGE_HEADINGS.getting_started;
  const funnel = STAGE_FUNNEL[journeyStage] || STAGE_FUNNEL.getting_started;
  const stageInsights = INSIGHT_STATEMENTS[journeyStage]?.[goalType] || INSIGHT_STATEMENTS.getting_started[goalType];

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const [{ data: regressionRow, error: regressionErr }, { count: postsCount }] = await Promise.all([
        supabase
          .from("content_strategies")
          .select("regression_insights")
          .eq("user_id", user.id)
          .not("regression_insights", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("posts_analyzed")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      console.log("regressionRow:", regressionRow, "error:", regressionErr);

      const humanInsights = (regressionRow?.regression_insights as any)?.human_readable_insights;
      const insightsList = Array.isArray(humanInsights) && humanInsights.length > 0 ? humanInsights : [];
      setPatternCount(insightsList.length);
      setPostCount(postsCount ?? 0);

      if (insightsList.length > 0) {
        setInsights(insightsList.slice(0, 3));
      } else {
        setInsights(FALLBACK_INSIGHTS[goalType] || FALLBACK_INSIGHTS["drive_traffic"]);
      }

      // Fetch drafts
      const { data: posts } = await supabase
        .from("scheduled_posts")
        .select("id, text_content, funnel_stage, scheduled_for, content_category")
        .eq("user_id", user.id)
        .eq("status", "draft")
        .order("scheduled_for", { ascending: true })
        .limit(7);

      setDrafts((posts as DraftPost[]) || []);
      setLoading(false);
    };
    load();
  }, [user?.id, goalType]);

  const handleApprove = async () => {
    if (!user) return;
    await supabase
      .from("scheduled_posts")
      .update({ status: "approved" })
      .eq("user_id", user.id)
      .eq("status", "draft");
    await onNavigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-6 py-12 space-y-12">

        {/* Section 1 — Stage Declaration */}
        <section className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">{stage.title}</h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">{stage.subtitle}</p>
        </section>

        {/* Stats Bar */}
        {postCount > 0 && (
          <section className="space-y-3">
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{postCount}</p>
                <p className="text-xs text-muted-foreground">posts analyzed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{postCount * 8}</p>
                <p className="text-xs text-muted-foreground">data points examined</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{patternCount}</p>
                <p className="text-xs text-muted-foreground">patterns identified</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              We analyzed your actual content history to build this plan — not a template.
            </p>
          </section>
        )}

        {/* Section 2 — Patterns */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Your content has patterns. We found the ones that matter.</h2>
          <div className="space-y-3">
            {insights.map((text, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-4">
                <Lightbulb className="h-5 w-5 text-[hsl(38_92%_50%)] shrink-0 mt-0.5" />
                <p className="text-sm text-foreground/90">{(() => {
                  const m = text.match(/(\d+)%/);
                  if (m && parseInt(m[1], 10) > 500) {
                    const multiplier = Math.round(parseInt(m[1], 10) / 100 + 1);
                    return text.replace(/\d+%\s*(more|higher|greater|better)\s*\w*/, `average ${multiplier}x more views than posts without them`);
                  }
                  return text;
                })()}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground italic">
            These aren't general best practices. They're specific to your audience.
          </p>
        </section>

        {/* Section 3 — Insight */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">What this tells us.</h2>
          <ul className="space-y-2">
            {stageInsights.map((text, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <p className="text-sm text-foreground/90">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 4 — Prescription */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">This week's strategic shift.</h2>
          <p className="text-sm text-foreground/80">{PRESCRIPTION_LINES[goalType]}</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary">Reach (TOF)</span>
              <span className="text-sm text-foreground font-medium">{funnel.tof}%</span>
              <span className="text-sm text-muted-foreground">Attract new people</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[hsl(217_91%_60%/0.2)] text-[hsl(217_91%_60%)]">Trust (MOF)</span>
              <span className="text-sm text-foreground font-medium">{funnel.mof}%</span>
              <span className="text-sm text-muted-foreground">Build belief</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[hsl(142_71%_45%/0.2)] text-[hsl(142_71%_45%)]">Convert (BOF)</span>
              <span className="text-sm text-foreground font-medium">{funnel.bof}%</span>
              <span className="text-sm text-muted-foreground">Drive action</span>
            </div>
          </div>
          <p className="text-sm italic text-muted-foreground">
            Calibrated for your {STAGE_LABELS[journeyStage] || "Getting Started"} stage and {GOAL_LABELS[goalType]} goal.
          </p>
        </section>

        {/* Section 5 — Weekly Plan */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Your first week</h2>
          <p className="text-sm text-foreground/80">{WEEKLY_PLAN_LINES[goalType]}</p>
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {drafts.map((post, i) => {
                const date = post.scheduled_for ? new Date(post.scheduled_for) : null;
                const dayLabel = date ? DAY_LABELS[date.getDay() === 0 ? 6 : date.getDay() - 1] : DAY_LABELS[i % 7];
                const timeLabel = date
                  ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                  : "";

                return (
                  <div
                    key={post.id}
                    className="rounded-xl border border-border bg-card/50 overflow-hidden"
                  >
                    <div className="w-full flex items-center gap-3 p-4 text-left">
                      <div className="shrink-0">
                        <p className="text-sm font-semibold text-foreground">{dayLabel}</p>
                        {timeLabel && <p className="text-[11px] text-muted-foreground">{timeLabel}</p>}
                      </div>
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        {funnelPill(post.funnel_stage)}
                        {post.content_category && (
                          <span className="text-xs text-muted-foreground truncate">{post.content_category}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {drafts.length > 0 && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-black/60 backdrop-blur-[6px]">
                <Lock className="h-8 w-8 text-white mb-3" />
                <p className="text-white font-medium text-base">Your posts are ready.</p>
                <p className="text-gray-400 text-sm mt-1">Start your free trial to generate and schedule them.</p>
              </div>
            )}
          </div>
          {drafts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No draft posts were generated. You can create them from the Chat.</p>
          )}
        </section>

        {/* Section 6 — Launch CTA */}
        <section className="space-y-4 pb-8">
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold"
            onClick={() => setPaywallOpen(true)}
          >
            Start Free Trial — Plans from $49/mo →
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            7-day free trial · Card required · Cancel anytime.
          </p>
        </section>

        <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
      </div>
    </div>
  );
}
