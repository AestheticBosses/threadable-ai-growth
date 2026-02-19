import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Clock, FileText, Sparkles, Settings, BookOpen,
  ChevronRight, CalendarCheck, AlertCircle, Pin
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, parseISO, isAfter, addDays } from "date-fns";

const FUNNEL_META: Record<string, { label: string; color: string; dot: string; description: string }> = {
  TOF: {
    label: "TOF",
    color: "text-blue-400",
    dot: "bg-blue-400",
    description: "Reach post — viral hook, make people stop scrolling",
  },
  MOF: {
    label: "MOF",
    color: "text-purple-400",
    dot: "bg-purple-400",
    description: "Trust post — personal story, start a conversation",
  },
  BOF: {
    label: "BOF",
    color: "text-emerald-400",
    dot: "bg-emerald-400",
    description: "Conversion post — mention your offer, drive action",
  },
};

export function PlanHealthHero() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const weekStart = startOfWeek(startOfDay(today), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(startOfDay(today), { weekStartsOn: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ["plan-health-hero-v2", user?.id, todayStr],
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
          .select("id, scheduled_date, archetype, funnel_stage, pillar_id, topic_id, status")
          .eq("user_id", user.id)
          .gte("scheduled_date", format(weekStart, "yyyy-MM-dd"))
          .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd"))
          .order("scheduled_date", { ascending: true }),
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

      // Find today's plan item
      const todayPlanItem = planItems.find((p) => p.scheduled_date === todayStr) ?? null;

      // Check if today already has a post
      const todayPost = scheduledPosts.find((sp) => {
        const postDate = sp.scheduled_for ? format(new Date(sp.scheduled_for), "yyyy-MM-dd") : null;
        return postDate === todayStr;
      }) ?? null;

      const todayDone = todayPost !== null && (todayPost.status === "published" || todayPost.status === "scheduled" || todayPost.status === "draft");

      // If today is done, find next unposted day
      let nextUnpostedItem: typeof planItems[0] | null = null;
      if (todayDone) {
        for (const item of planItems) {
          if (!item.scheduled_date || item.scheduled_date <= todayStr) continue;
          const existingPost = scheduledPosts.find((sp) => {
            const pd = sp.scheduled_for ? format(new Date(sp.scheduled_for), "yyyy-MM-dd") : null;
            return pd === item.scheduled_date;
          });
          if (!existingPost) {
            nextUnpostedItem = item;
            break;
          }
        }
      }

      // Resolve pillar + topic names
      const allPillarIds = [...new Set([
        todayPlanItem?.pillar_id,
        nextUnpostedItem?.pillar_id,
      ].filter(Boolean))];
      const allTopicIds = [...new Set([
        todayPlanItem?.topic_id,
        nextUnpostedItem?.topic_id,
      ].filter(Boolean))];

      const [pillarsRes, topicsRes] = await Promise.all([
        allPillarIds.length > 0
          ? supabase.from("content_pillars").select("id, name").in("id", allPillarIds as string[])
          : Promise.resolve({ data: [] }),
        allTopicIds.length > 0
          ? supabase.from("connected_topics").select("id, name").in("id", allTopicIds as string[])
          : Promise.resolve({ data: [] }),
      ]);

      const pillars: { id: string; name: string }[] = pillarsRes.data ?? [];
      const topics: { id: string; name: string }[] = topicsRes.data ?? [];

      const resolvePillar = (id?: string | null) => pillars.find((p) => p.id === id)?.name ?? null;
      const resolveTopic = (id?: string | null) => topics.find((t) => t.id === id)?.name ?? null;

      return {
        threadsConnected,
        hasPlan,
        published: published.length,
        scheduled: scheduled.length,
        drafts: draftPosts.length,
        todayPlanItem,
        todayPost,
        todayDone,
        nextUnpostedItem,
        todayPillar: resolvePillar(todayPlanItem?.pillar_id),
        todayTopic: resolveTopic(todayPlanItem?.topic_id),
        nextPillar: resolvePillar(nextUnpostedItem?.pillar_id),
        nextTopic: resolveTopic(nextUnpostedItem?.topic_id),
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
          <Button onClick={() => navigate("/settings")} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0">
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
            <h2 className="text-2xl font-bold text-foreground mb-1">No content plan yet.</h2>
            <p className="text-sm text-muted-foreground">Your pillars and archetypes are set — now generate your weekly schedule.</p>
          </div>
          <Button onClick={() => navigate("/playbook")} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0">
            <BookOpen className="h-4 w-4" />
            Generate Your Plan →
          </Button>
        </div>
      </div>
    );
  }

  const { todayPlanItem, todayPost, todayDone, nextUnpostedItem, todayPillar, todayTopic, nextPillar, nextTopic } = data;

  // Determine what to feature
  const featuredItem = todayDone ? nextUnpostedItem : todayPlanItem;
  const featuredPillar = todayDone ? nextPillar : todayPillar;
  const featuredTopic = todayDone ? nextTopic : todayTopic;
  const isNextDay = todayDone && !!nextUnpostedItem;
  const funnel = featuredItem?.funnel_stage ? FUNNEL_META[featuredItem.funnel_stage] ?? null : null;

  const handleGenerate = () => {
    const params = new URLSearchParams();
    if (featuredItem?.archetype) params.set("archetype", featuredItem.archetype);
    if (featuredPillar) params.set("pillar", featuredPillar);
    if (featuredTopic) params.set("topic", featuredTopic);
    params.set("action", "template");
    navigate(`/chat?${params.toString()}`);
  };

  return (
    <div className="relative rounded-xl border border-primary/30 bg-gradient-to-br from-primary/8 via-card to-card overflow-hidden p-6 shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/6 to-transparent pointer-events-none" />
      <div className="relative space-y-5">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan Health</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-semibold text-foreground">{data.published}</span> published
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-400" />
                <span className="font-semibold text-foreground">{data.scheduled}</span> scheduled
              </span>
              {data.drafts > 0 && (
                <button
                  onClick={() => navigate("/queue?filter=draft")}
                  className="flex items-center gap-1.5 text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="font-semibold">{data.drafts}</span> awaiting approval
                </button>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/queue")}
            className="gap-1.5 shrink-0 text-xs"
          >
            <Clock className="h-3.5 w-3.5" />
            View Queue
          </Button>
        </div>

        {/* ── TODAY'S POST HERO ── */}
        {todayDone && todayPost ? (
          // Today is done — show completion state + next unposted
          <div className="space-y-3">
            {/* Done banner */}
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-400">Today's post is ready</p>
                {todayPost.text_content && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{todayPost.text_content.slice(0, 80)}…</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(todayPost.status === "draft" ? "/queue?filter=draft" : "/queue")}
                className="text-xs text-emerald-400 hover:text-emerald-300 shrink-0 gap-1"
              >
                {todayPost.status === "draft" ? "View Draft" : "View in Queue"}
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

            {/* Next unposted */}
            {nextUnpostedItem && (
              <TodayPostCard
                planItem={nextUnpostedItem}
                pillarName={nextPillar}
                topicName={nextTopic}
                label="Next Post"
                onGenerate={handleGenerate}
              />
            )}
          </div>
        ) : featuredItem ? (
          // Today's assignment
          <TodayPostCard
            planItem={featuredItem}
            pillarName={featuredPillar}
            topicName={featuredTopic}
            label="Today's Post"
            onGenerate={handleGenerate}
          />
        ) : (
          // Plan exists but nothing for today
          <div className="rounded-lg border border-border bg-muted/10 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">No post planned for today.</p>
            <Button size="sm" onClick={() => navigate("/playbook")} variant="outline" className="text-xs gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              View Playbook
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TodayPostCard({
  planItem,
  pillarName,
  topicName,
  label,
  onGenerate,
}: {
  planItem: { archetype?: string | null; funnel_stage?: string | null; scheduled_date?: string | null };
  pillarName?: string | null;
  topicName?: string | null;
  label: string;
  onGenerate: () => void;
}) {
  const funnel = planItem.funnel_stage ? FUNNEL_META[planItem.funnel_stage] ?? null : null;

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-5 space-y-4 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.2)]">
      {/* Label */}
      <div className="flex items-center gap-2">
        <Pin className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">{label}</span>
        {planItem.scheduled_date && (
          <span className="text-xs text-muted-foreground ml-auto">
            {format(parseISO(planItem.scheduled_date), "EEEE, MMM d")}
          </span>
        )}
      </div>

      {/* Pillar × Archetype */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {pillarName && (
            <span className="text-base font-bold text-foreground">{pillarName}</span>
          )}
          {pillarName && planItem.archetype && (
            <span className="text-muted-foreground font-light">×</span>
          )}
          {planItem.archetype && (
            <span className="text-base font-bold text-foreground">{planItem.archetype}</span>
          )}
        </div>
        {topicName && (
          <p className="text-sm text-muted-foreground italic">"{topicName}"</p>
        )}
      </div>

      {/* Funnel stage pill */}
      {funnel && (
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${funnel.dot}`} />
          <span className={`text-xs font-semibold ${funnel.color}`}>{funnel.label}</span>
          <span className="text-xs text-muted-foreground">— {funnel.description}</span>
        </div>
      )}

      {/* CTA */}
      <Button
        onClick={onGenerate}
        className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
      >
        <Sparkles className="h-4 w-4" />
        Generate {label} →
      </Button>
    </div>
  );
}
