import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface Post {
  text_content: string | null;
  views: number | null;
  engagement_rate: number | null;
  posted_at: string | null;
}

interface Props {
  posts: Post[];
}

export function RecentPostsCard({ posts }: Props) {
  const navigate = useNavigate();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const recentPosts = [...posts]
    .filter((p) => p.posted_at)
    .sort((a, b) => new Date(b.posted_at!).getTime() - new Date(a.posted_at!).getTime())
    .slice(0, 7);

  if (recentPosts.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Recent Performance
          </h3>
          <Button
            variant="link"
            className="p-0 h-auto text-primary text-xs gap-1"
            onClick={() => navigate("/insights")}
          >
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-[1fr_70px_70px_80px] gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
            <span>Post</span>
            <span className="text-right">Views</span>
            <span className="text-right">Eng.</span>
            <span className="text-right">Posted</span>
          </div>
          {recentPosts.map((post, i) => {
            const isExpanded = expandedIdx === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  className="w-full grid grid-cols-[1fr_70px_70px_80px] gap-2 text-sm px-2 py-2 rounded-md hover:bg-accent/50 transition-colors items-center text-left"
                >
                  <span className="text-foreground truncate text-xs">
                    {(post.text_content ?? "").slice(0, 45)}…
                  </span>
                  <span className="text-right text-foreground font-mono text-xs">
                    {(post.views ?? 0).toLocaleString()}
                  </span>
                  <span className="text-right text-emerald-400 font-mono text-xs">
                    {(post.engagement_rate ?? 0).toFixed(1)}%
                  </span>
                  <span className="text-right text-muted-foreground text-[11px]">
                    {post.posted_at ? formatDistanceToNow(new Date(post.posted_at), { addSuffix: false }) : "—"}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-2 pb-2">
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 whitespace-pre-wrap leading-relaxed">
                      {post.text_content}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
