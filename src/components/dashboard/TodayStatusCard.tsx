import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

export function TodayStatusCard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["today-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 }).toISOString();
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 }).toISOString();

      const [scheduledRes, publishedRes, draftsRes, weekPostsRes, profileRes] = await Promise.all([
        supabase.from("scheduled_posts").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("status", "scheduled")
          .gte("scheduled_for", todayStart).lte("scheduled_for", todayEnd),
        supabase.from("scheduled_posts").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("status", "published")
          .gte("published_at", todayStart).lte("published_at", todayEnd),
        supabase.from("scheduled_posts").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("status", "draft"),
        supabase.from("scheduled_posts").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("status", "published")
          .gte("published_at", weekStart).lte("published_at", weekEnd),
        supabase.from("profiles").select("max_posts_per_day").eq("id", user.id).single(),
      ]);

      const maxPerDay = profileRes.data?.max_posts_per_day ?? 5;

      return {
        scheduledToday: scheduledRes.count ?? 0,
        publishedToday: publishedRes.count ?? 0,
        drafts: draftsRes.count ?? 0,
        weekPosts: weekPostsRes.count ?? 0,
        weekGoal: maxPerDay * 7,
      };
    },
    enabled: !!user?.id,
  });

  const today = new Date();

  return (
    <Card className="border-primary/20">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Today — {format(today, "EEEE, MMM d")}
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-bold text-foreground font-mono">{data?.scheduledToday ?? 0}</p>
            <p className="text-xs text-muted-foreground">Scheduled today</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground font-mono">{data?.publishedToday ?? 0}</p>
            <p className="text-xs text-muted-foreground">Published today</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground font-mono">{data?.drafts ?? 0}</p>
            <p className="text-xs text-muted-foreground">Drafts awaiting review</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary font-mono">
              {data?.weekPosts ?? 0}<span className="text-muted-foreground">/{data?.weekGoal ?? 35}</span>
            </p>
            <p className="text-xs text-muted-foreground">Posts this week</p>
          </div>
        </div>
        <Button
          variant="link"
          className="mt-3 p-0 h-auto text-primary text-xs gap-1"
          onClick={() => navigate("/queue")}
        >
          View Content Queue <ArrowRight className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
