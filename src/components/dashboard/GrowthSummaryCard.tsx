import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Props {
  followerCount: number | null;
  followerChange: number | null;
  bestPost: { text: string; views: number } | null;
}

export function GrowthSummaryCard({ followerCount, followerChange, bestPost }: Props) {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["growth-summary", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const [profileRes, postsRes] = await Promise.all([
        supabase.from("profiles").select("created_at").eq("id", user.id).single(),
        supabase
          .from("scheduled_posts")
          .select("id, ai_generated", { count: "exact", head: false })
          .eq("user_id", user.id)
          .eq("status", "published"),
      ]);

      const createdAt = profileRes.data?.created_at
        ? new Date(profileRes.data.created_at)
        : null;
      const totalPosts = postsRes.count ?? 0;
      const aiPosts = (postsRes.data ?? []).filter((p) => p.ai_generated).length;
      const timeSavedMinutes = aiPosts * 20;

      return {
        createdAt,
        totalPosts,
        timeSavedMinutes,
      };
    },
    enabled: !!user?.id,
  });

  const joinedAgo = stats?.createdAt
    ? formatDistanceToNow(stats.createdAt, { addSuffix: true })
    : null;
  const joinDate = stats?.createdAt ? format(stats.createdAt, "MMM d, yyyy") : null;
  const timeSaved = stats?.timeSavedMinutes
    ? stats.timeSavedMinutes >= 60
      ? `~${Math.round(stats.timeSavedMinutes / 60)} hours`
      : `~${stats.timeSavedMinutes} min`
    : "—";

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Your Growth with Threadable</h3>
        </div>

        {joinDate && (
          <p className="text-xs text-muted-foreground mb-4">
            Since joining: {joinDate} ({joinedAgo})
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-lg font-bold text-foreground font-mono">
              {followerCount?.toLocaleString() ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">Followers</p>
            {followerChange != null && followerChange !== 0 && (
              <span className={`text-xs font-semibold ${followerChange > 0 ? "text-emerald-400" : "text-red-400"}`}>
                {followerChange > 0 ? "+" : ""}{followerChange}
              </span>
            )}
          </div>
          <div>
            <p className="text-lg font-bold text-foreground font-mono">{stats?.totalPosts ?? 0}</p>
            <p className="text-xs text-muted-foreground">Posts created</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground font-mono">{timeSaved}</p>
            <p className="text-xs text-muted-foreground">Time saved</p>
          </div>
          <div>
            {bestPost ? (
              <>
                <p className="text-lg font-bold text-foreground font-mono">{bestPost.views.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground truncate">Best: "{bestPost.text.slice(0, 30)}…"</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground">Best performer</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
