import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Lightbulb, Loader2, Lock, Target, Users, Sparkles, BarChart3 } from "lucide-react";
import { PaywallModal } from "@/components/PaywallModal";

type GoalType = "get_comments" | "grow_audience" | "drive_traffic";

interface PlanPreviewProps {
  journeyStage: string;
  goalType: GoalType;
  onNavigate: (path: string) => Promise<void>;
}

const GOAL_LABELS: Record<GoalType, string> = {
  get_comments: "comments & engagement",
  grow_audience: "audience growth",
  drive_traffic: "traffic & conversions",
};

const STAGE_LABELS: Record<string, string> = {
  getting_started: "Getting Started",
  growing: "Growing",
  monetizing: "Monetizing",
};

const STAGE_FUNNEL: Record<string, { tof: number; mof: number; bof: number }> = {
  getting_started: { tof: 70, mof: 20, bof: 10 },
  growing: { tof: 30, mof: 50, bof: 20 },
  monetizing: { tof: 20, mof: 30, bof: 50 },
};

const FALLBACK_INSIGHTS: Record<GoalType, string[]> = {
  get_comments: [
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

interface ContentBucket {
  name: string;
  description: string | null;
  priority: number | null;
}

interface Archetype {
  name: string;
  emoji: string;
  recommended_percentage: number;
  description?: string;
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
  const { isPaid } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Data state
  const [postCount, setPostCount] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);
  const [hasRealInsights, setHasRealInsights] = useState(false);
  const [positioningStatement, setPositioningStatement] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<ContentBucket[]>([]);
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [postingCadence, setPostingCadence] = useState<string | null>(null);
  const [unrealizedPct, setUnrealizedPct] = useState<number | null>(null);

  const funnel = STAGE_FUNNEL[journeyStage] || STAGE_FUNNEL.getting_started;

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const [
        { count: postsCount },
        { data: regressionRow },
        { data: archetypeData },
        { data: brandingPlan },
        { data: profile },
        { data: bucketsData },
      ] = await Promise.all([
        supabase
          .from("posts_analyzed")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("content_strategies")
          .select("regression_insights")
          .eq("user_id", user.id)
          .not("regression_insights", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("content_strategies")
          .select("strategy_data")
          .eq("user_id", user.id)
          .eq("strategy_type", "archetype_discovery")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("user_plans")
          .select("plan_data")
          .eq("user_id", user.id)
          .eq("plan_type", "branding_plan")
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("mission, dream_client, dm_keyword, dm_offer, traffic_url, goal_type, posting_cadence")
          .eq("id", user.id)
          .single(),
        supabase
          .from("content_buckets")
          .select("name, description, priority")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("priority")
          .limit(3),
      ]);

      setPostCount(postsCount ?? 0);

      // Regression insights
      const regressionData = regressionRow?.regression_insights as any;
      const humanInsights = regressionData?.human_readable_insights;
      if (Array.isArray(humanInsights) && humanInsights.length > 0) {
        setInsights(humanInsights.slice(0, 3).map((text: string) => {
          const m = text.match(/(\d+)%/);
          if (m && parseInt(m[1], 10) > 500) {
            const multiplier = Math.round(parseInt(m[1], 10) / 100 + 1);
            return text.replace(/\d+%\s*(more|higher|greater|better)\s*\w*/, `average ${multiplier}x more views than posts without them`);
          }
          return text;
        }));
        setHasRealInsights(true);
      } else {
        setInsights(FALLBACK_INSIGHTS[goalType] || FALLBACK_INSIGHTS.drive_traffic);
        setHasRealInsights(false);
      }

      // Unrealized reach calculation
      const correlations = regressionData?.views_insights?.correlations ||
                           regressionData?.correlations || [];
      const topCorrelation = correlations
        .filter((c: any) => c.correlation > 0.3)
        .sort((a: any, b: any) => b.correlation - a.correlation)[0];
      let calcUnrealizedPct: number | null = null;
      if (topCorrelation) {
        const usageRate = topCorrelation.usage_rate || topCorrelation.frequency || 0;
        const gap = Math.round((1 - usageRate) * 100);
        if (gap > 20 && gap < 85) calcUnrealizedPct = gap;
      }
      setUnrealizedPct(calcUnrealizedPct);

      // Positioning
      const planData = brandingPlan?.plan_data as any;
      if (planData?.positioning_statement) {
        setPositioningStatement(planData.positioning_statement);
      }

      // Buckets
      setBuckets((bucketsData as ContentBucket[]) || []);

      // Archetypes
      const stratData = archetypeData?.strategy_data as any;
      if (stratData?.archetypes && Array.isArray(stratData.archetypes)) {
        setArchetypes(
          stratData.archetypes
            .slice(0, 3)
            .map((a: any) => ({
              name: a.name,
              emoji: a.emoji || "📝",
              recommended_percentage: a.recommended_percentage || 0,
              description: a.description,
            }))
        );
      }

      // Posting cadence
      setPostingCadence((profile as any)?.posting_cadence || null);

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

  const cadenceLabel = postingCadence === "2x_daily" ? "2 posts per day" : "1 post per day";

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-6 py-12 space-y-12">

        {/* Section 1 — CMO Opening */}
        <section className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Here's what we found — and what we're doing about it.
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            This is your growth brief. Built from {postCount > 0 ? `${postCount} posts, ${postCount * 8} data points, and ` : ""}your specific goal.
          </p>
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
                <p className="text-xs text-muted-foreground">data points</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{insights.length}</p>
                <p className="text-xs text-muted-foreground">patterns found</p>
              </div>
            </div>
            <p className="text-sm text-[hsl(38_92%_50%)] text-center mt-2">
              {unrealizedPct !== null
                ? `Based on your patterns, you've likely left ~${unrealizedPct}% of your potential reach unrealized. Here's how we fix that.`
                : "Most creators leave 30–50% of their potential reach unrealized by posting without a pattern. Here's yours."}
            </p>
          </section>
        )}

        {/* Section 2 — Positioning */}
        {positioningStatement && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Positioning</h2>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <p className="text-base text-foreground font-medium italic leading-relaxed">
                "{positioningStatement}"
              </p>
              <p className="text-xs text-muted-foreground italic mt-2">
                That's your unfair advantage. Most creators never find it.
              </p>
            </div>
          </section>
        )}

        {/* Section 3 — Data Insights */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Here's what your data is telling us — and what it's costing you.
          </h2>
          {!hasRealInsights && (
            <p className="text-xs text-muted-foreground italic rounded-lg bg-muted/50 px-3 py-2">
              Industry benchmarks for your goal — your data will replace these after your first week.
            </p>
          )}
          <div className="space-y-3">
            {insights.map((text, i) => {
              const lowerText = text.toLowerCase();
              const consequence = lowerText.includes("more views") || lowerText.includes("higher")
                ? "Every post without this pattern is suppressing your reach."
                : lowerText.includes("fewer") || lowerText.includes("less")
                ? "You've likely been accidentally leaving growth on the table."
                : "Apply this consistently to see compounding results.";
              return (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-4">
                  <Lightbulb className="h-5 w-5 text-[hsl(38_92%_50%)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-foreground/90">{text}</p>
                    <p className="text-xs text-muted-foreground mt-1">{consequence}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {hasRealInsights && (
            <p className="text-xs text-muted-foreground italic">
              These aren't general best practices. They're specific to your audience.
            </p>
          )}
        </section>

        {/* Section 4 — Audience (Content Buckets) */}
        {buckets.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Who You're Talking To</h2>
            </div>
            <div className="space-y-3">
              {buckets.map((bucket, i) => (
                <div key={i} className="rounded-xl border border-border bg-card/50 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground">{bucket.name}</p>
                    {bucket.priority && (
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        Priority {bucket.priority}
                      </span>
                    )}
                  </div>
                  {bucket.description && (
                    <p className="text-sm text-muted-foreground">{bucket.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 5 — Archetypes */}
        {archetypes.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">How You'll Show Up</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {archetypes.map((arch, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2"
                >
                  <span className="text-base">{arch.emoji}</span>
                  <span className="text-sm font-medium text-foreground">{arch.name}</span>
                  <span className="text-xs text-muted-foreground">— {arch.recommended_percentage}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 6 — Funnel Mix */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Content Mix</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Calibrated for {GOAL_LABELS[goalType]} at your {STAGE_LABELS[journeyStage] || "Getting Started"} stage.
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {funnelPill("TOF")}
              <span className="text-sm text-foreground font-medium">{funnel.tof}%</span>
              <span className="text-sm text-muted-foreground">Attract new people</span>
            </div>
            <div className="flex items-center gap-3">
              {funnelPill("MOF")}
              <span className="text-sm text-foreground font-medium">{funnel.mof}%</span>
              <span className="text-sm text-muted-foreground">Build belief</span>
            </div>
            <div className="flex items-center gap-3">
              {funnelPill("BOF")}
              <span className="text-sm text-foreground font-medium">{funnel.bof}%</span>
              <span className="text-sm text-muted-foreground">Drive action</span>
            </div>
          </div>
        </section>

        {/* Section 6.5 — 30-Day Trajectory */}
        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-card/50 p-6 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">If you follow this system for 30 days</p>
            <ul className="space-y-3">
              {[
                "Your baseline reach increases as the algorithm learns your posting pattern",
                "Inbound comments and DMs become more consistent and predictable",
                "You'll know exactly what to post — and have the data to prove why it works"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-primary mt-0.5">→</span>
                  <p className="text-sm text-foreground/80">{item}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground italic">This isn't a prediction. It's what happens when you post with the pattern instead of against it.</p>
          </div>
        </section>

        {/* Section 7 — Locked Weekly Plan */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Your first week of posts is ready.</h2>
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card/50 py-12">
            <Lock className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-foreground font-medium text-base">{cadenceLabel}, scheduled at your best times.</p>
            <p className="text-muted-foreground text-sm mt-1">Start your trial to publish them.</p>
          </div>
        </section>

        {/* Section 8 — CTA */}
        <section className="space-y-4 pb-8">
          <p className="text-center text-sm text-muted-foreground">
            {postCount} posts analyzed. Your pattern identified. Time to use it.
          </p>
          {isPaid ? (
            <Button
              size="lg"
              className="w-full h-14 text-base font-semibold"
              onClick={() => onNavigate("/dashboard")}
            >
              Activate My Growth System →
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                className="w-full h-14 text-base font-semibold"
                onClick={() => setPaywallOpen(true)}
              >
                Install My Content Engine — 7 Days Free →
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                7-day free trial · Card required · Cancel anytime.
              </p>
            </>
          )}
        </section>

        <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
      </div>
    </div>
  );
}
