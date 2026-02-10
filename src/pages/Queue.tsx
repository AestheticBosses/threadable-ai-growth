import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Loader2,
  Sparkles,
  Check,
  RefreshCw,
  Trash2,
  Pencil,
  ChevronDown,
  CalendarIcon,
  BarChart3,
  X,
  AlertTriangle,
  Target,
} from "lucide-react";

type Post = {
  id: string;
  text_content: string | null;
  content_category: string | null;
  scheduled_for: string | null;
  status: string | null;
  ai_generated: boolean | null;
  user_edited: boolean | null;
  pre_post_score: number | null;
  score_breakdown: Record<string, any> | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-emerald-500/10 text-emerald-600",
  scheduled: "bg-primary/10 text-primary",
  published: "bg-violet-500/10 text-violet-600",
};

const CATEGORY_COLORS: Record<string, string> = {
  authority: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  engagement: "bg-primary/10 text-primary border-primary/20",
  storytelling: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  cta: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

function scoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 5) return "text-emerald-600";
  if (score >= 4) return "text-yellow-600";
  return "text-destructive";
}

function scoreBg(score: number | null): string {
  if (score == null) return "bg-muted";
  if (score >= 5) return "bg-emerald-500/10";
  if (score >= 4) return "bg-yellow-500/10";
  return "bg-destructive/10";
}

const BREAKDOWN_LABELS: Record<string, string> = {
  hook_strength: "Hook Strength",
  emotional_triggers: "Emotional Triggers",
  vivid_scene: "Vivid Scene",
  niche_specificity: "Niche Specificity",
  voice_match: "Voice Match",
  data_aligned: "Data-Aligned",
};

const TABS = ["all", "draft", "approved", "scheduled", "published"] as const;
type TabVal = (typeof TABS)[number];

