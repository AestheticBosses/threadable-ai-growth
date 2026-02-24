import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay } from "date-fns";

const GOAL_LABELS: Record<string, { label: string; field: "comments_received" | "link_clicks" | "dm_replies" }> = {
  get_comments: { label: "Keyword comments received on yesterday's post", field: "comments_received" },
  drive_traffic: { label: "Link clicks from yesterday's post", field: "link_clicks" },
  grow_audience: { label: "New followers gained yesterday", field: "comments_received" },
};

export function LogResultCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["log-result-card", user?.id, todayStr],
    queryFn: async () => {
      if (!user?.id) return null;

      const [profileRes, lastPublishedRes, todayLogRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("goal_type")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("scheduled_posts")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("post_results")
          .select("id, logged_at")
          .eq("user_id", user.id)
          .gte("logged_at", startOfDay(new Date()).toISOString())
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        goalType: profileRes.data?.goal_type ?? "grow_audience",
        lastPublishedPostId: lastPublishedRes.data?.id ?? null,
        alreadyLoggedToday: !!todayLogRes.data,
      };
    },
    enabled: !!user?.id,
  });

  if (isLoading || !data) return null;

  const goalConfig = GOAL_LABELS[data.goalType] ?? GOAL_LABELS.grow_audience;

  // No published posts yet
  if (!data.lastPublishedPostId) {
    return (
      <Card className="border-border">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Log Results</h3>
          </div>
          <p className="text-xs text-muted-foreground">No published posts yet — log results after your first post goes live.</p>
        </CardContent>
      </Card>
    );
  }

  // Already logged today
  if (data.alreadyLoggedToday) {
    return (
      <Card className="border-border">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Log Results</h3>
            <span className="text-xs text-emerald-400 font-medium ml-auto">✓ Logged for today</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    if (!user?.id || !data.lastPublishedPostId) return;
    const num = parseInt(value, 10);
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
      setValue("");
    } catch {
      toast.error("Failed to save results");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Log Results</h3>
        </div>
        <p className="text-xs text-muted-foreground">{goalConfig.label}</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-24 h-8 text-sm"
          />
          <Button size="sm" onClick={handleSave} disabled={saving || !value} className="h-8 text-xs">
            {saving ? "Saving…" : "Log"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
