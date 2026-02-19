import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { startOfWeek, endOfWeek, addDays, format, isSameDay, isAfter, startOfDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, FileText, Sparkles, Minus } from "lucide-react";

const PILLAR_COLORS = [
  "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "bg-orange-500/15 text-orange-400 border-orange-500/20",
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "bg-pink-500/15 text-pink-400 border-pink-500/20",
];

const ARCHETYPE_ICONS: Record<string, string> = {
  "Vault Drop": "📦",
  "Truth Bomb": "💡",
  "Hot Take": "🔥",
  "Window": "🪟",
};

type DayStatus = "published" | "scheduled" | "drafted" | "planned" | "empty";

export function WeeklyPlanGrid() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const { data } = useQuery({
    queryKey: ["weekly-plan-grid", user?.id, format(weekStart, "yyyy-MM-dd")],
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
    const pillar = data?.pillars.find((p) => p.id === planItem?.pillar_id);
    const pillarColorIdx = data?.pillars.findIndex((p) => p.id === planItem?.pillar_id) ?? -1;
    const pillarColor = pillarColorIdx >= 0 ? PILLAR_COLORS[pillarColorIdx % PILLAR_COLORS.length] : null;

    // Determine status
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

    return { dayDate, dayStr, isToday, isFuture, planItem, pillar, pillarColor, status, scheduledPost };
  });

  const StatusIcon = ({ status, size = "h-3.5 w-3.5" }: { status: DayStatus; size?: string }) => {
    switch (status) {
      case "published": return <CheckCircle2 className={`${size} text-emerald-400`} />;
      case "scheduled": return <Clock className={`${size} text-blue-400`} />;
      case "drafted": return <FileText className={`${size} text-muted-foreground`} />;
      case "planned": return <Sparkles className={`${size} text-primary/60`} />;
      default: return <Minus className={`${size} text-muted-foreground/40`} />;
    }
  };

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">This Week's Plan</h3>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day, i) => (
            <button
              key={i}
              onClick={() => {
                if (day.planItem) {
                  const params = new URLSearchParams();
                  if (day.planItem.archetype) params.set("archetype", day.planItem.archetype);
                  if (day.pillar?.name) params.set("pillar", day.pillar.name);
                  params.set("action", "generate");
                  navigate(`/chat?${params.toString()}`);
                } else {
                  navigate("/chat");
                }
              }}
              className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all hover:bg-accent/50 cursor-pointer min-h-[90px] ${
                day.isToday
                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-card/30"
              }`}
            >
              {/* Day header */}
              <span className={`text-[10px] font-semibold ${day.isToday ? "text-primary" : "text-muted-foreground"}`}>
                {format(day.dayDate, "EEE")}
              </span>
              <span className={`text-xs font-bold ${day.isToday ? "text-primary" : "text-foreground"}`}>
                {format(day.dayDate, "d")}
              </span>

              {/* Status icon */}
              <StatusIcon status={day.status} />

              {/* Pillar/archetype info */}
              {day.planItem && (
                <div className="w-full space-y-1 mt-0.5">
                  {day.pillar && (
                    <div className={`text-[9px] px-1 py-0.5 rounded border text-center leading-tight font-medium truncate ${day.pillarColor ?? "bg-muted text-muted-foreground border-border"}`}>
                      {day.pillar.name.split(" ")[0]}
                    </div>
                  )}
                  {day.planItem.archetype && (
                    <div className="text-center text-sm">
                      {ARCHETYPE_ICONS[day.planItem.archetype] ?? ""}
                    </div>
                  )}
                </div>
              )}

              {day.status === "empty" && !day.isFuture && (
                <span className="text-[9px] text-muted-foreground/50 text-center">–</span>
              )}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-border">
          {[
            { status: "published" as DayStatus, label: "Published" },
            { status: "scheduled" as DayStatus, label: "Scheduled" },
            { status: "drafted" as DayStatus, label: "Draft" },
            { status: "planned" as DayStatus, label: "Planned" },
            { status: "empty" as DayStatus, label: "Empty" },
          ].map(({ status, label }) => (
            <div key={status} className="flex items-center gap-1">
              <div className="flex items-center">
                {status === "published" && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                {status === "scheduled" && <Clock className="h-3 w-3 text-blue-400" />}
                {status === "drafted" && <FileText className="h-3 w-3 text-muted-foreground" />}
                {status === "planned" && <Sparkles className="h-3 w-3 text-primary/60" />}
                {status === "empty" && <Minus className="h-3 w-3 text-muted-foreground/40" />}
              </div>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
