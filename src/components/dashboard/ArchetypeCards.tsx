import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";
import type { DiscoveredArchetype } from "@/hooks/useStrategyData";
import type { PlaybookData } from "@/hooks/useStrategyData";
import type { AnalyzedPost } from "@/hooks/usePostsAnalyzed";

const BORDER_COLORS = [
  "border-violet-500/50",
  "border-emerald-500/50",
  "border-yellow-500/50",
  "border-blue-500/50",
  "border-rose-500/50",
];
const LABEL_COLORS = [
  "text-violet-400",
  "text-emerald-400",
  "text-yellow-400",
  "text-blue-400",
  "text-rose-400",
];

interface MatchedPost {
  text: string;
  views: number;
  likes: number;
  reposts: number;
  engRate: number;
}

interface ArchetypeWithStats {
  archetype: DiscoveredArchetype;
  index: number;
  matchedPosts: MatchedPost[];
  postCount: number;
  avgViews: number;
  avgEng: number;
  bestPost: string | null;
}

function classifyPostToArchetype(
  post: AnalyzedPost,
  archetypes: DiscoveredArchetype[]
): number {
  const text = (post.text_content ?? "").toLowerCase();
  let bestIdx = 0;
  let bestScore = 0;

  archetypes.forEach((arch, idx) => {
    let score = 0;
    // Match against key_ingredients
    arch.key_ingredients.forEach((ing) => {
      const words = ing.toLowerCase().split(/\s+/);
      words.forEach((w) => {
        if (w.length > 3 && text.includes(w)) score += 2;
      });
    });
    // Match against description keywords
    const descWords = arch.description.toLowerCase().split(/\s+/);
    descWords.forEach((w) => {
      if (w.length > 4 && text.includes(w)) score += 1;
    });
    // Match archetype name
    const nameWords = arch.name.toLowerCase().split(/\s+/);
    nameWords.forEach((w) => {
      if (w.length > 3 && text.includes(w)) score += 3;
    });

    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  return bestIdx;
}

function buildArchetypeStats(
  archetypes: DiscoveredArchetype[],
  posts: AnalyzedPost[]
): ArchetypeWithStats[] {
  const buckets: MatchedPost[][] = archetypes.map(() => []);

  posts.forEach((p) => {
    const idx = classifyPostToArchetype(p, archetypes);
    buckets[idx].push({
      text: p.text_content ?? "",
      views: p.views ?? 0,
      likes: p.likes ?? 0,
      reposts: p.reposts ?? 0,
      engRate: p.engagement_rate ?? 0,
    });
  });

  return archetypes.map((arch, i) => {
    const matched = buckets[i];
    const n = matched.length;
    const totalViews = matched.reduce((s, p) => s + p.views, 0);
    const totalEng = matched.reduce((s, p) => s + p.engRate, 0);
    const sorted = [...matched].sort((a, b) => b.views - a.views);
    return {
      archetype: arch,
      index: i,
      matchedPosts: sorted,
      postCount: n,
      avgViews: n > 0 ? Math.round(totalViews / n) : 0,
      avgEng: n > 0 ? Number((totalEng / n).toFixed(2)) : 0,
      bestPost: sorted[0]?.text?.slice(0, 50) || null,
    };
  });
}

interface ArchetypeCardsProps {
  archetypes: DiscoveredArchetype[];
  posts: AnalyzedPost[];
  playbook: PlaybookData | null | undefined;
}

export function ArchetypeCards({ archetypes, posts, playbook }: ArchetypeCardsProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const stats = useMemo(
    () => buildArchetypeStats(archetypes, posts),
    [archetypes, posts]
  );

  const selected = selectedIdx !== null ? stats[selectedIdx] : null;
  const selectedTemplate = selected
    ? playbook?.templates?.find(
        (t) => t.archetype.toLowerCase() === selected.archetype.name.toLowerCase()
      )
    : null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map((s) => {
          const ci = s.index % BORDER_COLORS.length;
          return (
            <button
              key={s.archetype.name}
              onClick={() => setSelectedIdx(s.index)}
              className={`text-left border-2 ${BORDER_COLORS[ci]} rounded-xl bg-card/50 p-4 hover:bg-card/80 transition-colors cursor-pointer`}
            >
              {/* Top row */}
              <div className="flex items-center justify-between mb-1.5">
                <h4 className={`text-sm font-bold ${LABEL_COLORS[ci]}`}>
                  {s.archetype.emoji} {s.archetype.name}
                </h4>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {s.archetype.recommended_percentage}%
                </Badge>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-2.5 line-clamp-1">
                {s.archetype.description}
              </p>

              {/* Stats row */}
              <div className="flex gap-3 text-xs mb-2.5">
                <div>
                  <span className="text-muted-foreground">Posts: </span>
                  <span className="font-bold text-foreground font-mono">{s.postCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Views: </span>
                  <span className="font-bold text-foreground font-mono">{s.avgViews.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Eng: </span>
                  <span className="font-bold text-emerald-400 font-mono">{s.avgEng}%</span>
                </div>
              </div>

              {/* Key ingredients */}
              <div className="flex flex-wrap gap-1 mb-2">
                {s.archetype.key_ingredients.slice(0, 4).map((ing) => (
                  <span key={ing} className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    {ing}
                  </span>
                ))}
              </div>

              {/* Best post footer */}
              {s.bestPost && (
                <p className="text-[11px] text-muted-foreground/70 italic truncate">
                  Best: "{s.bestPost}…"
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail Modal */}
      <Dialog open={selectedIdx !== null} onOpenChange={() => setSelectedIdx(null)}>
        {selected && (
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className={`text-lg ${LABEL_COLORS[selected.index % LABEL_COLORS.length]}`}>
                {selected.archetype.emoji} {selected.archetype.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* Full description */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selected.archetype.description}
              </p>

              {/* Stats summary */}
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Posts: </span>
                  <span className="font-bold text-foreground font-mono">{selected.postCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Views: </span>
                  <span className="font-bold text-foreground font-mono">{selected.avgViews.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Eng: </span>
                  <span className="font-bold text-emerald-400 font-mono">{selected.avgEng}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Drives: </span>
                  <span className="font-semibold text-foreground">{selected.archetype.drives}</span>
                </div>
              </div>

              {/* Template */}
              {selectedTemplate && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Template</h5>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedTemplate.template}</p>
                  {selectedTemplate.example && (
                    <p className="text-xs text-muted-foreground mt-2 italic">Example: "{selectedTemplate.example}"</p>
                  )}
                </div>
              )}

              {/* Matching posts */}
              {selected.matchedPosts.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Matching Posts ({selected.matchedPosts.length})
                  </h5>
                  <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                    {selected.matchedPosts.map((mp, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs"
                      >
                        <p className="flex-1 text-foreground line-clamp-2">{mp.text}</p>
                        <div className="flex gap-2 shrink-0 text-muted-foreground font-mono">
                          <span>{mp.views.toLocaleString()} v</span>
                          <span>{mp.likes} ♥</span>
                          <span>{mp.reposts} ↻</span>
                          <span className="text-emerald-400">{mp.engRate}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate button (disabled) */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button disabled className="w-full" variant="outline">
                      <Sparkles className="h-4 w-4 mr-1.5" />
                      Generate 5 posts like this
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Coming soon</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
