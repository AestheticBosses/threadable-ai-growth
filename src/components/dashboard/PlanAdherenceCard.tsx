import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";
import { startOfDay, subDays } from "date-fns";

export function PlanAdherenceCard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["plan-adherence", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const thirtyDaysAgo = startOfDay(subDays(new Date(), 30)).toISOString();

      // Get planned items with pillar/archetype in the last 30 days
      const [planRes, publishedRes] = await Promise.all([
        supabase
          .from("content_plan_items")
          .select("id, scheduled_date, pillar_id, archetype, status")
          .eq("user_id", user.id)
          .gte("scheduled_date", thirtyDaysAgo.slice(0, 10))
          .lt("scheduled_date", new Date().toISOString().slice(0, 10)),
        supabase
          .from("scheduled_posts")
          .select("id, published_at, content_category")
          .eq("user_id", user.id)
          .eq("status", "published")
          .gte("published_at", thirtyDaysAgo),
      ]);

      const planned = planRes.data ?? [];
      const published = publishedRes.data ?? [];

      if (planned.length === 0) return null;

      // Count days where a post was published when one was planned
      const plannedDates = new Set(planned.map((p) => p.scheduled_date));
      const publishedDates = new Set(
        published.map((p) => p.published_at?.slice(0, 10))
      );

      let matchedDays = 0;
      plannedDates.forEach((d) => {
        if (d && publishedDates.has(d)) matchedDays++;
      });

      const adherenceScore = Math.round((matchedDays / plannedDates.size) * 100);

      return { adherenceScore, plannedDays: plannedDates.size, matchedDays };
    },
    enabled: !!user?.id,
  });

  if (isLoading || !data) return null;

  const score = data.adherenceScore;
  const color = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-yellow-400" : "text-red-400";
  const barColor = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  const message =
    score >= 80 ? "You're nailing your content plan! 🎯" :
    score >= 60 ? "Good consistency — keep it up!" :
    score >= 40 ? "Room to improve — try to post every planned day." :
    "Let's build the habit — post more of your planned days.";

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-foreground">Plan Adherence</h3>
              <span className={`text-2xl font-bold font-mono ${color}`}>{score}%</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{message}</p>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {data.matchedDays} of {data.plannedDays} planned days posted (last 30 days)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
