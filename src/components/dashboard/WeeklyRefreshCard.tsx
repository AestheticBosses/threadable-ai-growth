import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

export function WeeklyRefreshCard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-refresh-summary", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("last_weekly_refresh_at")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  if (isLoading || !data?.last_weekly_refresh_at) return null;

  const lastRefresh = new Date(data.last_weekly_refresh_at);
  const daysSince = (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 7) return null;

  const formattedDate = lastRefresh.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card className="border-purple-500/30 bg-purple-500/5">
      <CardContent className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <RefreshCw className="h-4 w-4 text-purple-400 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Strategy refreshed on <span className="font-medium text-foreground">{formattedDate}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
