import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Clock, FileText, Sparkles, Settings, BookOpen,
  ChevronRight, CalendarCheck, AlertCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

export function PlanHealthHero() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const weekStart = startOfWeek(startOfDay(today), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(startOfDay(today), { weekStartsOn: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ["plan-health-hero", user?.id, todayStr],
    queryFn: async () => {
      if (!user?.id) return null;

      const [profileRes, planRes, scheduledRes, draftsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("threads_username, threads_user_id")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("content_plan_items")
          .select("id, scheduled_date, archetype, pillar_id, status")
          .eq("user_id", user.id)
          .gte("scheduled_date", format(weekStart, "yyyy-MM-dd"))
          .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd")),
        supabase
          .from("scheduled_posts")
          .select("id, status, scheduled_for, text_content, content_category")
          .eq("user_id", user.id)
          .gte("scheduled_for", weekStart.toISOString())
          .lte("scheduled_for", weekEnd.toISOString()),
        supabase
          .from("scheduled_posts")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "draft"),
      ]);

      const profile = profileRes.data;
      const planItems = planRes.data ?? [];
      const scheduledPosts = scheduledRes.data ?? [];
      const draftPosts = draftsRes.data ?? [];

      const threadsConnected = !!(profile?.threads_username || profile?.threads_user_id);
      const hasPlan = planItems.length > 0;

      const published = scheduledPosts.filter((p) => p.status === "published");
      const scheduled = scheduledPosts.filter((p) => p.status === "scheduled");
      const drafts = draftPosts;

      // Find next upcoming scheduled post
      const now = new Date();
      const nextPost = scheduledPosts
        .filter((p) => p.status === "scheduled" && p.scheduled_for && new Date(p.scheduled_for) > now)
        .sort((a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime())[0];

      // Find pillar for next post
      let nextPillarName: string | null = null;
      if (nextPost?.scheduled_for) {
        const nextDateStr = format(new Date(nextPost.scheduled_for), "yyyy-MM-dd");
        const matchingPlan = planItems.find((p) => p.scheduled_date === nextDateStr);
        if (matchingPlan?.pillar_id) {
          const { data: pillar } = await supabase
            .from("content_pillars")
            .select("name")
            .eq("id", matchingPlan.pillar_id)
            .maybeSingle();
          nextPillarName = pillar?.name ?? null;
        }
      }

      return {
        threadsConnected,
        hasPlan,
        published: published.length,
        scheduled: scheduled.length,
        drafts: drafts.length,
        nextPost,
        nextPillarName,
      };
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-6 animate-pulse">
        <div className="h-7 w-48 bg-muted rounded mb-4" />
        <div className="h-4 w-96 bg-muted/60 rounded" />
      </div>
    );
  }

  // State 1: No Threads connected
  if (!data?.threadsConnected) {
    return (
      <div className="relative rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Setup Required</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">Connect Threads to build your plan</h2>
            <p className="text-sm text-muted-foreground">Link your Threads account to start tracking and generating content.</p>
          </div>
          <Button
            onClick={() => navigate("/settings")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0"
          >
            <Settings className="h-4 w-4" />
            Go to Settings
          </Button>
        </div>
      </div>
    );
  }

  // State 2: No content plan
  if (!data?.hasPlan) {
    return (
      <div className="relative rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Ready to Build</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">Your strategy is ready. Generate your content plan.</h2>
            <p className="text-sm text-muted-foreground">Your pillars and archetypes are set — now generate your weekly schedule.</p>
          </div>
          <Button
            onClick={() => navigate("/playbook")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0"
          >
            <BookOpen className="h-4 w-4" />
            Go to Playbook
          </Button>
        </div>
      </div>
    );
  }

  // State 3: Plan exists
  const hasDraftsAwaitingApproval = (data?.drafts ?? 0) > 0;
  const headerText = hasDraftsAwaitingApproval ? "Your week needs attention" : "Your week is ready";
  const headerColor = hasDraftsAwaitingApproval ? "text-yellow-400" : "text-emerald-400";

  return (
    <div className="relative rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden p-6">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/8 to-transparent pointer-events-none" />
      <div className="relative space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan Health</span>
          </div>
          <h2 className={`text-2xl font-bold ${headerColor}`}>{headerText}</h2>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-foreground">{data?.published ?? 0} published</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-foreground">{data?.scheduled ?? 0} scheduled</span>
          </div>
          {(data?.drafts ?? 0) > 0 && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-400">{data?.drafts} awaiting approval</span>
            </div>
          )}
        </div>

        {/* Next post */}
        {data?.nextPost && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ChevronRight className="h-4 w-4 text-primary shrink-0" />
            <span>
              Next:{" "}
              <span className="text-foreground font-medium">
                {format(new Date(data.nextPost.scheduled_for!), "EEE h:mmaaa")}
              </span>
              {data.nextPillarName && (
                <> — <span className="text-foreground font-medium">{data.nextPillarName}</span></>
              )}
              {data.nextPost.content_category && (
                <> × <span className="text-muted-foreground">{data.nextPost.content_category}</span></>
              )}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {(data?.drafts ?? 0) > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/queue?filter=draft")}
              className="gap-1.5 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
            >
              <FileText className="h-3.5 w-3.5" />
              Review {data?.drafts} Draft{(data?.drafts ?? 0) > 1 ? "s" : ""}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => navigate("/chat?action=generate")}
            className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Posts
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/queue")}
            className="gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            View Queue
          </Button>
        </div>
      </div>
    </div>
  );
}
