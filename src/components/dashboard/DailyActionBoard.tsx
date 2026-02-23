import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay } from "date-fns";

const GOAL_ACTIONS: Record<string, string[]> = {
  get_comments: [
    "Reply meaningfully to all comments",
    "Check for keyword mentions",
    "Leave insight on 5 posts in your niche",
  ],
  grow_audience: [
    "Reply meaningfully to all comments",
    "Leave insight on 5 posts in your niche",
    "Share today's post in one other place",
  ],
  drive_traffic: [
    "Check link clicks from yesterday",
    "Reply meaningfully to all comments",
    "Share today's post in one other place",
  ],
};

const GOAL_FOCUS: Record<string, string> = {
  get_comments: "Today's focus: Start conversations, not broadcasts.",
  grow_audience: "Today's focus: Give before you ask.",
  drive_traffic: "Today's focus: Every post is a doorway.",
};

export function DailyActionBoard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const storageKey = `dailyActions_${todayKey}`;

  const { data } = useQuery({
    queryKey: ["daily-action-board", user?.id, todayKey],
    queryFn: async () => {
      if (!user?.id) return null;

      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const [profileRes, todayPostRes] = await Promise.all([
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
      ]);

      return {
        goalType: profileRes.data?.goal_type ?? "grow_audience",
        hasTodayPost: (todayPostRes.data?.length ?? 0) > 0,
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

  for (const action of goalActions) {
    if (actions.length >= 4) break;
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
  const focusLine = GOAL_FOCUS[goalType] ?? GOAL_FOCUS.grow_audience;

  if (!data) return null;

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
            <p className="text-xs text-muted-foreground italic pt-1 border-t border-border/50">
              {focusLine}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
