import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth } from "date-fns";

type JourneyStage = "getting_started" | "growing" | "monetizing";

const STAGE_CONFIG: Record<JourneyStage, {
  emoji: string;
  label: string;
  tip: string;
  nextStage: JourneyStage | null;
  nextLabel: string | null;
}> = {
  getting_started: {
    emoji: "🌱",
    label: "Building Your Audience",
    tip: "Focus on shareable, high-reach content. Your plan is 70% reach-focused.",
    nextStage: "growing",
    nextLabel: "Growing & Engaging",
  },
  growing: {
    emoji: "📈",
    label: "Growing & Engaging",
    tip: "Your plan focuses on trust-building content that starts conversations.",
    nextStage: "monetizing",
    nextLabel: "Ready to Monetize",
  },
  monetizing: {
    emoji: "🚀",
    label: "Ready to Monetize",
    tip: "50% of your content drives toward your offer. Make sure your link-in-bio is set.",
    nextStage: null,
    nextLabel: null,
  },
};

export function MilestoneCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const { data, isLoading } = useQuery({
    queryKey: ["milestone-card", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get journey stage
      const { data: stageRow } = await supabase
        .from("content_strategies")
        .select("journey_stage")
        .eq("user_id", user.id)
        .eq("strategy_type", "journey_stage")
        .maybeSingle();

      const stage = (stageRow as any)?.journey_stage as JourneyStage | null;
      if (!stage) return null;

      // Stage-specific data
      if (stage === "getting_started") {
        const { data: snap } = await supabase
          .from("follower_snapshots")
          .select("follower_count")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return { stage, value: snap?.follower_count ?? 0, target: 1000 };
      }

      if (stage === "growing") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: posts } = await supabase
          .from("posts_analyzed")
          .select("engagement_rate")
          .eq("user_id", user.id)
          .gte("posted_at", thirtyDaysAgo.toISOString())
          .not("engagement_rate", "is", null);
        const avg = posts && posts.length > 0
          ? posts.reduce((sum, p) => sum + (p.engagement_rate ?? 0), 0) / posts.length
          : 0;
        return { stage, value: Math.round(avg * 100) / 100, target: 5 };
      }

      if (stage === "monetizing") {
        const { count } = await supabase
          .from("content_plan_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("funnel_stage", "BOF")
          .eq("status", "published")
          .gte("scheduled_date", format(monthStart, "yyyy-MM-dd"))
          .lte("scheduled_date", format(monthEnd, "yyyy-MM-dd"));
        return { stage, value: count ?? 0, target: 20 };
      }

      return null;
    },
    enabled: !!user?.id,
  });

  const handleLevelUp = async (nextStage: JourneyStage) => {
    if (!user?.id) return;
    const { data: existing } = await supabase
      .from("content_strategies")
      .select("id")
      .eq("user_id", user.id)
      .eq("strategy_type", "journey_stage")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("content_strategies")
        .update({ journey_stage: nextStage } as any)
        .eq("id", existing.id);
    } else {
      await supabase.from("content_strategies").insert({
        user_id: user.id,
        strategy_type: "journey_stage",
        journey_stage: nextStage,
        status: "active",
      } as any);
    }
    window.location.reload();
  };

  if (isLoading || !data) return null;

  const config = STAGE_CONFIG[data.stage];
  const pct = Math.min(100, Math.round((data.value / data.target) * 100));

  const milestoneLabel = data.stage === "getting_started"
    ? `${data.value.toLocaleString()} / 1,000 followers`
    : data.stage === "growing"
    ? `${data.value}% avg engagement / 5% target`
    : `${data.value} / 20 BOF posts this month`;

  return (
    <Card className="border-border bg-card/50">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{config.emoji}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Stage</span>
            </div>
            <h3 className="text-base font-bold text-foreground mt-0.5">{config.label}</h3>
          </div>
          {config.nextStage && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary h-auto py-1 px-2 shrink-0"
              onClick={() => handleLevelUp(config.nextStage!)}
            >
              I've leveled up →
            </Button>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Milestone progress</span>
            <span className="text-foreground font-semibold">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
          <p className="text-xs text-muted-foreground">{milestoneLabel}</p>
        </div>

        {/* Tip */}
        <p className="text-xs text-muted-foreground border-t border-border pt-3 leading-relaxed">
          💡 {config.tip}
        </p>
      </CardContent>
    </Card>
  );
}
