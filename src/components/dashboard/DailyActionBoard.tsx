import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Circle, ListChecks, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { toast } from "sonner";

// Secondary actions per goal
const GOAL_ACTIONS: Record<string, string[]> = {
  get_comments: [
    "Check for keyword mentions",
    "Leave insight on 5 posts in your niche",
  ],
  grow_audience: [
    "Leave insight on 5 posts in your niche",
    "Share today's post in one other place",
  ],
  drive_traffic: [
    "Reply meaningfully to all comments",
    "Share today's post in one other place",
  ],
};

const GOAL_LOG_LABELS: Record<string, { label: string; field: "comments_received" | "link_clicks" | "dm_replies" }> = {
  get_comments: { label: "Comments received", field: "comments_received" },
  drive_traffic: { label: "Link clicks", field: "link_clicks" },
  grow_audience: { label: "New followers", field: "comments_received" },
};

function getFocusLine(funnelStage: string | null, goalType: string): string {
  if (funnelStage === "TOF") return "Today's focus: Reach. Make new people stop scrolling.";
  if (funnelStage === "MOF") return "Today's focus: Trust. Say something only you would say.";
  if (funnelStage === "BOF") return "Today's focus: Convert. Your audience is warm — make the ask.";
  if (goalType === "get_comments") return "Today's focus: Start conversations, not broadcasts.";
  if (goalType === "drive_traffic") return "Today's focus: Every post is a doorway.";
  return "Today's focus: Give before you ask.";
}

function getFirstAction(goalType: string, yesterdayMetrics: { views: number; replies: number; avgViews: number } | null): string {
  if (!yesterdayMetrics) {
    return "No post yesterday — consistency compounds. Today is loaded.";
  }
  const { views, replies, avgViews } = yesterdayMetrics;
  if (views > avgViews) {
    return `Yesterday's post got ${views.toLocaleString()} views and ${replies} comments — great reach! Reply to comments to boost engagement`;
  }
  if (views < avgViews && avgViews > 0) {
    return `Yesterday's post got ${views.toLocaleString()} views (below your ${avgViews.toLocaleString()} avg) — today's post should help recover momentum`;
  }
  return `Yesterday's post got ${views.toLocaleString()} views and ${replies} comments — reply to keep threads alive`;
}

