import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShieldCheck, FileText, ChevronRight, Loader2,
} from "lucide-react";
import { startOfDay, format, min, max } from "date-fns";

export function WeeklyApprovalGate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState(false);

  const today = startOfDay(new Date());

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-approval-gate", user?.id, format(today, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!user?.id) return null;

      const [draftsRes, strategyRes, reportRes] = await Promise.all([
        supabase
          .from("scheduled_posts")
          .select("id, text_content, content_category, funnel_stage, scheduled_for, status")
          .eq("user_id", user.id)
          .eq("status", "draft")
          .gte("scheduled_for", today.toISOString())
          .order("scheduled_for", { ascending: true }),
        supabase
          .from("content_strategies")
          .select("strategy_data")
          .eq("user_id", user.id)
          .eq("strategy_type", "archetype_discovery")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("weekly_reports")
          .select("insights, strategy_adjustments")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        drafts: draftsRes.data ?? [],
        archetypes: ((strategyRes.data?.strategy_data as any)?.archetypes ?? []) as any[],
        latestReport: reportRes.data,
      };
    },
    enabled: !!user?.id,
  });

  if (isLoading || !data || data.drafts.length === 0) return null;

  const totalDrafts = data.drafts.length;

  // Compute funnel breakdown
  const funnelCounts: Record<string, number> = { TOF: 0, MOF: 0, BOF: 0 };
  for (const d of data.drafts) {
    const stage = d.funnel_stage || "TOF";
    if (stage in funnelCounts) funnelCounts[stage]++;
  }

  // Compute date range from actual drafts
  const draftDates = data.drafts
    .map((d) => d.scheduled_for ? new Date(d.scheduled_for) : null)
    .filter(Boolean) as Date[];
  const rangeStart = draftDates.length > 0 ? min(draftDates) : today;
  const rangeEnd = draftDates.length > 0 ? max(draftDates) : today;

  // Top archetypes sorted by avg_views
  const topArchetypes = [...data.archetypes]
    .sort((a, b) => (b.avg_views ?? 0) - (a.avg_views ?? 0))
    .slice(0, 3);

  // Strategy focus from latest report
  const focusText = (data.latestReport?.insights as any)?.focus_for_next_week ?? null;

  const handleApproveWeek = async () => {
    if (!user || !data?.drafts.length) return;
    setApproving(true);
    try {
      const draftIds = data.drafts.map((d) => d.id);
      const { error } = await supabase
        .from("scheduled_posts")
        .update({ status: "approved" })
        .in("id", draftIds);

      if (error) throw error;

      toast.success(`${draftIds.length} posts approved for next week!`);
      queryClient.invalidateQueries({ queryKey: ["weekly-approval-gate"] });
      queryClient.invalidateQueries({ queryKey: ["plan-health-hero-v2"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-pipeline"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to approve posts");
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="relative rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/8 via-card to-card overflow-hidden p-6 shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/6 to-transparent pointer-events-none" />
      <div className="relative space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Weekly Review
            </span>
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Next Week's Content is Ready
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalDrafts} draft post{totalDrafts !== 1 ? "s" : ""} for{" "}
            {format(rangeStart, "MMM d")} – {format(rangeEnd, "MMM d")}
          </p>
        </div>

        {/* Strategy Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Funnel Mix */}
          <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Funnel Mix
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(funnelCounts)
                .filter(([, count]) => count > 0)
                .map(([stage, count]) => (
                  <Badge key={stage} variant="outline" className="text-xs">
                    {stage}: {count} ({Math.round((count / totalDrafts) * 100)}%)
                  </Badge>
                ))}
            </div>
          </div>

          {/* Top Archetypes */}
          {topArchetypes.length > 0 && (
            <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Top Archetypes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topArchetypes.map((a: any) => (
                  <Badge key={a.name} variant="secondary" className="text-xs">
                    {a.emoji || ""} {a.name}
                    {a.avg_views != null && (
                      <span className="ml-1 text-muted-foreground">
                        ({Math.round(a.avg_views).toLocaleString()} avg views)
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Focus / Strategy Insight */}
        {focusText && (
          <blockquote className="border-l-4 border-emerald-500/40 pl-4 py-2 text-sm text-muted-foreground italic bg-muted/30 rounded-r-md">
            {focusText}
          </blockquote>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            onClick={handleApproveWeek}
            disabled={approving}
            className="bg-emerald-600 hover:bg-emerald-600/90 text-white gap-2 font-semibold"
          >
            {approving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {approving ? "Approving..." : `Approve & Schedule Week (${totalDrafts})`}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/queue?filter=draft")}
            className="gap-1.5"
          >
            <FileText className="h-4 w-4" />
            Review Posts
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
