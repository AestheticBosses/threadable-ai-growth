import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContentPlan, useHasIdentity } from "@/hooks/usePlansData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Sparkles, RefreshCw, ArrowRight, Check, MessageSquare, ListPlus, Zap, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FUNNEL_BADGE: Record<string, string> = {
  TOF: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  MOF: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  BOF: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export function ContentPlanTab() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { query, generate } = useContentPlan();
  const { data: hasIdentity } = useHasIdentity();
  const isGenerating = generate.isPending;

  // Defensive parsing — plan_data may be a string or malformed
  let plan: any = null;
  try {
    const raw = query.data?.plan_data;
    if (typeof raw === "string") {
      plan = JSON.parse(raw);
    } else if (raw && typeof raw === "object") {
      plan = raw;
    }
    // Ensure critical fields are arrays
    if (plan) {
      if (!Array.isArray(plan.daily_plan)) plan.daily_plan = [];
      if (!Array.isArray(plan.weekly_themes)) plan.weekly_themes = [];
      if (!Array.isArray(plan.primary_archetypes)) plan.primary_archetypes = [];
      if (!Array.isArray(plan.best_times)) plan.best_times = [];
    }
  } catch {
    plan = null;
  }

  const [confirmWeek, setConfirmWeek] = useState(false);
  const [generatingWeek, setGeneratingWeek] = useState(false);
  const [weekProgress, setWeekProgress] = useState({ current: 0, total: 0 });
  const [draftingPostKey, setDraftingPostKey] = useState<string | null>(null);
  const [draftedPosts, setDraftedPosts] = useState<Set<string>>(new Set());
  const [inlineDrafts, setInlineDrafts] = useState<Record<string, string>>({});
  const [sentToQueue, setSentToQueue] = useState<Set<string>>(new Set());

  // Safe date parsing helper
  const safeISOString = (date: Date): string | null => {
    try {
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch {
      return null;
    }
  };

  // Safe time parsing helper
  const parseTime = (timeStr: string): { hours: number; minutes: number } | null => {
    try {
      const [h, m] = timeStr.split(":").map(Number);
      if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
        return null;
      }
      return { hours: h, minutes: m };
    } catch {
      return null;
    }
  };

  // Collect all posts from the plan
  const getAllPlanPosts = () => {
    if (!plan?.daily_plan) return [];
    const allPosts: any[] = [];
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const bestTimes = Array.isArray(plan.best_times) ? plan.best_times : ["09:00", "12:30", "17:00"];

    for (const day of plan.daily_plan) {
      const dayIdx = dayNames.indexOf(day.day);
      if (dayIdx === -1) continue;
      let daysUntil = dayIdx - dayOfWeek;
      if (daysUntil <= 0) daysUntil += 7;
      const scheduledDate = new Date(now);
      scheduledDate.setDate(scheduledDate.getDate() + daysUntil);

      for (let i = 0; i < (day.posts?.length || 0); i++) {
        const post = day.posts[i];
        const time = bestTimes[i % bestTimes.length] || "09:00";
        const parsedTime = parseTime(time);
        if (!parsedTime) continue; // Skip if time parsing fails

        const schedTime = new Date(scheduledDate);
        schedTime.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
        const isoString = safeISOString(schedTime);
        if (!isoString) continue; // Skip if date becomes invalid

        allPosts.push({
          archetype: post.archetype,
          funnel_stage: post.funnel_stage,
          topic: post.topic,
          hook_idea: post.hook_idea || "",
          day: day.day,
          scheduled_time: isoString,
        });
      }
    }
    return allPosts;
  };

  const handleGenerateWeek = async () => {
    setConfirmWeek(false);
    if (!session?.access_token) return;

    const allPosts = getAllPlanPosts();
    if (allPosts.length === 0) {
      toast({ title: "No posts in plan", variant: "destructive" });
      return;
    }

    setGeneratingWeek(true);
    setWeekProgress({ current: 0, total: allPosts.length });

    try {
      // Process in batches of 3
      let generated = 0;
      const batches: any[][] = [];
      for (let i = 0; i < allPosts.length; i += 3) {
        batches.push(allPosts.slice(i, i + 3));
      }

      for (const batch of batches) {
        const res = await supabase.functions.invoke("generate-draft-posts", {
          body: { posts: batch },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.error) throw new Error(res.error.message);
        generated += res.data?.total || 0;
        setWeekProgress({ current: generated, total: allPosts.length });
      }

      toast({
        title: `${generated} draft posts added to your Content Queue! 🎉`,
        action: (
          <Button size="sm" variant="outline" onClick={() => navigate("/queue")} className="gap-1">
            View Queue
          </Button>
        ),
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingWeek(false);
      setWeekProgress({ current: 0, total: 0 });
    }
  };

  const handleInlineDraft = async (post: any, dayName: string, postIndex: number) => {
    const key = `${dayName}-${postIndex}`;
    if (!session?.access_token) return;

    setDraftingPostKey(key);
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayIdx = dayNames.indexOf(dayName);
      let daysUntil = dayIdx >= 0 ? dayIdx - dayOfWeek : 1;
      if (daysUntil <= 0) daysUntil += 7;
      const schedDate = new Date(now);
      schedDate.setDate(schedDate.getDate() + daysUntil);
      schedDate.setHours(9, 0, 0, 0);

      const isoString = safeISOString(schedDate);
      if (!isoString) throw new Error("Failed to create valid scheduled time");

      const res = await supabase.functions.invoke("generate-draft-posts", {
        body: {
          posts: [{
            archetype: post.archetype,
            funnel_stage: post.funnel_stage,
            topic: post.topic,
            hook_idea: post.hook_idea || "",
            day: dayName,
            scheduled_time: isoString,
          }],
          return_text: true,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message);

      // Try to get the generated text from the response
      const posts = res.data?.posts || [];
      const generatedText = posts[0]?.text_content || res.data?.text || "Draft generated — check your Content Queue";
      setInlineDrafts((prev) => ({ ...prev, [key]: generatedText }));
      setDraftedPosts((prev) => new Set(prev).add(key));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDraftingPostKey(null);
    }
  };

  const handleSendDraftToQueue = async (key: string) => {
    // The draft was already saved to queue during generation
    setSentToQueue((prev) => new Set(prev).add(key));
    toast({ title: "Draft is in your Content Queue ✅" });
  };

  if (!hasIdentity) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <Sparkles className="h-10 w-10 text-primary" />
        <p className="text-foreground font-medium">Fill out your Identity first</p>
        <p className="text-sm text-muted-foreground max-w-md">
          We need your identity data to create a personalized content plan.
        </p>
        <Button onClick={() => navigate("/my-story")} className="gap-2">
          Go to Identity <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Show query or generate errors inline
  if (query.isError || generate.isError) {
    const errMsg = (query.error as any)?.message || (generate.error as any)?.message || "Something went wrong.";
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <Sparkles className="h-10 w-10 text-destructive" />
          <p className="text-foreground font-medium">Something went wrong generating your plan</p>
          <p className="text-sm text-muted-foreground max-w-md">{errMsg}</p>
          <Button onClick={() => generate.mutate()} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const totalPlanPosts = getAllPlanPosts().length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Content Plan</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your data-backed content strategy based on your archetypes, identity, and audience.
          </p>
        </div>
        <div className="flex gap-2">
          {plan && (
            <>
              <Button
                onClick={() => setConfirmWeek(true)}
                disabled={generatingWeek || isGenerating}
                className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
              >
                {generatingWeek ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                ✨ Generate Week of Posts
              </Button>
              <Button variant="outline" onClick={() => generate.mutate()} disabled={isGenerating || generatingWeek} className="gap-2">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                🔄 Regenerate
              </Button>
            </>
          )}
          {!plan && (
            <Button onClick={() => generate.mutate()} disabled={isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              ✨ Generate Plan
            </Button>
          )}
        </div>
      </div>

      {/* Week generation progress */}
      {generatingWeek && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium text-foreground">
                Generating post {weekProgress.current} of {weekProgress.total}...
              </span>
            </div>
            <Progress value={(weekProgress.current / Math.max(weekProgress.total, 1)) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {isGenerating && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Generating your content plan...</span>
          </div>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!isGenerating && plan && (
        <>
          {/* Weekly Overview */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Weekly Overview</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Posts per day</p>
                  <p className="text-lg font-bold font-mono text-foreground">{plan.posts_per_day}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Best posting times</p>
                  <p className="text-sm text-foreground">{plan.best_times?.join(", ")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Primary archetypes</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {plan.primary_archetypes?.map((a: any) => (
                      <Badge key={a.name} variant="outline" className="text-xs">
                        {a.name} ({a.percentage}%)
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Plan */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Daily Plan</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {plan.daily_plan?.map((day: any) => (
                <Card key={day.day}>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-bold text-foreground">{day.day}</p>
                    <div className="space-y-2">
                      {day.posts?.map((post: any, i: number) => {
                        const postKey = `${day.day}-${i}`;
                        const isDrafted = draftedPosts.has(postKey);
                        const isDrafting = draftingPostKey === postKey;

                        return (
                          <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-[10px]">{post.archetype}</Badge>
                              <Badge className={`text-[10px] ${FUNNEL_BADGE[post.funnel_stage] || FUNNEL_BADGE.TOF}`}>
                                {post.funnel_stage}
                              </Badge>
                              {isDrafted && (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-0.5">
                                  <Check className="h-2.5 w-2.5" /> Drafted
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{post.topic}</p>
                            {post.hook_idea && (
                              <p className="text-xs text-foreground/70 italic">"{post.hook_idea}"</p>
                            )}
                            {/* Inline Draft Button */}
                            {!inlineDrafts[postKey] ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] text-primary p-0 gap-0.5"
                                disabled={isDrafting}
                                onClick={() => handleInlineDraft(post, day.day, i)}
                              >
                                {isDrafting ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <><Zap className="h-3 w-3" /> Draft</>
                                )}
                              </Button>
                            ) : (
                              <div className="mt-2 space-y-2 border-t border-border pt-2">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                  — Generated Draft —
                                </p>
                                <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                                  {inlineDrafts[postKey]}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {!sentToQueue.has(postKey) ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[10px] gap-0.5"
                                      onClick={() => handleSendDraftToQueue(postKey)}
                                    >
                                      <Send className="h-2.5 w-2.5" /> Send to Queue
                                    </Button>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-0.5">
                                      <Check className="h-2.5 w-2.5" /> In Queue
                                    </Badge>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] gap-0.5"
                                    onClick={() => navigate(`/chat?prefill=${encodeURIComponent(inlineDrafts[postKey])}`)}
                                  >
                                    <MessageSquare className="h-2.5 w-2.5" /> Edit in Chat
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] gap-0.5"
                                    disabled={isDrafting}
                                    onClick={() => {
                                      setInlineDrafts((prev) => { const n = { ...prev }; delete n[postKey]; return n; });
                                      setSentToQueue((prev) => { const n = new Set(prev); n.delete(postKey); return n; });
                                      handleInlineDraft(post, day.day, i);
                                    }}
                                  >
                                    <RefreshCw className="h-2.5 w-2.5" /> Regenerate
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Themes */}
          {Array.isArray(plan.weekly_themes) && plan.weekly_themes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-primary uppercase tracking-wider">This Week's Themes</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {plan.weekly_themes.map((theme: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-2">
                      <p className="text-sm font-bold text-foreground">{theme.theme}</p>
                      <ul className="space-y-1">
                        {theme.angles?.map((angle: string, j: number) => (
                          <li key={j} className="text-xs text-muted-foreground flex gap-2">
                            <span className="text-primary">•</span> {angle}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!isGenerating && !plan && !query.isLoading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <Sparkles className="h-10 w-10 text-primary" />
          <p className="text-foreground font-medium">No content plan yet</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Generate a personalized 7-day content plan based on your identity and top posts.
          </p>
        </div>
      )}

      {/* Confirm generate week dialog */}
      <AlertDialog open={confirmWeek} onOpenChange={setConfirmWeek}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Week of Posts?</AlertDialogTitle>
            <AlertDialogDescription>
              Generate draft posts for all {totalPlanPosts} planned slots this week? They'll appear in your Content Queue as drafts for review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerateWeek}>Generate {totalPlanPosts} Posts</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
