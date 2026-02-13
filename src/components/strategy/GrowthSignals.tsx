import { useMemo } from "react";
import { usePostsAnalyzed, type AnalyzedPost } from "@/hooks/usePostsAnalyzed";
import { getMockThreads } from "@/lib/mockAnalysisData";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PostingHeatmap } from "@/components/insights/PostingHeatmap";
import { ShareGrowthCard } from "@/components/insights/ShareGrowthCard";

function BarChart({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max((value / max) * 100, 2);
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-foreground w-14 text-right">{value.toFixed(2)}%</span>
    </div>
  );
}

interface PostRow {
  id: string | number;
  title: string;
  fullText: string;
  views: number;
  likes: number;
  reposts: number;
  replies: number;
  engRate: number;
}

function mapRealPosts(posts: AnalyzedPost[]): PostRow[] {
  return posts.map((p) => {
    const views = p.views ?? 0;
    const likes = p.likes ?? 0;
    const reposts = p.reposts ?? 0;
    const replies = p.replies ?? 0;
    const engRate = views > 0 ? ((likes + replies + reposts) / views) * 100 : 0;
    return {
      id: p.id,
      title: (p.text_content ?? "").slice(0, 60) || "(no text)",
      fullText: p.text_content ?? "(no text)",
      views,
      likes,
      reposts,
      replies,
      engRate,
    };
  });
}

function mapMockPosts(): PostRow[] {
  return getMockThreads().map((t) => ({
    id: t.id,
    title: t.title,
    fullText: t.title,
    views: t.views,
    likes: t.likes,
    reposts: t.reposts,
    replies: t.comments,
    engRate: t.engRate,
  }));
}

function PostLabel({ title, fullText }: { title: string; fullText: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-xs text-muted-foreground w-48 truncate shrink-0 cursor-default">
          {title}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap text-xs">
        {fullText.length > 500 ? fullText.slice(0, 500) + "…" : fullText}
      </TooltipContent>
    </Tooltip>
  );
}

export function GrowthSignals() {
  const { data: rawPosts, isLoading } = usePostsAnalyzed();
  const useReal = (rawPosts?.length ?? 0) > 0;

  const rows = useMemo(() => useReal ? mapRealPosts(rawPosts!) : mapMockPosts(), [rawPosts, useReal]);

  // Filter out posts with < 50 views for rankings
  const qualifiedRows = useMemo(() => rows.filter((r) => r.views >= 50), [rows]);

  const topEngRate = useMemo(() => {
    return [...qualifiedRows].sort((a, b) => b.engRate - a.engRate).slice(0, 10);
  }, [qualifiedRows]);

  const topViralCoeff = useMemo(() => {
    return qualifiedRows
      .map((t) => ({ ...t, viralCoeff: t.views > 0 ? ((t.reposts + (t.replies * 0.3)) / t.views) * 100 : 0 }))
      .sort((a, b) => b.viralCoeff - a.viralCoeff)
      .slice(0, 10);
  }, [qualifiedRows]);

  const maxEngRate = topEngRate[0]?.engRate ?? 1;
  const maxViralCoeff = topViralCoeff[0]?.viralCoeff ?? 1;

  // Trend: average engagement rate
  const avgEngRate = useMemo(() => {
    if (qualifiedRows.length === 0) return 0;
    return qualifiedRows.reduce((s, r) => s + r.engRate, 0) / qualifiedRows.length;
  }, [qualifiedRows]);

  const avgViralCoeff = useMemo(() => {
    const coeffRows = qualifiedRows.map((t) => t.views > 0 ? ((t.reposts + (t.replies * 0.3)) / t.views) * 100 : 0);
    if (coeffRows.length === 0) return 0;
    return coeffRows.reduce((s, v) => s + v, 0) / coeffRows.length;
  }, [qualifiedRows]);

  if (isLoading) return <Skeleton className="h-64 rounded-lg" />;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-8">
        {/* Heatmap */}
        <PostingHeatmap />

        <div>
          <h3 className="text-lg font-semibold text-foreground">Top Performer Rankings</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {useReal
              ? `Computed from ${rows.length} real posts (min 50 views for rankings).`
              : "Showing mock data. Fetch your real posts to see actual rankings."}
          </p>
        </div>

        {/* Engagement Rate — Top 10 */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h4 className="text-sm font-bold text-violet-400">Engagement Rate — Top 10</h4>
            {avgEngRate > 0 && (
              <span className="text-xs text-muted-foreground font-mono">Avg: {avgEngRate.toFixed(2)}%</span>
            )}
          </div>
          {topEngRate.length === 0 ? (
            <p className="text-xs text-muted-foreground">No posts with 50+ views found.</p>
          ) : (
            <div className="space-y-2">
              {topEngRate.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                  <PostLabel title={t.title} fullText={t.fullText} />
                  <BarChart value={t.engRate} max={maxEngRate} color="bg-violet-500" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Viral Coefficient */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h4 className="text-sm font-bold text-emerald-400">Viral Coefficient (Reposts+Replies ÷ Views) — Top 10</h4>
            {avgViralCoeff > 0 && (
              <span className="text-xs text-muted-foreground font-mono">Avg: {avgViralCoeff.toFixed(2)}%</span>
            )}
          </div>
          {topViralCoeff.length === 0 ? (
            <p className="text-xs text-muted-foreground">No posts with 50+ views found.</p>
          ) : (
            <div className="space-y-2">
              {topViralCoeff.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                  <PostLabel title={t.title} fullText={t.fullText} />
                  <BarChart value={t.viralCoeff} max={maxViralCoeff} color="bg-emerald-500" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shareable Growth Card */}
        <ShareGrowthCard />
      </div>
    </TooltipProvider>
  );
}
