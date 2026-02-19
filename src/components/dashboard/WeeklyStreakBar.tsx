import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  startOfWeek, endOfWeek, addDays, format, isSameDay, isAfter, isBefore,
  startOfDay, differenceInCalendarWeeks
} from "date-fns";
import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeeklyStreakBar() {
  const { user } = useAuth();

  const { data: publishedDates = [] } = useQuery({
    queryKey: ["weekly-streak-published", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("scheduled_posts")
        .select("published_at")
        .eq("user_id", user.id)
        .eq("status", "published")
        .not("published_at", "is", null);
      return (data ?? []).map((p) => new Date(p.published_at!));
    },
    enabled: !!user?.id,
  });

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  // Calculate weekly streak (consecutive weeks with 5+ posts)
  const weekStreak = (() => {
    if (publishedDates.length === 0) return 0;
    let streak = 0;
    let checkWeekStart = startOfWeek(today, { weekStartsOn: 1 });

    for (let w = 0; w < 52; w++) {
      const wStart = startOfWeek(addDays(checkWeekStart, -w * 7), { weekStartsOn: 1 });
      const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
      const postsInWeek = publishedDates.filter(
        (d) => !isBefore(d, wStart) && !isAfter(d, wEnd)
      );
      if (postsInWeek.length >= 5) streak++;
      else break;
    }
    return streak;
  })();

  // This week's days status
  const days = DAY_LABELS.map((label, i) => {
    const dayDate = addDays(weekStart, i);
    const isToday = isSameDay(dayDate, today);
    const isFuture = isAfter(dayDate, today);
    const posted = publishedDates.some((d) => isSameDay(d, dayDate));
    const missed = !isFuture && !posted && !isToday;

    let status: "posted" | "today" | "upcoming" | "missed";
    if (posted) status = "posted";
    else if (isToday) status = "today";
    else if (isFuture) status = "upcoming";
    else status = "missed";

    return { label, dayDate, status, posted };
  });

  const postedCount = days.filter((d) => d.posted).length;
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d")}`;

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Week of {weekLabel}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {postedCount} of 7 days posted
              </span>
            </div>
          </div>
          {weekStreak > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1.5">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-orange-400">{weekStreak} week streak</span>
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {days.map((day, i) => {
            const dotClass =
              day.status === "posted"
                ? "bg-emerald-500 border-emerald-500"
                : day.status === "today"
                ? "bg-transparent border-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-background"
                : day.status === "missed"
                ? "bg-red-500/20 border-red-500/50"
                : "bg-muted/50 border-border";

            return (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                <div className={`h-4 w-4 rounded-full border-2 transition-all ${dotClass}`} />
                <span
                  className={`text-[10px] font-medium ${
                    day.status === "today" ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(postedCount / 7) * 100}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