const Queue = () => {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<TabVal>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [expandedScoreId, setExpandedScoreId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "status" | "category">("date");

  const loadPosts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("scheduled_posts")
      .select("id, text_content, content_category, scheduled_for, status, ai_generated, user_edited, pre_post_score, score_breakdown, created_at")
      .eq("user_id", user.id)
      .order("scheduled_for", { ascending: true });
    setPosts((data as Post[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const filteredPosts = posts.filter((p) =>
    activeTab === "all" ? true : p.status === activeTab
  );

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortBy === "status") return (a.status || "").localeCompare(b.status || "");
    if (sortBy === "category") return (a.content_category || "").localeCompare(b.content_category || "");
    return new Date(a.scheduled_for || 0).getTime() - new Date(b.scheduled_for || 0).getTime();
  });

  const todayCount = posts.filter((p) => {
    if (!p.scheduled_for) return false;
    const d = new Date(p.scheduled_for);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  // Generate posts
  const handleGenerate = async (count: number) => {
    if (!session?.access_token) return;
    setGenerating(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-content`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ posts_count: count }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }
      const data = await res.json();
      toast({ title: `${data.total} posts generated!` });
      await loadPosts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Approve
  const handleApprove = async (id: string) => {
    await supabase.from("scheduled_posts").update({ status: "approved" }).eq("id", id);
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status: "approved" } : p)));
  };

  // Delete
  const handleDelete = async (id: string) => {
    await supabase.from("scheduled_posts").delete().eq("id", id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  // Save edit — re-score via score-post
  const handleSaveEdit = async (id: string) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/score-post`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: editText }),
        }
      );
      let newScore: number | null = null;
      let newBreakdown: Record<string, any> | null = null;
      if (res.ok) {
        const scoreData = await res.json();
        newScore = scoreData.score;
        newBreakdown = scoreData.breakdown;
      }

      await supabase
        .from("scheduled_posts")
        .update({
          text_content: editText,
          user_edited: true,
          pre_post_score: newScore,
          score_breakdown: newBreakdown as any,
        })
        .eq("id", id);

      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, text_content: editText, user_edited: true, pre_post_score: newScore, score_breakdown: newBreakdown }
            : p
        )
      );
      setEditingId(null);
    } catch (e: any) {
      toast({ title: "Error scoring", description: e.message, variant: "destructive" });
    }
  };

  // Score a single post
  const handleScorePost = async (post: Post) => {
    if (!session?.access_token || !post.text_content) return;
    setScoringId(post.id);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/score-post`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: post.text_content }),
        }
      );
      if (!res.ok) throw new Error("Scoring failed");
      const { score, breakdown } = await res.json();

      await supabase
        .from("scheduled_posts")
        .update({ pre_post_score: score, score_breakdown: breakdown })
        .eq("id", post.id);

      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, pre_post_score: score, score_breakdown: breakdown } : p))
      );
      toast({ title: `Scored ${score}/6` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setScoringId(null);
    }
  };

  // Regenerate single post
  const handleRegenerate = async (post: Post) => {
    if (!session?.access_token) return;
    setRegeneratingId(post.id);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-content`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            posts_count: 1,
            regenerate_post_id: post.id,
            regenerate_category: post.content_category,
          }),
        }
      );
      if (!res.ok) throw new Error("Regeneration failed");
      const data = await res.json();
      if (data.posts?.[0]) {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...data.posts[0] } : p)));
        toast({ title: "Post regenerated!" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRegeneratingId(null);
    }
  };

  // Update scheduled date
  const handleDateChange = async (id: string, date: Date) => {
    const existing = posts.find((p) => p.id === id);
    if (!existing?.scheduled_for) return;
    const oldDate = new Date(existing.scheduled_for);
    date.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0);
    await supabase.from("scheduled_posts").update({ scheduled_for: date.toISOString() }).eq("id", id);
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, scheduled_for: date.toISOString() } : p)));
  };

  // Bulk actions
  const handleBulkApprove = async () => {
    const ids = Array.from(selected);
    await supabase.from("scheduled_posts").update({ status: "approved" }).in("id", ids);
    setPosts((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, status: "approved" } : p)));
    setSelected(new Set());
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    await supabase.from("scheduled_posts").delete().in("id", ids);
    setPosts((prev) => prev.filter((p) => !selected.has(p.id)));
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Content Queue</h1>
            <p className="mt-1 text-muted-foreground">
              {todayCount} post{todayCount !== 1 ? "s" : ""} scheduled for today
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-xs">
                  Sort: {sortBy}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy("date")}>Date</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("status")}>Status</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("category")}>Category</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Generate */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={generating} className="gap-2">
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generating ? "Generating..." : "Generate Posts"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleGenerate(7)}>7 posts (1 week)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerate(14)}>14 posts (2 weeks)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerate(21)}>21 posts (3 weeks)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerate(30)}>30 posts (1 month)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({tab === "all" ? posts.length : posts.filter((p) => p.status === tab).length})
              </span>
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
            <span className="text-sm font-medium text-foreground">
              {selected.size} selected
            </span>
            <Button size="sm" variant="outline" onClick={handleBulkApprove} className="gap-1">
              <Check className="h-3 w-3" />
              Approve All
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkDelete} className="gap-1 text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="ml-auto">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Posts */}
        {sortedPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No posts yet. Generate some content to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedPosts.map((post) => (
              <Card key={post.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <Checkbox
                      checked={selected.has(post.id)}
                      onCheckedChange={() => toggleSelect(post.id)}
                      className="mt-1"
                    />

                    <div className="min-w-0 flex-1 space-y-3">
                      {/* Top row: badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className={STATUS_COLORS[post.status || "draft"]}>
                          {post.status}
                        </Badge>
                        {post.content_category && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              CATEGORY_COLORS[post.content_category.toLowerCase()] || ""
                            )}
                          >
                            {post.content_category}
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className={cn("text-xs", scoreBg(post.pre_post_score), scoreColor(post.pre_post_score))}
                        >
                          Score: {post.pre_post_score ?? "?"}/6
                        </Badge>
                        {post.user_edited && (
                          <Badge variant="outline" className="text-xs">Edited</Badge>
                        )}
                        {post.pre_post_score != null && post.pre_post_score < 4 && (
                          <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-600 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Low score
                          </Badge>
                        )}
                        {post.scheduled_for && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
                                <CalendarIcon className="h-3 w-3" />
                                {format(new Date(post.scheduled_for), "MMM d, HH:mm")}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <Calendar
                                mode="single"
                                selected={new Date(post.scheduled_for)}
                                onSelect={(d) => d && handleDateChange(post.id, d)}
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>

                      {/* Post text */}
                      {editingId === post.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={4}
                            className="text-sm resize-none"
                            autoFocus
                          />
                          <div className="flex items-center justify-between">
                            <span className={cn("text-xs", editText.length > 500 ? "text-destructive" : "text-muted-foreground")}>
                              {editText.length}/500
                            </span>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                              <Button size="sm" onClick={() => handleSaveEdit(post.id)}>
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                            {post.text_content || "No content"}
                          </p>
                          <span className={cn(
                            "text-xs mt-1 inline-block",
                            (post.text_content?.length || 0) > 500 ? "text-destructive" : "text-muted-foreground"
                          )}>
                            {post.text_content?.length || 0} chars
                          </span>
                        </div>
                      )}

                      {/* Score breakdown */}
                      {expandedScoreId === post.id && post.score_breakdown && (
                        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Score Breakdown ({(post.score_breakdown as any)?.total ?? post.pre_post_score ?? "?"}/6)
                          </p>
                          {Object.entries(post.score_breakdown)
                            .filter(([key]) => key !== "total")
                            .map(([key, val]) => {
                              const item = val as any;
                              const passed = typeof item === "object" ? item.score === 1 : !!item;
                              const reason = typeof item === "object" ? item.reason : "";
                              return (
                                <div key={key} className="space-y-0.5">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className={passed ? "text-emerald-600" : "text-destructive"}>
                                      {passed ? "✓" : "✕"}
                                    </span>
                                    <span className={passed ? "text-foreground" : "text-muted-foreground"}>
                                      {BREAKDOWN_LABELS[key] || key}
                                    </span>
                                  </div>
                                  {reason && (
                                    <p className="text-xs text-muted-foreground pl-6">{reason}</p>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}

                      {/* Actions */}
                      {editingId !== post.id && (
                        <div className="flex flex-wrap gap-1.5">
                          {post.status === "draft" && (
                            <Button size="sm" variant="outline" onClick={() => handleApprove(post.id)} className="gap-1 h-7 text-xs">
                              <Check className="h-3 w-3" />
                              Approve
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRegenerate(post)}
                            disabled={regeneratingId === post.id}
                            className="gap-1 h-7 text-xs"
                          >
                            {regeneratingId === post.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Regenerate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleScorePost(post)}
                            disabled={scoringId === post.id}
                            className="gap-1 h-7 text-xs"
                          >
                            {scoringId === post.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Target className="h-3 w-3" />
                            )}
                            Score This Post
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExpandedScoreId(expandedScoreId === post.id ? null : post.id)}
                            className="gap-1 h-7 text-xs"
                          >
                            <BarChart3 className="h-3 w-3" />
                            {expandedScoreId === post.id ? "Hide Score" : "Why this score?"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingId(post.id); setEditText(post.text_content || ""); }}
                            className="gap-1 h-7 text-xs"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(post.id)}
                            className="gap-1 h-7 text-xs text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Queue;
