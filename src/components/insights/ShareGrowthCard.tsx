import { useRef } from "react";
import { usePostsAnalyzed } from "@/hooks/usePostsAnalyzed";
import { useAuth } from "@/contexts/AuthContext";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareGrowthCard() {
  const { data: posts } = usePostsAnalyzed();
  const { user } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);

  if (!posts || posts.length === 0) return null;

  const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);
  const topEngagement = Math.max(...posts.map((p) => ((p.likes ?? 0) + (p.replies ?? 0) + (p.reposts ?? 0)) / Math.max(p.views ?? 1, 1) * 100));
  const bestPost = posts.reduce((best, p) => ((p.views ?? 0) > (best.views ?? 0) ? p : best), posts[0]);

  // Find top archetype
  const archetypeCounts: Record<string, number> = {};
  for (const p of posts) {
    const a = (p as any).archetype || "Unknown";
    archetypeCounts[a] = (archetypeCounts[a] || 0) + 1;
  }
  const topArchetype = Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground">📤 Share Your Growth</h4>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => {
            // Simple approach: prompt user to screenshot
            const el = cardRef.current;
            if (el) {
              el.scrollIntoView({ behavior: "smooth" });
            }
          }}
        >
          <Download className="h-3 w-3" />
          Screenshot to share
        </Button>
      </div>

      <div
        ref={cardRef}
        className="rounded-xl p-6 text-center space-y-4"
        style={{
          background: "linear-gradient(135deg, hsl(270, 70%, 35%), hsl(280, 60%, 20%))",
          color: "white",
        }}
      >
        <div>
          <p className="text-lg font-bold tracking-tight">Threadable.ai</p>
          <p className="text-xs opacity-80">Growth Report · {monthLabel}</p>
        </div>

        <div className="space-y-1">
          <p className="text-2xl font-bold">{totalViews.toLocaleString()} views</p>
          <p className="text-sm opacity-90">{posts.length} posts · Top engagement: {topEngagement.toFixed(1)}%</p>
          <p className="text-xs opacity-75">Best archetype: {topArchetype}</p>
        </div>

        <div className="text-xs opacity-80 border-t border-white/20 pt-3">
          <p className="italic">
            #1 Post: "{(bestPost.text_content ?? "").slice(0, 60)}..."
          </p>
          <p className="mt-1">{(bestPost.views ?? 0).toLocaleString()} views</p>
        </div>

        <p className="text-[10px] opacity-50">threadable.ai</p>
      </div>
    </div>
  );
}
