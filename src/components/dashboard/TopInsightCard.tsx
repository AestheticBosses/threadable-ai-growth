import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function TopInsightCard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: insight } = useQuery({
    queryKey: ["top-insight", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("content_strategies")
        .select("regression_insights")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data?.regression_insights) return null;
      const insights = data.regression_insights as any[];
      if (!Array.isArray(insights) || insights.length === 0) return null;
      // Pick the insight with the highest impact
      return insights[0];
    },
    enabled: !!user?.id,
  });

  return (
    <Card className="border-primary/20">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-5 w-5 text-yellow-400" />
          <h3 className="text-sm font-semibold text-foreground">Insight of the Week</h3>
        </div>
        {insight ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground leading-relaxed italic">
              "{insight.finding || insight.pattern || insight.description || "Your top-performing content has a distinct pattern."}"
            </p>
            {(insight.recommendation || insight.action) && (
              <p className="text-xs text-primary font-medium">
                → {insight.recommendation || insight.action}
              </p>
            )}
            <Button
              variant="link"
              className="p-0 h-auto text-primary text-xs gap-1"
              onClick={() => navigate("/insights")}
            >
              View All Insights <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">
              Run your first analysis to unlock insights
            </p>
            <Button size="sm" variant="outline" onClick={() => navigate("/insights")}>
              Go to Insights
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
