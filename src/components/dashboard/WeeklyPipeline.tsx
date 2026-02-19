import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfWeek, endOfWeek, addDays, format, isSameDay, isAfter, startOfDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, FileText, Sparkles, Minus } from "lucide-react";

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

      const [planRes, scheduledRes, pillarsRes] = await Promise.all([
        supabase
          .from("content_plan_items")
          .select("id, scheduled_date, archetype, funnel_stage, status, pillar_id, topic_id, post_id")
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
      ]);

      return {
        planItems: planRes.data ?? [],
        scheduledPosts: scheduledRes.data ?? [],
        pillars: pillarsRes.data ?? [],
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">This Week's Pipeline</h2>
        <span className="text-xs text-muted-foreground">
          {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const isActionable = todayNeedsPost(day);
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
              <div>
                <p className={`text-[10px] font-semibold ${day.isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {format(day.dayDate, "EEE")}
                </p>
                <p className={`text-sm font-bold leading-none mt-0.5 ${day.isToday ? "text-primary" : "text-foreground"}`}>
                  {format(day.dayDate, "d")}
                </p>
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

              {/* Archetype */}
              {day.planItem?.archetype && (
                <span className="text-[10px] text-muted-foreground truncate">
                  {ARCHETYPE_ICONS[day.planItem.archetype] ?? ""} {day.planItem.archetype}
                </span>
              )}

              {/* Status badge */}
              <div className="mt-auto space-y-1.5">
                <StatusBadge status={day.status} />
                {/* Generate CTA for today if not yet posted */}
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
