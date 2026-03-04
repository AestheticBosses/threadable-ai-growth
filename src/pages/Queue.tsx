import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Loader2,
  Sparkles,
  Check,
  RefreshCw,
  Trash2,
  Pencil,
  CalendarIcon,
  Target,
  Send,
  Wand2,
  ChevronDown,
  CheckCircle2,
  Clock,
  PartyPopper,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PostStatusIndicator } from "@/components/queue/PostStatusIndicator";
import { ScheduleDialog } from "@/components/queue/ScheduleDialog";
import { LogResultsModal } from "@/components/queue/LogResultsModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, BarChart3 } from "lucide-react";
import { ScoringChecklist } from "@/components/strategy/ScoringChecklist";

type Post = {
  id: string;
  text_content: string | null;
  content_category: string | null;
  funnel_stage: string | null;
  scheduled_for: string | null;
  status: string | null;
  ai_generated: boolean | null;
  user_edited: boolean | null;
  pre_post_score: number | null;
  score_breakdown: Record<string, any> | null;
  threads_media_id: string | null;
  published_at: string | null;
  error_message: string | null;
  created_at: string;
  source: string | null;
};

const FUNNEL_BADGE_COLORS: Record<string, string> = {
  TOF: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  MOF: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  BOF: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

const FUNNEL_LABELS: Record<string, string> = {
  TOF: "TOF · Reach",
  MOF: "MOF · Trust",
  BOF: "BOF · Convert",
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

const Queue = () => {
  usePageTitle("Content Queue", "Manage and schedule your Threads content");
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [threadsUsername, setThreadsUsername] = useState<string | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [pendingApproveId, setPendingApproveId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [confirmPublishId, setConfirmPublishId] = useState<string | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [fixContextId, setFixContextId] = useState<string | null>(null);
  const [fixFeedback, setFixFeedback] = useState("");
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [scoreChecklistId, setScoreChecklistId] = useState<string | null>(null);
  const [logResultsPostId, setLogResultsPostId] = useState<string | null>(null);
  const [postResults, setPostResults] = useState<Record<string, { id: string; comments_received: number | null; link_clicks: number | null; dm_replies: number | null; is_estimated: boolean }>>({});

  const loadPostResults = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("post_results")
      .select("id, post_id, comments_received, link_clicks, dm_replies, is_estimated")
      .eq("user_id", user.id);
    if (data) {
      const map: typeof postResults = {};
      for (const r of data) {
        map[r.post_id] = r;
      }
      setPostResults(map);
    }
  }, [user]);

  const loadPosts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("scheduled_posts")
      .select("id, text_content, content_category, funnel_stage, scheduled_for, status, ai_generated, user_edited, pre_post_score, score_breakdown, threads_media_id, published_at, error_message, created_at, source")
      .eq("user_id", user.id)
      .in("status", ["draft", "approved", "scheduled"])
      .order("scheduled_for", { ascending: true });
    setPosts((data as Post[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("threads_username")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.threads_username) setThreadsUsername(data.threads_username);
      });
  }, [user]);

  useEffect(() => {
    loadPosts();
    loadPostResults();
  }, [loadPosts, loadPostResults]);

  const drafts = posts.filter((p) => p.status === "draft");
  const approved = posts.filter((p) => p.status === "approved" || p.status === "scheduled");
  const allApproved = drafts.length === 0 && approved.length > 0;

  // Approve single post
  const handleApprove = async (id: string) => {
    const post = posts.find((p) => p.id === id);
    if (!post?.scheduled_for) {
      setPendingApproveId(id);
      setScheduleDialogOpen(true);
      return;
    }
    await supabase.from("scheduled_posts").update({ status: "approved" }).eq("id", id);
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status: "approved" } : p)));
    toast({ title: "Post approved ✅" });
  };

  const handleApproveWithDate = async (date: Date) => {
    if (!pendingApproveId) return;
    await supabase
      .from("scheduled_posts")
      .update({ status: "approved", scheduled_for: date.toISOString() })
      .eq("id", pendingApproveId);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === pendingApproveId
          ? { ...p, status: "approved", scheduled_for: date.toISOString() }
          : p
      )
    );
    setPendingApproveId(null);
    toast({ title: "Post approved & scheduled ✅" });
  };

  // Approve all drafts
  const handleApproveAll = async () => {
    if (drafts.length === 0) return;
    setApprovingAll(true);
    try {
      const draftIds = drafts.map((d) => d.id);
      await supabase
        .from("scheduled_posts")
        .update({ status: "approved" })
        .in("id", draftIds);
      setPosts((prev) =>
        prev.map((p) => (p.status === "draft" ? { ...p, status: "approved" } : p))
      );
      toast({ title: `${draftIds.length} drafts approved! ✅` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setApprovingAll(false);
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    await supabase.from("scheduled_posts").delete().eq("id", id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  // Delete All (drafts, approved, scheduled — not published)
  const handleDeleteAll = async () => {
    if (!user) return;
    setDeletingAll(true);
    try {
      const { error } = await supabase
        .from("scheduled_posts")
        .delete()
        .eq("user_id", user.id)
        .in("status", ["draft", "approved", "scheduled"]);
      if (error) throw error;
      setPosts([]);
      toast({ title: "All posts deleted 🗑️" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeletingAll(false);
      setDeleteAllOpen(false);
    }
  };

  // Save edit & re-score
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
      toast({ title: "Post updated ✏️" });
    } catch (e: any) {
      toast({ title: "Error scoring", description: e.message, variant: "destructive" });
    }
  };

  // Retry failed post
  const handleRetry = async (id: string) => {
    await supabase
      .from("scheduled_posts")
      .update({ status: "approved", error_message: null })
      .eq("id", id);
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "approved", error_message: null } : p))
    );
    toast({ title: "Post queued for retry" });
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

  // Post Now
  const handlePostNow = async (postId: string) => {
    if (!session?.access_token) return;
    setPublishingId(postId);
    try {
      const res = await supabase.functions.invoke("publish-post", {
        body: { postId },
      });
      if (res.error) throw new Error(res.error.message || "Publishing failed");
      const data = res.data as any;
      if (data?.error) throw new Error(data.error);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, status: "published", published_at: new Date().toISOString(), threads_media_id: data.threads_media_id, error_message: null }
            : p
        )
      );
      toast({ title: "Posted to Threads! 🎉" });
    } catch (e: any) {
      toast({ title: "Publishing failed", description: e.message, variant: "destructive" });
    } finally {
      setPublishingId(null);
      setConfirmPublishId(null);
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

  // Fix Context — AI-assisted correction
  const handleFixContext = async () => {
    if (!session?.access_token || !fixContextId || !fixFeedback.trim()) return;
    setFixingId(fixContextId);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fix-post`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ post_id: fixContextId, feedback: fixFeedback }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fix failed");
      }
      const { post: updated } = await res.json();
      if (updated) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === fixContextId
              ? { ...p, text_content: updated.text_content, pre_post_score: updated.pre_post_score, score_breakdown: updated.score_breakdown, user_edited: true }
              : p
          )
        );
        toast({ title: "Post improved! ✏️" });
      }
      setFixContextId(null);
      setFixFeedback("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setFixingId(null);
    }
  };

  // Truncate text for collapsed view
  const truncate = (text: string | null, len = 120) => {
    if (!text) return "No content";
    return text.length > len ? text.slice(0, len) + "…" : text;
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
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Content Queue</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {approved.length} scheduled · {drafts.length} draft{drafts.length !== 1 ? "s" : ""} awaiting approval
            </p>
          </div>

          <div className="flex items-center gap-2">
            {posts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteAllOpen(true)}
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete All
              </Button>
            )}

            {drafts.length > 0 && (
              <Button
                onClick={handleApproveAll}
                disabled={approvingAll}
                className="gap-2"
              >
                {approvingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve All Drafts ({drafts.length})
              </Button>
            )}
          </div>
        </div>

        {/* All-approved confirmation state */}
        {allApproved && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="rounded-full bg-emerald-500/10 p-3">
                <PartyPopper className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Your week is scheduled 🎉</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {approved.length} post{approved.length !== 1 ? "s" : ""} will publish automatically at their scheduled times.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
            <p className="text-foreground font-medium">No posts in your queue yet.</p>
            <p className="text-sm text-muted-foreground max-w-md text-center">
              Generate posts from your Content Plan or draft one in Chat.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/playbook")} className="gap-2">
                Go to Content Plan
              </Button>
              <Button onClick={() => navigate("/chat")} className="gap-2">
                Open Chat
              </Button>
            </div>
          </div>
        )}

        {/* Draft posts section */}
        {drafts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Drafts — Review & Approve
            </h2>
            {drafts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                expanded={expandedId === post.id}
                onToggle={() => setExpandedId(expandedId === post.id ? null : post.id)}
                editingId={editingId}
                editText={editText}
                onStartEdit={(id, text) => { setEditingId(id); setEditText(text); }}
                onCancelEdit={() => setEditingId(null)}
                onEditTextChange={setEditText}
                onSaveEdit={handleSaveEdit}
                onApprove={handleApprove}
                onDelete={handleDelete}
                onPostNow={(id) => setConfirmPublishId(id)}
                publishingId={publishingId}
                onFixPost={(id) => { setFixContextId(id); setFixFeedback(""); }}
                onRegenerate={handleRegenerate}
                regeneratingId={regeneratingId}
                onScore={handleScorePost}
                scoringId={scoringId}
                onRetry={handleRetry}
                scoreChecklistId={scoreChecklistId}
                onToggleScoreChecklist={(id) => setScoreChecklistId(scoreChecklistId === id ? null : id)}
                onDateChange={handleDateChange}
                threadsUsername={threadsUsername}
                truncate={truncate}
                isDraft
                postResult={postResults[post.id] || null}
                onLogResults={(id) => setLogResultsPostId(id)}
              />
            ))}
          </div>
        )}

        {/* Approved/Scheduled posts section */}
        {approved.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Scheduled Posts
            </h2>
            {approved.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                expanded={expandedId === post.id}
                onToggle={() => setExpandedId(expandedId === post.id ? null : post.id)}
                editingId={editingId}
                editText={editText}
                onStartEdit={(id, text) => { setEditingId(id); setEditText(text); }}
                onCancelEdit={() => setEditingId(null)}
                onEditTextChange={setEditText}
                onSaveEdit={handleSaveEdit}
                onApprove={handleApprove}
                onDelete={handleDelete}
                onPostNow={(id) => setConfirmPublishId(id)}
                publishingId={publishingId}
                onFixPost={(id) => { setFixContextId(id); setFixFeedback(""); }}
                onRegenerate={handleRegenerate}
                regeneratingId={regeneratingId}
                onScore={handleScorePost}
                scoringId={scoringId}
                onRetry={handleRetry}
                scoreChecklistId={scoreChecklistId}
                onToggleScoreChecklist={(id) => setScoreChecklistId(scoreChecklistId === id ? null : id)}
                onDateChange={handleDateChange}
                threadsUsername={threadsUsername}
                truncate={truncate}
                isDraft={false}
                postResult={postResults[post.id] || null}
                onLogResults={(id) => setLogResultsPostId(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={(open) => {
          setScheduleDialogOpen(open);
          if (!open) setPendingApproveId(null);
        }}
        onConfirm={handleApproveWithDate}
      />

      {/* Post Now Confirmation */}
      <AlertDialog open={!!confirmPublishId} onOpenChange={(open) => !open && setConfirmPublishId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post this to Threads now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately publish the post to your Threads account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmPublishId && handlePostNow(confirmPublishId)}>
              🚀 Post Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation */}
      <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all posts?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete all scheduled and draft posts? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAll ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fix / Improve Post Modal */}
      <Dialog open={!!fixContextId} onOpenChange={(open) => { if (!open) { setFixContextId(null); setFixFeedback(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>✏️ Improve Post</DialogTitle>
            <DialogDescription>Tell the AI what's wrong and it'll rewrite the post.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 max-h-40 overflow-y-auto">
              <p className="text-sm text-foreground whitespace-pre-line">
                {posts.find((p) => p.id === fixContextId)?.text_content || ""}
              </p>
            </div>
            <Input
              placeholder='e.g. "Too long, make it shorter" or "Make it more punchy"'
              value={fixFeedback}
              onChange={(e) => setFixFeedback(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !fixingId && fixFeedback.trim() && handleFixContext()}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setFixContextId(null); setFixFeedback(""); }}>
                Cancel
              </Button>
              <Button size="sm" disabled={!fixFeedback.trim() || !!fixingId} onClick={handleFixContext} className="gap-1">
                {fixingId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                Fix It
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Results Modal */}
      {logResultsPostId && user && (
        <LogResultsModal
          open={!!logResultsPostId}
          onOpenChange={(open) => { if (!open) setLogResultsPostId(null); }}
          postId={logResultsPostId}
          userId={user.id}
          existingResult={postResults[logResultsPostId] || null}
          onSaved={loadPostResults}
        />
      )}
    </AppLayout>
  );
};

// ─── Post Card Component ──────────────────────────────────────

interface PostCardProps {
  post: Post;
  expanded: boolean;
  onToggle: () => void;
  editingId: string | null;
  editText: string;
  onStartEdit: (id: string, text: string) => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  onSaveEdit: (id: string) => void;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  onPostNow: (id: string) => void;
  publishingId: string | null;
  onFixPost: (id: string) => void;
  onRegenerate: (post: Post) => void;
  regeneratingId: string | null;
  onScore: (post: Post) => void;
  scoringId: string | null;
  onRetry: (id: string) => void;
  scoreChecklistId: string | null;
  onToggleScoreChecklist: (id: string) => void;
  onDateChange: (id: string, date: Date) => void;
  threadsUsername: string | null;
  truncate: (text: string | null, len?: number) => string;
  isDraft: boolean;
  postResult: { id: string; comments_received: number | null; link_clicks: number | null; dm_replies: number | null; is_estimated: boolean } | null;
  onLogResults: (id: string) => void;
}

function PostCard({
  post,
  expanded,
  onToggle,
  editingId,
  editText,
  onStartEdit,
  onCancelEdit,
  onEditTextChange,
  onSaveEdit,
  onApprove,
  onDelete,
  onPostNow,
  publishingId,
  onFixPost,
  onRegenerate,
  regeneratingId,
  onScore,
  scoringId,
  onRetry,
  scoreChecklistId,
  onToggleScoreChecklist,
  onDateChange,
  threadsUsername,
  truncate,
  isDraft,
  postResult,
  onLogResults,
}: PostCardProps) {
  const isEditing = editingId === post.id;

  // Result status dot
  const resultDot = postResult
    ? postResult.is_estimated
      ? { color: "bg-yellow-500", label: "Estimated results" }
      : { color: "bg-emerald-500", label: "Results logged" }
    : { color: "bg-muted-foreground/40", label: "No results logged" };

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      isDraft ? "border-border" : "border-emerald-500/20"
    )}>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        {/* Collapsed header — always visible */}
        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-4 flex items-start gap-3 hover:bg-accent/30 transition-colors">
            <div className="mt-0.5 relative">
              {isDraft ? (
                <Clock className="h-4 w-4 text-muted-foreground" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn("absolute -bottom-1 -right-1 h-2 w-2 rounded-full border border-background", resultDot.color)} />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">{resultDot.label}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              {/* Top row: date/time + badges */}
              <div className="flex flex-wrap items-center gap-2">
                {!isDraft && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                    Scheduled
                  </Badge>
                )}
                {isDraft && (
                  <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                    Draft
                  </Badge>
                )}
                {post.scheduled_for && (
                  <span className="text-xs text-muted-foreground font-medium">
                    {format(new Date(post.scheduled_for), "EEE, MMM d · HH:mm")}
                  </span>
                )}
                {post.funnel_stage && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", FUNNEL_BADGE_COLORS[post.funnel_stage] || "")}
                  >
                    {FUNNEL_LABELS[post.funnel_stage] || post.funnel_stage}
                  </Badge>
                )}
                {post.content_category && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", CATEGORY_COLORS[post.content_category.toLowerCase()] || "")}
                  >
                    {post.content_category}
                  </Badge>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px] cursor-help gap-0.5", scoreBg(post.pre_post_score), scoreColor(post.pre_post_score))}
                      >
                        {post.pre_post_score != null ? `${post.pre_post_score}/6` : "—"}
                        <Info className="h-2.5 w-2.5" />
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs p-3 space-y-2">
                      <p className="text-xs font-semibold">Score Breakdown</p>
                      {post.score_breakdown ? (
                        <div className="space-y-1">
                          {Object.entries(post.score_breakdown)
                            .filter(([key]) => key !== "total")
                            .map(([key, val]) => {
                              const item = val as any;
                              const passed = typeof item === "object" ? (item.passed ?? item.score === 1) : !!item;
                              const label = typeof item === "object" && item.question ? item.question : key;
                              return (
                                <div key={key} className="flex items-center gap-1.5 text-xs">
                                  <span>{passed ? "✅" : "❌"}</span>
                                  <span className={passed ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not scored yet</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Truncated preview */}
              <p className="text-sm text-foreground/80 leading-relaxed">
                {truncate(post.text_content)}
              </p>
            </div>

            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform",
              expanded && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t border-border pt-4 ml-7">
            {/* Status indicator */}
            <PostStatusIndicator
              status={post.status}
              scheduledFor={post.scheduled_for}
              publishedAt={post.published_at}
              threadsMediaId={post.threads_media_id}
              threadsUsername={threadsUsername}
              errorMessage={post.error_message}
              onRetry={() => onRetry(post.id)}
            />

            {/* Full content or editor */}
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editText}
                  onChange={(e) => onEditTextChange(e.target.value)}
                  rows={6}
                  className="text-sm resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs", editText.length > 500 ? "text-destructive font-medium" : "text-muted-foreground")}>
                      {editText.length} / 500 chars
                    </span>
                    {editText.length > 500 && (
                      <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                        Over Threads limit
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={onCancelEdit}>Cancel</Button>
                    <Button size="sm" onClick={() => onSaveEdit(post.id)} disabled={editText.length > 500}>Save</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                  {post.text_content || "No content"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={cn(
                    "text-xs",
                    (post.text_content?.length || 0) > 500 ? "text-destructive font-medium" : "text-muted-foreground"
                  )}>
                    {post.text_content?.length || 0} / 500 chars
                  </span>
                  {(post.text_content?.length || 0) > 500 && (
                    <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                      Over Threads limit
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Date picker for scheduled */}
            {post.scheduled_for && !isDraft && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <CalendarIcon className="h-3 w-3" />
                    Reschedule: {format(new Date(post.scheduled_for), "MMM d, HH:mm")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(post.scheduled_for)}
                    onSelect={(d) => d && onDateChange(post.id, d)}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}

            {/* Actions */}
            {!isEditing && (
              <div className="flex flex-wrap gap-1.5">
                {isDraft && (
                  <Button size="sm" onClick={() => onApprove(post.id)} className="gap-1 h-7 text-xs">
                    <Check className="h-3 w-3" />
                    Approve
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStartEdit(post.id, post.text_content || "")}
                  className="gap-1 h-7 text-xs"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onFixPost(post.id)}
                  className="gap-1 h-7 text-xs"
                >
                  <Wand2 className="h-3 w-3" />
                  Improve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRegenerate(post)}
                  disabled={regeneratingId === post.id}
                  className="gap-1 h-7 text-xs"
                >
                  {regeneratingId === post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleScoreChecklist(post.id)}
                  className="gap-1 h-7 text-xs"
                >
                  <Target className="h-3 w-3" />
                  Score
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if ((post.text_content?.length || 0) > 500) {
                      toast({ title: "Post too long", description: "Edit to under 500 characters before posting.", variant: "destructive" });
                      return;
                    }
                    onPostNow(post.id);
                  }}
                  disabled={publishingId === post.id}
                  className="gap-1 h-7 text-xs"
                >
                  {publishingId === post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  🚀 Post Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onLogResults(post.id)}
                  className="gap-1 h-7 text-xs"
                >
                  <BarChart3 className="h-3 w-3" />
                  Log Results
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(post.id)}
                  className="gap-1 h-7 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Score Checklist */}
            {scoreChecklistId === post.id && (
              <ScoringChecklist postText={post.text_content ?? ""} />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default Queue;