export function DailyActionBoard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const storageKey = `dailyActions_${todayKey}`;

  const [logValue, setLogValue] = useState("");
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["daily-action-board", user?.id, todayKey],
    queryFn: async () => {
      if (!user?.id) return null;

      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      const yesterdayStart = startOfDay(subDays(new Date(), 1)).toISOString();
      const yesterdayEnd = endOfDay(subDays(new Date(), 1)).toISOString();

      const [profileRes, todayPostRes, todayPlanRes, yesterdayPostRes, avgViewsRes, lastPublishedRes, todayLogRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("goal_type")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("scheduled_posts")
          .select("id")
          .eq("user_id", user.id)
          .in("status", ["approved", "scheduled"])
          .gte("scheduled_for", todayStart)
          .lte("scheduled_for", todayEnd)
          .limit(1),
        supabase
          .from("content_plan_items")
          .select("funnel_stage")
          .eq("user_id", user.id)
          .eq("scheduled_date", format(new Date(), "yyyy-MM-dd"))
          .limit(1)
          .maybeSingle(),
        // Yesterday's actual post from posts_analyzed
        supabase
          .from("posts_analyzed")
          .select("views, likes, replies")
          .eq("user_id", user.id)
          .eq("source", "own")
          .gte("posted_at", yesterdayStart)
          .lt("posted_at", todayStart)
          .order("posted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Average views for comparison
        supabase
          .from("posts_analyzed")
          .select("views")
          .eq("user_id", user.id)
          .eq("source", "own")
          .order("posted_at", { ascending: false })
          .limit(30),
        // Last published post (for log results)
        supabase
          .from("scheduled_posts")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Already logged today?
        supabase
          .from("post_results")
          .select("id")
          .eq("user_id", user.id)
          .gte("logged_at", todayStart)
          .limit(1)
          .maybeSingle(),
      ]);

      const avgViewsData = avgViewsRes.data ?? [];
      const avgViews = avgViewsData.length > 0
        ? Math.round(avgViewsData.reduce((s, p) => s + (p.views ?? 0), 0) / avgViewsData.length)
        : 0;

      const yesterdayPost = yesterdayPostRes.data;
      const yesterdayMetrics = yesterdayPost
        ? { views: yesterdayPost.views ?? 0, replies: yesterdayPost.replies ?? 0, avgViews }
        : null;

      return {
        goalType: profileRes.data?.goal_type ?? "grow_audience",
        hasTodayPost: (todayPostRes.data?.length ?? 0) > 0,
        yesterdayMetrics,
        todayFunnelStage: todayPlanRes.data?.funnel_stage ?? null,
        lastPublishedPostId: lastPublishedRes.data?.id ?? null,
        alreadyLoggedToday: !!todayLogRes.data,
        hasYesterdayPost: !!yesterdayPost,
      };
    },
    enabled: !!user?.id,
  });

  // Build action list
  const goalType = data?.goalType ?? "grow_audience";
  const goalActions = GOAL_ACTIONS[goalType] ?? GOAL_ACTIONS.grow_audience;
  const actions: { id: string; label: string; link?: string }[] = [];

  if (data?.hasTodayPost) {
    actions.push({ id: "review_post", label: "Review today's post →", link: "/queue" });
  }

  const dynamicFirst = getFirstAction(goalType, data?.yesterdayMetrics ?? null);
  actions.push({ id: "dynamic_first", label: dynamicFirst });

  for (const action of goalActions) {
    if (actions.length >= 4) break;
    if (action.toLowerCase().includes("reply") && dynamicFirst.toLowerCase().includes("reply")) continue;
    actions.push({ id: action, label: action });
  }

  // Checked state from localStorage
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(checked));
  }, [checked, storageKey]);

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allDone = actions.length > 0 && actions.every((a) => checked[a.id]);
  const focusLine = getFocusLine(data?.todayFunnelStage ?? null, goalType);

  // Log results handler
  const goalConfig = GOAL_LOG_LABELS[goalType] ?? GOAL_LOG_LABELS.grow_audience;
  const handleLogSave = async () => {
    if (!user?.id || !data?.lastPublishedPostId) return;
    const num = parseInt(logValue, 10);
    if (isNaN(num) || num < 0) {
      toast.error("Enter a valid number");
      return;
    }
    setSaving(true);
    try {
      const resultData: any = {
        post_id: data.lastPublishedPostId,
        user_id: user.id,
        is_estimated: false,
      };
      resultData[goalConfig.field] = num;
      const { error } = await supabase.from("post_results").insert(resultData);
      if (error) throw error;
      toast.success("Results logged!");
      queryClient.invalidateQueries({ queryKey: ["log-result-card"] });
      queryClient.invalidateQueries({ queryKey: ["daily-action-board"] });
      setLogValue("");
    } catch {
      toast.error("Failed to save results");
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;

  const showLogInput = data.hasYesterdayPost && data.lastPublishedPostId && !data.alreadyLoggedToday;

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="h-4.5 w-4.5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Today's Actions</h3>
        </div>

        {allDone ? (
          <div className="text-center py-4 space-y-1">
            <p className="text-lg font-bold text-emerald-400">✅ Daily Engine Complete</p>
            <p className="text-sm text-muted-foreground italic">Compounding &gt; Hustling.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-3.5">
              {actions.map((action) => {
                const done = !!checked[action.id];
                return (
                  <li key={action.id} className="flex items-start gap-3">
                    <button
                      onClick={() => toggle(action.id)}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      aria-label={done ? "Uncheck action" : "Check action"}
                    >
                      {done ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                      ) : (
                        <Circle className="h-4.5 w-4.5" />
                      )}
                    </button>
                    {action.link ? (
                      <button
                        onClick={() => {
                          toggle(action.id);
                          navigate(action.link!);
                        }}
                        className={`text-sm font-medium text-left transition-colors ${
                          done
                            ? "line-through text-muted-foreground"
                            : "text-foreground hover:text-primary"
                        }`}
                      >
                        {action.label}
                      </button>
                    ) : (
                      <span
                        onClick={() => toggle(action.id)}
                        className={`text-sm font-medium cursor-pointer select-none transition-colors ${
                          done ? "line-through text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {action.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Inline Log Results */}
            {showLogInput && (
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <ClipboardList className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">{goalConfig.label}:</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={logValue}
                  onChange={(e) => setLogValue(e.target.value)}
                  className="w-20 h-7 text-xs"
                />
                <Button size="sm" onClick={handleLogSave} disabled={saving || !logValue} className="h-7 text-xs px-3">
                  {saving ? "…" : "Log"}
                </Button>
              </div>
            )}
            {data.alreadyLoggedToday && (
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">✓ Results logged for today</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground italic pt-1 border-t border-border/50">
              {focusLine}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
