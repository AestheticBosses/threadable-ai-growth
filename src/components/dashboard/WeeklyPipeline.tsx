import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfWeek, endOfWeek, addDays, format, isSameDay, isAfter, startOfDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, FileText, Sparkles, Minus, TrendingUp } from "lucide-react";

const PILLAR_COLORS = [
  { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/20", dot: "bg-blue-500" },
  { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/20", dot: "bg-purple-500" },
  { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/20", dot: "bg-orange-500" },
  { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-500" },
  { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/20", dot: "bg-pink-500" },
];

const ARCHETYPE_ICONS: Record<string, string> = {
  "Vault Drop": "📦",
  "Truth Bomb": "💡",
  "Hot Take": "🔥",
  "Window": "🪟",
};

const ARCHETYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Vault Drop": { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  "Truth Bomb": { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
  "Hot Take": { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  "Window": { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
};

type DayStatus = "published" | "scheduled" | "drafted" | "planned" | "empty";

function StatusBadge({ status }: { status: DayStatus }) {
  switch (status) {
    case "published":
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-2.5 w-2.5" /> Live
        </span>
      );
    case "scheduled":
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
          <Clock className="h-2.5 w-2.5" /> Sched.
        </span>
      );
    case "drafted":
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
          <FileText className="h-2.5 w-2.5" /> Draft
        </span>
      );
    case "planned":
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          <Sparkles className="h-2.5 w-2.5" /> Planned
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground border border-border">
          <Minus className="h-2.5 w-2.5" /> Empty
        </span>
      );
  }
}

function buildChangeMessage(regressionData: any): string | null {
  if (!regressionData) return null;
  const credLift = regressionData?.views_insights?.boolean_feature_lifts?.has_credibility_marker;
  const topNegative = regressionData?.views_insights?.top_negative_predictors?.[0];

  let msg = "";
  if (credLift?.with_avg && credLift?.without_avg) {
    const multiplier = Math.round(credLift.with_avg / credLift.without_avg);
    msg = `Your credibility-signal posts average ${credLift.with_avg.toLocaleString()} views vs ${credLift.without_avg.toLocaleString()} without — this week's plan is weighted toward them.`;
  }
  if (topNegative?.feature === "has_hashtag" && topNegative?.correlation) {
    const pct = Math.abs(topNegative.correlation * 100).toFixed(0);
    msg += (msg ? " " : "") + `Hashtags removed from all generated posts — they reduce your reach by ${pct}%.`;
  }
  return msg || null;
}

export function WeeklyPipeline() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const { data } = useQuery({
    queryKey: ["weekly-pipeline", user?.id, format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!user?.id) return null;

      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");

      const [planRes, scheduledRes, pillarsRes, regressionWeeklyRes, regressionActualRes] = await Promise.all([
        supabase
          .from("content_plan_items")
          .select("id, scheduled_date, archetype, funnel_stage, status, pillar_id, topic_id, post_id, is_test_slot")
          .eq("user_id", user.id)
          .gte("scheduled_date", weekStartStr)
          .lte("scheduled_date", weekEndStr),
        supabase
          .from("scheduled_posts")
          .select("id, status, scheduled_for, published_at, text_content")
          .eq("user_id", user.id)
          .gte("scheduled_for", weekStart.toISOString())
          .lte("scheduled_for", weekEnd.toISOString()),
        supabase
          .from("content_pillars")
          .select("id, name")
          .eq("user_id", user.id)
          .eq("is_active", true),
        // Keep weekly query for fallback
        supabase
          .from("content_strategies")
          .select("regression_insights")
          .eq("user_id", user.id)
          .eq("strategy_type", "weekly")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        // BUG FIX: also fetch strategy_type="regression" for actual regression data
        supabase
          .from("content_strategies")
          .select("strategy_data, regression_insights")
          .eq("user_id", user.id)
          .eq("strategy_type", "regression")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const planItems = planRes.data ?? [];
      const testCount = planItems.filter(i => i.is_test_slot).length;
      const scaleCount = planItems.filter(i => !i.is_test_slot).length;

      // Prefer regression-specific data, fall back to weekly
      const regressionData = regressionActualRes.data?.regression_insights as any
        ?? regressionActualRes.data?.strategy_data as any
        ?? regressionWeeklyRes.data?.regression_insights as any;

      return {
        planItems,
        scheduledPosts: scheduledRes.data ?? [],
        pillars: pillarsRes.data ?? [],
        regressionData,
        testCount,
        scaleCount,
      };
    },
    enabled: !!user?.id,
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const dayDate = addDays(weekStart, i);
    const dayStr = format(dayDate, "yyyy-MM-dd");
    const isToday = isSameDay(dayDate, today);
    const isFuture = isAfter(dayDate, today);

    const planItem = data?.planItems.find((p) => p.scheduled_date === dayStr);
    const pillarIdx = data?.pillars.findIndex((p) => p.id === planItem?.pillar_id) ?? -1;
    const pillar = data?.pillars.find((p) => p.id === planItem?.pillar_id);
    const pillarColor = pillarIdx >= 0 ? PILLAR_COLORS[pillarIdx % PILLAR_COLORS.length] : null;

    let status: DayStatus = "empty";
    const scheduledPost = data?.scheduledPosts.find((sp) => {
      const postDate = sp.scheduled_for ? format(new Date(sp.scheduled_for), "yyyy-MM-dd") : null;
      return postDate === dayStr;
    });

    if (scheduledPost?.status === "published") status = "published";
    else if (scheduledPost?.status === "scheduled") status = "scheduled";
    else if (scheduledPost?.status === "draft") status = "drafted";
    else if (planItem) status = "planned";
    else status = "empty";

    return { dayDate, dayStr, isToday, isFuture, planItem, pillar, pillarColor, status };
  });

  const handleDayClick = (day: typeof days[0]) => {
    const params = new URLSearchParams();
    if (day.planItem?.archetype) params.set("archetype", day.planItem.archetype);
    if (day.pillar?.name) params.set("pillar", day.pillar.name);
    params.set("action", "template");
    navigate(`/chat?${params.toString()}`);
  };

  const todayNeedsPost = (day: typeof days[0]) =>
    day.isToday && day.status === "planned";

  const changeMessage = buildChangeMessage(data?.regressionData);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">This Week's Pipeline</h2>
          {data && (data.testCount > 0 || data.scaleCount > 0) && (
            <span className="text-[10px] text-muted-foreground font-medium">
              {data.testCount} Tests / {data.scaleCount} Scales
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}
        </span>
      </div>

      {/* "What changed" strip */}
      {changeMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/10 px-4 py-2.5">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{changeMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const isActionable = todayNeedsPost(day);
          const archetypeName = day.planItem?.archetype ?? "";
          const archetypeColor = ARCHETYPE_COLORS[archetypeName] ?? null;

          return (
            <button
              key={i}
              onClick={() => handleDayClick(day)}
              className={`relative flex flex-col gap-1.5 rounded-xl border p-2.5 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                day.isToday
                  ? isActionable
                    ? "border-primary/60 bg-primary/8 ring-2 ring-primary/30 shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)] min-h-[130px]"
                    : "border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-sm min-h-[110px]"
                  : "border-border bg-card/30 hover:bg-accent/30 min-h-[110px]"
              }`}
            >
              {/* Day + date */}
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-[10px] font-semibold ${day.isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {format(day.dayDate, "EEE")}
                  </p>
                  <p className={`text-sm font-bold leading-none mt-0.5 ${day.isToday ? "text-primary" : "text-foreground"}`}>
                    {format(day.dayDate, "d")}
                  </p>
                </div>
                {day.planItem && day.planItem.is_test_slot != null && (
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border leading-none ${
                    day.planItem.is_test_slot
                      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
                      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                  }`}>
                    {day.planItem.is_test_slot ? "TEST" : "SCALE"}
                  </span>
                )}
              </div>

              {/* Pillar */}
              {day.pillar && day.pillarColor ? (
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${day.pillarColor.bg} ${day.pillarColor.border}`}>
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${day.pillarColor.dot}`} />
                  <span className={`text-[9px] font-semibold truncate leading-tight ${day.pillarColor.text}`}>
                    {day.pillar.name.split(" ").slice(0, 2).join(" ")}
                  </span>
                </div>
              ) : (
                <div className="flex-1" />
              )}

              {/* Archetype — color-coded */}
              {archetypeName && (
                archetypeColor ? (
                  <span className={`text-[10px] font-medium truncate px-1 py-0.5 rounded border ${archetypeColor.bg} ${archetypeColor.text} ${archetypeColor.border}`}>
                    {ARCHETYPE_ICONS[archetypeName] ?? ""} {archetypeName}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground truncate px-1 py-0.5 rounded border border-border bg-muted/10">
                    {ARCHETYPE_ICONS[archetypeName] ?? ""} {archetypeName}
                  </span>
                )
              )}

              {/* Status badge */}
              <div className="mt-auto space-y-1.5">
                <StatusBadge status={day.status} />
                {isActionable && (
                  <div className="flex items-center gap-0.5 text-[9px] font-semibold text-primary">
                    <Sparkles className="h-2.5 w-2.5" />
                    Generate →
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
