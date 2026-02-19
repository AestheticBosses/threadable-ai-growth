import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle2, CalendarDays, Layers, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay } from "date-fns";

const ARCHETYPE_COLORS: Record<string, string> = {
  "Vault Drop": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Truth Bomb": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Hot Take": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Window": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export function TodayPlanCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["today-plan-card", user?.id, todayStr],
    queryFn: async () => {
      if (!user?.id) return null;
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();

      const [planRes, publishedRes] = await Promise.all([
        supabase
          .from("content_plan_items")
          .select(`
            id, archetype, funnel_stage, status,
            pillar_id, topic_id, post_id, scheduled_date
          `)
          .eq("user_id", user.id)
          .eq("scheduled_date", todayStr)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("scheduled_posts")
          .select("id, text_content, threads_media_id")
          .eq("user_id", user.id)
          .eq("status", "published")
          .gte("published_at", todayStart)
          .lte("published_at", todayEnd)
          .limit(1)
          .maybeSingle(),
      ]);

      // Fetch pillar name if plan exists
      let pillarName: string | null = null;
      if (planRes.data?.pillar_id) {
        const { data: pillar } = await supabase
          .from("content_pillars")
          .select("name")
          .eq("id", planRes.data.pillar_id)
          .maybeSingle();
        pillarName = pillar?.name ?? null;
      }

      // Fetch topic name if plan exists
      let topicName: string | null = null;
      if (planRes.data?.topic_id) {
        const { data: topic } = await supabase
          .from("connected_topics")
          .select("name")
          .eq("id", planRes.data.topic_id)
          .maybeSingle();
        topicName = topic?.name ?? null;
      }

      return {
        plan: planRes.data,
        pillarName,
        topicName,
        publishedToday: publishedRes.data,
      };
    },
    enabled: !!user?.id,
  });

  const handleGeneratePost = () => {
    const params = new URLSearchParams();
    if (data?.plan?.archetype) params.set("archetype", data.plan.archetype);
    if (data?.pillarName) params.set("pillar", data.pillarName);
    if (data?.topicName) params.set("topic", data.topicName);
    params.set("action", "generate");
    navigate(`/chat?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6">
          <div className="h-24 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // State: published today
  if (data?.publishedToday) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground mb-1">Today's post is live! ✅</h2>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {data.publishedToday.text_content?.slice(0, 120)}…
              </p>
              <Button variant="outline" size="sm" className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                View on Threads <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // State: has a plan for today
  if (data?.plan) {
    const archetypeClass = ARCHETYPE_COLORS[data.plan.archetype ?? ""] ?? "bg-muted text-muted-foreground border-border";
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium mb-1">Today's Planned Post</p>
              <h2 className="text-xl font-bold text-foreground mb-2">
                {data.pillarName ?? "Today's Post"}
              </h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {data.plan.archetype && (
                  <Badge variant="outline" className={`text-xs ${archetypeClass}`}>
                    {data.plan.archetype}
                  </Badge>
                )}
                {data.plan.funnel_stage && (
                  <Badge variant="outline" className="text-xs">
                    {data.plan.funnel_stage.toUpperCase()}
                  </Badge>
                )}
                {data.topicName && (
                  <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                    {data.topicName}
                  </Badge>
                )}
              </div>
              <Button
                onClick={handleGeneratePost}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate Today's Post
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // State: no plan
  return (
    <Card className="border-border bg-card/50">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground mb-1">No plan for today</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Set up your content plan to get personalized daily post suggestions.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate("/playbook")}
              >
                <Layers className="h-3.5 w-3.5" />
                Set up Content Plan
              </Button>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                onClick={() => navigate("/chat")}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate Anyway
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
