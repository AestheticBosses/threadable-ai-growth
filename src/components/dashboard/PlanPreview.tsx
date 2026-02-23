import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

// ── Funnel stage colors (per spec) ──────────────────────────────────────────
const FUNNEL_COLORS: Record<string, { bg: string; text: string; hex: string; label: string }> = {
  TOF: { bg: "bg-[#7C3AED]/15", text: "text-[#7C3AED]", hex: "#7C3AED", label: "TOF" },
  MOF: { bg: "bg-[#3B82F6]/15", text: "text-[#3B82F6]", hex: "#3B82F6", label: "MOF" },
  BOF: { bg: "bg-[#10B981]/15", text: "text-[#10B981]", hex: "#10B981", label: "BOF" },
};

// ── Static fallback insights by goal type ───────────────────────────────────
const FALLBACK_INSIGHTS: Record<string, string[]> = {
  get_comments: [
    "BOF posts with a comment keyword get 3x more replies on average",
    "Posts that open with a personal story drive the most conversations",
    "Posting between 10 AM–12 PM tends to generate the highest reply rates",
  ],
  grow_audience: [
    "TOF posts with contrarian hooks get the most shares and new followers",
    "Consistent daily posting builds momentum — your reach compounds over time",
    "Short, punchy posts under 280 characters tend to get the most reposts",
  ],
  drive_traffic: [
    "MOF posts that build trust make your BOF link posts convert better",
    "Mentioning your link naturally in a story gets more clicks than a hard CTA",
    "Posts published in the evening see higher click-through rates on average",
  ],
};

const DEFAULT_INSIGHTS = [
  "Your first week of posts is ready — review and approve to get started",
  "Each post is mapped to a funnel stage to balance reach, trust, and conversions",
  "Consistent posting in week one sets the algorithm in your favor",
];

// ── Types ───────────────────────────────────────────────────────────────────
interface DraftPost {
  id: string;
  text_content: string | null;
  content_category: string | null;
  funnel_stage: string | null;
  scheduled_for: string | null;
}

interface Insight {
  text: string;
}

// ── Post Row ────────────────────────────────────────────────────────────────
function PostRow({ post }: { post: DraftPost }) {
  const [expanded, setExpanded] = useState(false);

  const scheduledDate = post.scheduled_for ? new Date(post.scheduled_for) : null;
  const dayLabel = scheduledDate ? format(scheduledDate, "EEE") : "—";
  const timeLabel = scheduledDate ? format(scheduledDate, "h:mm a") : "";
  const funnel = post.funnel_stage ? FUNNEL_COLORS[post.funnel_stage] ?? null : null;
  const archetype = post.content_category || "General";

  return (
    <div className="rounded-lg border border-border bg-card/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/20 transition-colors"
      >
        {/* Day + Time */}
        <div className="shrink-0 w-16">
          <p className="text-sm font-bold text-foreground">{dayLabel}</p>
          <p className="text-[11px] text-muted-foreground">{timeLabel}</p>
        </div>

        {/* Funnel pill */}
        {funnel && (
          <span
            className={`shrink-0 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${funnel.bg} ${funnel.text}`}
            style={{ borderColor: funnel.hex, borderWidth: 1 }}
          >
            {funnel.label}
          </span>
        )}

        {/* Archetype */}
        <span className="text-sm text-muted-foreground truncate flex-1">
          {archetype}
        </span>

        {/* Expand chevron */}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expandable body */}
      {expanded && post.text_content && (
        <div className="px-4 pb-3 pt-1 border-t border-border/50">
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {post.text_content}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Insights Card ───────────────────────────────────────────────────────────
function InsightsCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        Key Insights
      </h3>
      <div className="space-y-1.5">
        {insights.map((insight, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5"
          >
            <Zap className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/80">{insight.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export function PlanPreview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // ── Query: draft posts ──────────────────────────────────────────────────
  const draftsQuery = useQuery({
    queryKey: ["plan-preview-drafts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("id, text_content, content_category, funnel_stage, scheduled_for")
        .eq("user_id", user.id)
        .eq("status", "draft")
        .order("scheduled_for", { ascending: true })
        .limit(7);

      if (error) {
        console.error("Failed to fetch draft posts:", error);
        return [];
      }
      return (data ?? []) as DraftPost[];
    },
    enabled: !!user?.id,
  });

  // ── Query: insights ─────────────────────────────────────────────────────
  const insightsQuery = useQuery({
    queryKey: ["plan-preview-insights", user?.id],
    queryFn: async () => {
      if (!user?.id) return { insights: [] as Insight[], goalType: null as string | null };

      const [regressionRes, profileRes] = await Promise.all([
        supabase
          .from("content_strategies")
          .select("regression_insights")
          .eq("user_id", user.id)
          .not("regression_insights", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("goal_type")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      const regressionData = regressionRes.data?.regression_insights as any;
      const goalType = (profileRes.data?.goal_type as string) || null;

      if (regressionData?.human_readable_insights && Array.isArray(regressionData.human_readable_insights)) {
        const insights: Insight[] = regressionData.human_readable_insights
          .slice(0, 3)
          .map((text: string) => ({ text }));
        return { insights, goalType };
      }

      // Fallback based on goal_type
      const fallbackTexts = goalType && FALLBACK_INSIGHTS[goalType]
        ? FALLBACK_INSIGHTS[goalType]
        : DEFAULT_INSIGHTS;

      return {
        insights: fallbackTexts.map((text) => ({ text })),
        goalType,
      };
    },
    enabled: !!user?.id,
  });

  const drafts = draftsQuery.data ?? [];
  const insights = insightsQuery.data?.insights ?? [];

  // ── Approve handler ─────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!user?.id) return;
    setApproving(true);
    setApproveError(null);

    try {
      const { error } = await supabase
        .from("scheduled_posts")
        .update({ status: "approved" })
        .eq("user_id", user.id)
        .eq("status", "draft");

      if (error) {
        console.error("Approve error:", error);
        setApproveError("Failed to approve posts. Please try again.");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["plan-preview-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["plan-health-hero-v2"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-pipeline"] });
      navigate("/dashboard");
    } catch (e: any) {
      console.error("Approve exception:", e);
      setApproveError(e.message || "Something went wrong. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────
  if (draftsQuery.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-6 animate-pulse space-y-4">
        <div className="h-6 w-48 bg-muted rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-muted/60 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  if (drafts.length === 0) return null;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Your Week at a Glance</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {drafts.length} draft{drafts.length !== 1 ? "s" : ""} ready for review. Tap a post to preview it.
        </p>
      </div>

      {/* Week calendar list */}
      <div className="space-y-2">
        {drafts.map((post) => (
          <PostRow key={post.id} post={post} />
        ))}
      </div>

      {/* Insights */}
      <InsightsCard insights={insights} />

      {/* Approve button */}
      <div className="space-y-2">
        <Button
          onClick={handleApprove}
          disabled={approving}
          className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          {approving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Approving...
            </>
          ) : (
            <>
              <CalendarCheck className="h-5 w-5" />
              Approve & Schedule This Week →
            </>
          )}
        </Button>
        {approveError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{approveError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
