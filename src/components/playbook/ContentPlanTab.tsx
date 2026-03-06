import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContentPlan, useHasIdentity } from "@/hooks/usePlansData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, RefreshCw, ArrowRight, Check, MessageSquare, ListPlus, Zap, Send, ChevronDown, ChevronRight, CheckSquare, ThumbsDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const FUNNEL_BADGE: Record<string, string> = {
  TOF: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  MOF: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  BOF: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export function ContentPlanTab() {
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const { query, generate, generationElapsed } = useContentPlan();
  const { data: hasIdentity } = useHasIdentity();
  const isGenerating = generate.isPending;

  const getProgressMessage = (elapsed: number): string => {
    if (elapsed < 30) return "Analyzing your content data...";
    if (elapsed < 60) return "Running regression on your top posts...";
    if (elapsed < 90) return "Building hook competition for each slot...";
    if (elapsed < 120) return "Applying story rotation and dedup...";
    if (elapsed < 180) return "Finalizing your 7-day plan...";
    return "Almost there \u2014 this one's comprehensive...";
  };

  // Defensive parsing — plan_data may be a string or malformed
  // Always deep-clone so we can safely mutate (React Query may freeze cached data)
  let plan: any = null;
  try {
    const raw = query.data?.plan_data;
    if (typeof raw === "string") {
      plan = JSON.parse(raw);
    } else if (raw && typeof raw === "object") {
      plan = JSON.parse(JSON.stringify(raw));
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

  console.log("[ContentPlanTab] full plan JSON:", JSON.stringify(plan, null, 2));
  console.log("[ContentPlanTab] today_best_times:", plan?.today_best_times);
  console.log("[ContentPlanTab] today_day_name:", plan?.today_day_name);
  console.log("[ContentPlanTab] best_times:", plan?.best_times);

  // Expanded time slots (one per post) for slot assignment
  const bestTimesRaw: string[] = Array.isArray(plan?.best_times) ? plan.best_times : ["09:00", "12:30", "17:00"];
  // Original regression-backed best times for display in Weekly Overview
  const originalBestTimes: string[] = Array.isArray(plan?.original_best_times) ? plan.original_best_times : bestTimesRaw;
  // Day/time checks — declared early so getPostTime can reference todayDayName
  const DAY_NAMES_CHECK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const nowForCheck = new Date();
  const todayDayName = DAY_NAMES_CHECK[nowForCheck.getDay()];
  const todayIdx = nowForCheck.getDay();
  // Today-specific time slots (all in the future at generation time)
  const todayBestTimes: string[] = Array.isArray(plan?.today_best_times) ? plan.today_best_times : bestTimesRaw;
  const todayDayFromPlan: string = plan?.today_day_name || "";
  // Helper: get the right time array for a given day
  const getPostTime = (dayName: string, postIndex: number): string => {
    // Always compare against the browser's current day, not the plan's stored today_day_name
    const useToday = dayName === todayDayName;
    const time = useToday
      ? (todayBestTimes[postIndex] || "09:00")
      : (bestTimesRaw[postIndex] || "09:00");
    console.log(`[getPostTime] day=${dayName} idx=${postIndex} useToday=${useToday} todayDayName=${todayDayName} todayDayFromPlan=${todayDayFromPlan} → ${time}`);
    return time;
  };

  // Sort daily_plan so today's day comes first, then future days, then past days
  if (plan && Array.isArray(plan.daily_plan) && plan.daily_plan.length > 0) {
    plan.daily_plan.sort((a: any, b: any) => {
      const aIdx = DAY_NAMES_CHECK.indexOf(a.day);
      const bIdx = DAY_NAMES_CHECK.indexOf(b.day);
      // Offset so today = 0, tomorrow = 1, etc.
      const aOff = (aIdx - todayIdx + 7) % 7;
      const bOff = (bIdx - todayIdx + 7) % 7;
      return aOff - bOff;
    });
  }

  // Read posts_per_day from the plan data itself (set by AI based on profile.max_posts_per_day)
  const postsPerDay = plan?.posts_per_day ?? 1;

  const [confirmWeek, setConfirmWeek] = useState(false);
  const [generatingWeek, setGeneratingWeek] = useState(false);
  const [weekProgress, setWeekProgress] = useState({ current: 0, total: 0 });
  const [draftingPostKey, setDraftingPostKey] = useState<string | null>(null);
  const [draftingLabel, setDraftingLabel] = useState<Record<string, string>>({});
  const [draftedPosts, setDraftedPosts] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [inlineDrafts, setInlineDrafts] = useState<Record<string, string>>({});
  const [sentToQueue, setSentToQueue] = useState<Set<string>>(new Set());

  // Batch selection state
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [batchDrafting, setBatchDrafting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const hasAnySelected = selectedPosts.size > 0;

  // ── Inline feedback (guardrails) ──
  const [feedbackSaved, setFeedbackSaved] = useState<Set<string>>(new Set());

  const handleSaveFeedback = async (
    guardrailType: "never_say" | "never_reference" | "voice_correction",
    content: string,
    postKey: string,
  ) => {
    if (!user?.id || !content.trim()) return;
    const { error } = await (supabase as any)
      .from("user_content_guardrails")
      .insert({ user_id: user.id, guardrail_type: guardrailType, content: content.trim(), source: "inline_feedback" });
    if (error) {
      toast({ title: "Error saving feedback", description: error.message, variant: "destructive" });
      return;
    }
    setFeedbackSaved((prev) => new Set(prev).add(postKey));
    toast({ title: "Threadable will avoid this going forward" });
  };

  const DraftFeedback = ({ hookText, postKey }: { hookText: string; postKey: string }) => {
    const [feedbackType, setFeedbackType] = useState<string | null>(null);
    const [feedbackText, setFeedbackText] = useState(hookText.slice(0, 80));

    if (feedbackSaved.has(postKey)) {
      return <p className="text-[10px] text-emerald-400 mt-1">Feedback saved</p>;
    }

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="text-muted-foreground/40 hover:text-muted-foreground transition-colors mt-1" title="Give feedback">
            <ThumbsDown className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3 space-y-2" side="bottom" align="start">
          <p className="text-xs font-medium text-foreground">What's wrong with this?</p>
          {!feedbackType ? (
            <div className="space-y-1">
              <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors" onClick={() => { setFeedbackType("never_say"); setFeedbackText(hookText.slice(0, 80)); }}>
                I'd never say this
              </button>
              <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors" onClick={() => { setFeedbackType("never_reference"); setFeedbackText(hookText.slice(0, 80)); }}>
                Wrong topic/story
              </button>
              <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors" onClick={() => { setFeedbackType("voice_correction"); setFeedbackText(""); }}>
                Tone is off
              </button>
              <button className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors" onClick={() => { setFeedbackType("voice_correction"); setFeedbackText(""); }}>
                Off-brand
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={feedbackType === "voice_correction" ? "Describe the tone issue..." : "Edit the flagged text..."}
                className="text-xs h-8"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleSaveFeedback(feedbackType as any, feedbackText, postKey)}>
                  Save feedback
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setFeedbackType(null)}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  // Query scheduled posts for this week to show drafted/scheduled status
  const { data: weekScheduledPosts } = useQuery({
    queryKey: ["content-plan-scheduled", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("scheduled_posts")
        .select("id, scheduled_for, status, content_category, text_content, source")
        .eq("user_id", user.id)
        .in("status", ["draft", "approved", "scheduled", "published"])
        .order("scheduled_for", { ascending: true });
      return data ?? [];
    },
    enabled: !!user?.id && !!plan,
  });

  // Safe date parsing helper
  const safeISOString = (date: Date): string | null => {
    try {
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch {
      return null;
    }
  };

  // Safe time parsing helper — handles "HH:MM", "H:MM AM", "H:MM AM EST" etc.
  const parseTimeFlexible = (timeStr: string): { hours: number; minutes: number } | null => {
    try {
      const trimmed = timeStr.trim();
      // Try AM/PM on raw string FIRST (before stripping any suffix)
      const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (ampmMatch) {
        let h = parseInt(ampmMatch[1], 10);
        const m = parseInt(ampmMatch[2], 10);
        const period = ampmMatch[3].toUpperCase();
        if (period === "PM" && h < 12) h += 12;
        if (period === "AM" && h === 12) h = 0;
        if (h < 0 || h > 23 || m < 0 || m > 59) return null;
        return { hours: h, minutes: m };
      }
      // Strip timezone suffixes (EST, PST, CST) then retry AM/PM
      const cleaned = trimmed.replace(/\s+[A-Z]{2,4}$/i, "").trim();
      const ampmMatch2 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (ampmMatch2) {
        let h = parseInt(ampmMatch2[1], 10);
        const m = parseInt(ampmMatch2[2], 10);
        const period = ampmMatch2[3].toUpperCase();
        if (period === "PM" && h < 12) h += 12;
        if (period === "AM" && h === 12) h = 0;
        if (h < 0 || h > 23 || m < 0 || m > 59) return null;
        return { hours: h, minutes: m };
      }
      // 24-hour format "HH:MM"
      const [h, m] = cleaned.split(":").map(Number);
      if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
      return { hours: h, minutes: m };
    } catch {
      return null;
    }
  };

  // Get the date for a named day in the current week, combined with a time string
  const getScheduledDateTime = (dayName: string, timeStr: string): string | null => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayIdx = dayNames.indexOf(dayName);
    if (dayIdx === -1) return null;

    const now = new Date();
    let diff = dayIdx - now.getDay();
    if (diff < 0) diff += 7;
    const date = new Date(now);
    date.setDate(now.getDate() + diff);

    const parsed = parseTimeFlexible(timeStr);
    if (parsed) {
      date.setHours(parsed.hours, parsed.minutes, 0, 0);
    } else {
      date.setHours(9, 0, 0, 0); // fallback
    }

    return safeISOString(date);
  };

  // Match plan posts to already-scheduled posts to show status badges
  const getPostStatus = (dayName: string, post: any, postIndex: number): string | null => {
    if (!weekScheduledPosts?.length) return null;
    const time = getPostTime(dayName, postIndex);
    const scheduledDateTime = getScheduledDateTime(dayName, time);
    if (!scheduledDateTime) return null;
    // Use local time for date comparison to avoid UTC date shifting
    const targetDateObj = new Date(scheduledDateTime);
    const targetDate = targetDateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

    const match = weekScheduledPosts.find((sp: any) => {
      if (!sp.scheduled_for) return false;
      const spDate = new Date(sp.scheduled_for).toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
      if (spDate !== targetDate) return false;
      // Only match by hook text content, not just archetype (archetypes repeat across days)
      if (post.hook_idea && sp.text_content?.includes(post.hook_idea.slice(0, 30))) return true;
      return false;
    });
    return match?.status ?? null;
  };

  const statusBadgeConfig: Record<string, { label: string; className: string }> = {
    draft: { label: "Drafted", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
    approved: { label: "Scheduled", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
    scheduled: { label: "Scheduled", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
    published: { label: "Published", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  };

  // Collect all posts from the plan
  const getAllPlanPosts = () => {
    if (!plan?.daily_plan) return [];

    const allPosts: any[] = [];

    plan.daily_plan.forEach((dayPlan: any) => {
      const dayName = dayPlan.day;
      if (!dayPlan.posts || !Array.isArray(dayPlan.posts)) return;

      dayPlan.posts.forEach((post: any, index: number) => {
        const time = getPostTime(dayName, index);
        const scheduledTime = getScheduledDateTime(dayName, time);
        if (!scheduledTime) return;

        allPosts.push({
          archetype: post.archetype,
          funnel_stage: post.funnel_stage,
          topic: post.topic,
          hook_idea: post.hook_idea || "",
          draft_length_signal: post.draft_length_signal || undefined,
          emotional_trigger: post.emotional_trigger || undefined,
          day: dayName,
          scheduled_time: scheduledTime,
          _postKey: `${dayName}-${index}`,
        });
      });
    });

    return allPosts;
  };

  const handleRegeneratePlan = async () => {
    setConfirmWeek(false);
    if (!session?.access_token) return;

    setGeneratingWeek(true);
    try {
      await generate.mutateAsync();
      toast({ title: "Week plan regenerated! 🎉" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingWeek(false);
    }
  };

  const handleInlineDraft = async (post: any, dayName: string, postIndex: number) => {
    const key = `${dayName}-${postIndex}`;
    if (!session?.access_token) return;

    setDraftingPostKey(key);
    try {
      // Use the actual time slot for this post (today_best_times for today, best_times for future days)
      const actualTime = getPostTime(dayName, postIndex);
      // Reuse getScheduledDateTime for consistent date+time calculation
      const isoString = getScheduledDateTime(dayName, actualTime);
      console.log(`[handleInlineDraft] day=${dayName} postIndex=${postIndex} actualTime=${actualTime} isoString=${isoString}`);
      if (!isoString) throw new Error("Failed to create valid scheduled time");

      const res = await supabase.functions.invoke("generate-draft-posts", {
        body: {
          posts: [{
            archetype: post.archetype,
            funnel_stage: post.funnel_stage,
            topic: post.topic,
            hook_idea: post.hook_idea || "",
            draft_length_signal: post.draft_length_signal || undefined,
            emotional_trigger: post.emotional_trigger || undefined,
            day: dayName,
            scheduled_time: isoString,
          }],
          current_timestamp: new Date().toISOString(),
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
      setDraftingLabel((prev) => ({ ...prev, [key]: "Drafting..." }));
      setTimeout(() => setDraftingLabel((prev) => ({ ...prev, [key]: "Drafted ✓" })), 1200);
    } catch (e: any) {
      toast({ title: "Error drafting post", description: e.message, variant: "destructive" });
    } finally {
      setDraftingPostKey(null);
    }
  };

  const handleSendDraftToQueue = async (key: string) => {
    // The draft was already saved to queue during generation
    setSentToQueue((prev) => new Set(prev).add(key));
    toast({ title: "Draft is in your Content Queue ✅" });
  };

  // ── Batch selection helpers ──
  const togglePostSelection = (postKey: string) => {
    setSelectedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postKey)) next.delete(postKey);
      else next.add(postKey);
      return next;
    });
  };

  const toggleDaySelection = (day: any, dayName: string) => {
    const dayPostKeys = (day.posts || []).map((_: any, i: number) => `${dayName}-${i}`);
    const allSelected = dayPostKeys.every((k: string) => selectedPosts.has(k));
    setSelectedPosts((prev) => {
      const next = new Set(prev);
      for (const k of dayPostKeys) {
        if (allSelected) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  };

  const isDayFullySelected = (day: any, dayName: string) => {
    const dayPostKeys = (day.posts || []).map((_: any, i: number) => `${dayName}-${i}`);
    return dayPostKeys.length > 0 && dayPostKeys.every((k: string) => selectedPosts.has(k));
  };

  const isDayPartiallySelected = (day: any, dayName: string) => {
    const dayPostKeys = (day.posts || []).map((_: any, i: number) => `${dayName}-${i}`);
    return dayPostKeys.some((k: string) => selectedPosts.has(k)) && !dayPostKeys.every((k: string) => selectedPosts.has(k));
  };

  // ── Batch draft handler ──
  const handleBatchDraft = async () => {
    if (!session?.access_token || selectedPosts.size === 0) return;

    const allPlanPosts = getAllPlanPosts();
    const postsToGenerate = allPlanPosts.filter((p) => selectedPosts.has(p._postKey));

    if (postsToGenerate.length === 0) return;

    setBatchDrafting(true);
    setBatchProgress({ current: 0, total: postsToGenerate.length });

    try {
      let generated = 0;
      const batches: any[][] = [];
      for (let i = 0; i < postsToGenerate.length; i += 3) {
        batches.push(postsToGenerate.slice(i, i + 3));
      }

      for (const batch of batches) {
        const res = await supabase.functions.invoke("generate-draft-posts", {
          body: { posts: batch, current_timestamp: new Date().toISOString() },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.error) throw new Error(res.error.message);
        generated += res.data?.total || 0;
        setBatchProgress({ current: generated, total: postsToGenerate.length });

        // Mark each generated post as drafted
        for (const p of batch) {
          setDraftedPosts((prev) => new Set(prev).add(p._postKey));
          setDraftingLabel((prev) => ({ ...prev, [p._postKey]: "Drafted ✓" }));
        }
      }

      toast({
        title: `${generated} posts drafted successfully 🎉`,
        action: (
          <Button size="sm" variant="outline" onClick={() => navigate("/queue")} className="gap-1">
            View Queue
          </Button>
        ),
      });
      setSelectedPosts(new Set());
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBatchDrafting(false);
      setBatchProgress({ current: 0, total: 0 });
    }
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
    const err = generate.error as any;
    const isTimeout = err?.isTimeout;
    const errMsg = isTimeout
      ? "This takes 3-5 minutes for a full 7-day plan. Refresh the page in a moment \u2014 your plan will be ready."
      : (query.error as any)?.message || err?.message || "Something went wrong.";
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <Sparkles className={cn("h-10 w-10", isTimeout ? "text-primary" : "text-destructive")} />
          <p className="text-foreground font-medium">
            {isTimeout ? "Your plan is still generating" : "Something went wrong generating your plan"}
          </p>
          <p className="text-sm text-muted-foreground max-w-md">{errMsg}</p>
          <Button onClick={() => generate.mutate()} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isTimeout ? "Check Again" : "Try Again"}
          </Button>
        </div>
      </div>
    );
  }

  // Check if an entire day is in the past, or if a specific time slot has passed
  const isDayInPast = (dayName: string): boolean => {
    const dayIdx = DAY_NAMES_CHECK.indexOf(dayName);
    if (dayIdx === -1) return false;
    // Today is NEVER in the past
    if (dayIdx === todayIdx) return false;
    const offset = (dayIdx - todayIdx + 7) % 7;
    // Only days with offset >= 6 (i.e. yesterday) are "past" in a 7-day rolling view
    const result = offset >= 6;
    console.log("[isDayInPast]", dayName, "todayIdx=", todayIdx, "dayIdx=", dayIdx, "offset=", offset, "result=", result);
    return result;
  };

  const isSlotPassed = (dayName: string, timeStr: string): boolean => {
    if (isDayInPast(dayName)) return true;
    // For today, NEVER hide slots — user wants to see all posts they just generated
    if (dayName === todayDayName) return false;
    return false;
  };

  // Filter a day's posts to only upcoming slots — for today, return ALL posts
  const getUpcomingPosts = (dayName: string, posts: any[]): { post: any; originalIndex: number }[] => {
    if (!posts) return [];
    const result = posts
      .map((post: any, i: number) => ({ post, originalIndex: i }))
      .filter(({ originalIndex }) => {
        const slotTime = getPostTime(dayName, originalIndex);
        const passed = isSlotPassed(dayName, slotTime);
        return !passed;
      });
    console.log("[getUpcomingPosts]", dayName, "total posts:", posts.length, "upcoming:", result.length);
    return result;
  };

  // Checkbox component for post rows
  const PostCheckbox = ({ postKey }: { postKey: string }) => (
    <div className={cn(
      "transition-opacity",
      hasAnySelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
    )}>
      <Checkbox
        checked={selectedPosts.has(postKey)}
        onCheckedChange={() => togglePostSelection(postKey)}
        className="h-3.5 w-3.5"
      />
    </div>
  );

  // Select All checkbox for day headers
  const DaySelectAll = ({ day, dayName }: { day: any; dayName: string }) => (
    <div className={cn(
      "transition-opacity",
      hasAnySelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
    )}>
      <Checkbox
        checked={isDayFullySelected(day, dayName)}
        // Use indeterminate-like styling via data attribute
        className={cn(
          "h-3.5 w-3.5",
          isDayPartiallySelected(day, dayName) && "opacity-70"
        )}
        onCheckedChange={() => toggleDaySelection(day, dayName)}
      />
    </div>
  );

  
  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Content Plan</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your data-backed content strategy based on your archetypes, identity, and audience.
          </p>
        </div>
        {plan && (
          <Button
            onClick={() => setConfirmWeek(true)}
            disabled={generatingWeek || isGenerating}
            className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            {generatingWeek ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            ✦ Regenerate Week Plan
          </Button>
        )}
      </div>

      {/* Week regeneration progress */}
      {generatingWeek && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium text-foreground">{getProgressMessage(generationElapsed)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isGenerating && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">{getProgressMessage(generationElapsed)}</span>
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
                  <p className="text-sm text-foreground">{originalBestTimes.join(", ")}</p>
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
            {postsPerDay <= 5 ? (
              /* CARD GRID — 1-5 posts/day */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {plan.daily_plan?.filter((day: any) => !isDayInPast(day.day)).map((day: any) => {
                  const upcoming = getUpcomingPosts(day.day, day.posts);
                  console.log("[render-card]", day.day, "upcoming count:", upcoming.length, "isDayInPast:", isDayInPast(day.day));
                  if (upcoming.length === 0) return null;
                  return (
                  <Card key={day.day} className="group">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <DaySelectAll day={day} dayName={day.day} />
                        <p className="text-sm font-bold text-foreground">{day.day}</p>
                      </div>
                      <div className="space-y-2">
                        {upcoming.map(({ post, originalIndex: i }) => {
                          const postKey = `${day.day}-${i}`;
                          const isDrafted = draftedPosts.has(postKey);
                          const isDrafting = draftingPostKey === postKey;
                          const slotTime = getPostTime(day.day, i);
                          const postStatus = getPostStatus(day.day, post, i);
                          const statusCfg = postStatus ? statusBadgeConfig[postStatus] : null;
                          return (
                            <div key={i} className={cn("rounded-lg border border-border p-3 space-y-2 group", postStatus && "opacity-60")}>
                              <div className="flex items-start gap-2">
                                <PostCheckbox postKey={postKey} />
                                <div className="flex-1 space-y-2">
                                  <div className="flex flex-wrap gap-1">
                                    <Badge variant="outline" className="text-[10px]">{post.archetype}</Badge>
                                    <Badge className={`text-[10px] ${FUNNEL_BADGE[post.funnel_stage] || FUNNEL_BADGE.TOF}`}>
                                      {post.funnel_stage}
                                    </Badge>
                                    {statusCfg && (
                                      <Badge variant="outline" className={cn("text-[10px] gap-0.5", statusCfg.className)}>
                                        <Check className="h-2.5 w-2.5" /> {statusCfg.label}
                                      </Badge>
                                    )}
                                    {isDrafted && !postStatus && (
                                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-0.5">
                                        <Check className="h-2.5 w-2.5" /> Drafted
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{post.topic}</p>
                                  {post.hook_idea && (
                                    <p className="text-xs text-foreground/70 italic">"{post.hook_idea}"</p>
                                  )}
                                  {!inlineDrafts[postKey] ? (
                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary p-0 gap-0.5" disabled={isDrafting || !!draftingLabel[postKey]} onClick={() => handleInlineDraft(post, day.day, i)}>
                                      {isDrafting ? <Loader2 className="h-3 w-3 animate-spin" /> : draftingLabel[postKey] ? <><Check className="h-3 w-3 text-emerald-400" /> {draftingLabel[postKey]}</> : <><Zap className="h-3 w-3" /> Draft</>}
                                    </Button>
                                  ) : (
                                    <div className="mt-2 space-y-2 border-t border-border pt-2">
                                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">— Generated Draft —</p>
                                      <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">{inlineDrafts[postKey]}</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {!sentToQueue.has(postKey) ? (
                                          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-0.5" onClick={() => handleSendDraftToQueue(postKey)}>
                                            <Send className="h-2.5 w-2.5" /> Send to Queue
                                          </Button>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-0.5">
                                            <Check className="h-2.5 w-2.5" /> In Queue
                                          </Badge>
                                        )}
                                        <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-0.5" onClick={() => navigate(`/chat?prefill=${encodeURIComponent(inlineDrafts[postKey])}`)}>
                                          <MessageSquare className="h-2.5 w-2.5" /> Edit in Chat
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-0.5" disabled={isDrafting} onClick={() => { setInlineDrafts((prev) => { const n = { ...prev }; delete n[postKey]; return n; }); setSentToQueue((prev) => { const n = new Set(prev); n.delete(postKey); return n; }); handleInlineDraft(post, day.day, i); }}>
                                          <RefreshCw className="h-2.5 w-2.5" /> Regenerate
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                  {(post.hook_idea || inlineDrafts[postKey]) && (
                                    <DraftFeedback hookText={inlineDrafts[postKey] || post.hook_idea || ""} postKey={postKey} />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            ) : postsPerDay <= 10 ? (
              /* COMPACT LIST — 6-10 posts/day */
              <div className="space-y-4">
                {plan.daily_plan?.filter((day: any) => !isDayInPast(day.day)).map((day: any) => {
                  const upcoming = getUpcomingPosts(day.day, day.posts);
                  console.log("[render-list]", day.day, "upcoming count:", upcoming.length, "isDayInPast:", isDayInPast(day.day));
                  if (upcoming.length === 0) return null;
                  return (
                  <Card key={day.day} className="group">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <DaySelectAll day={day} dayName={day.day} />
                        <p className="text-sm font-bold text-foreground">
                          {day.day} <span className="text-muted-foreground font-normal">({upcoming.length} posts)</span>
                        </p>
                      </div>
                      <div className="divide-y divide-border">
                        {upcoming.map(({ post, originalIndex: i }) => {
                          const postKey = `${day.day}-${i}`;
                          const isDrafting = draftingPostKey === postKey;
                          const time = getPostTime(day.day, i);
                          const postStatus = getPostStatus(day.day, post, i);
                          const statusCfg = postStatus ? statusBadgeConfig[postStatus] : null;
                          return (
                            <div key={i} className={cn("flex items-center gap-3 py-2 text-xs group", postStatus && "opacity-60")}>
                              <PostCheckbox postKey={postKey} />
                              <span className="text-muted-foreground font-mono w-14 shrink-0">{time}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">{post.archetype}</Badge>
                              <Badge className={`text-[10px] shrink-0 ${FUNNEL_BADGE[post.funnel_stage] || FUNNEL_BADGE.TOF}`}>
                                {post.funnel_stage}
                              </Badge>
                              <span className="text-muted-foreground truncate flex-1">
                                {post.hook_idea ? `"${post.hook_idea}"` : post.topic}
                              </span>
                              {statusCfg ? (
                                <Badge variant="outline" className={cn("text-[10px] gap-0.5 shrink-0", statusCfg.className)}>
                                  <Check className="h-2.5 w-2.5" /> {statusCfg.label}
                                </Badge>
                              ) : draftedPosts.has(postKey) ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-0.5 shrink-0">
                                  <Check className="h-2.5 w-2.5" /> Drafted
                                </Badge>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary p-0 gap-0.5 shrink-0" disabled={isDrafting || !!draftingLabel[postKey]} onClick={() => handleInlineDraft(post, day.day, i)}>
                                  {isDrafting ? <Loader2 className="h-3 w-3 animate-spin" /> : draftingLabel[postKey] ? <><Check className="h-3 w-3 text-emerald-400" /> {draftingLabel[postKey]}</> : <><Zap className="h-3 w-3" /> Draft</>}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            ) : (
              /* ACCORDION — 11-30 posts/day */
              <div className="space-y-2">
                {plan.daily_plan?.filter((day: any) => !isDayInPast(day.day)).map((day: any) => {
                  const upcoming = getUpcomingPosts(day.day, day.posts);
                  console.log("[render-accordion]", day.day, "upcoming count:", upcoming.length, "isDayInPast:", isDayInPast(day.day));
                  if (upcoming.length === 0) return null;
                  const isOpen = expandedDays.has(day.day);
                  const tofCount = upcoming.filter(({ post }) => post.funnel_stage === "TOF").length;
                  const mofCount = upcoming.filter(({ post }) => post.funnel_stage === "MOF").length;
                  const bofCount = upcoming.filter(({ post }) => post.funnel_stage === "BOF").length;
                  return (
                    <Collapsible
                      key={day.day}
                      open={isOpen}
                      onOpenChange={(open) => {
                        setExpandedDays((prev) => {
                          const n = new Set(prev);
                          if (open) n.add(day.day); else n.delete(day.day);
                          return n;
                        });
                      }}
                    >
                      <Card className="group">
                        <CollapsibleTrigger className="w-full">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <DaySelectAll day={day} dayName={day.day} />
                              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              <p className="text-sm font-bold text-foreground">{day.day}</p>
                              <span className="text-xs text-muted-foreground">
                                {upcoming.length} posts
                              </span>
                            </div>
                            <div className="flex gap-2 text-[10px]">
                              <Badge className={cn("text-[10px]", FUNNEL_BADGE.TOF)}>{tofCount} TOF</Badge>
                              <Badge className={cn("text-[10px]", FUNNEL_BADGE.MOF)}>{mofCount} MOF</Badge>
                              <Badge className={cn("text-[10px]", FUNNEL_BADGE.BOF)}>{bofCount} BOF</Badge>
                            </div>
                          </CardContent>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4 divide-y divide-border">
                            {upcoming.map(({ post, originalIndex: i }) => {
                              const postKey = `${day.day}-${i}`;
                              const isDrafting = draftingPostKey === postKey;
                              const time = getPostTime(day.day, i);
                              const postStatus = getPostStatus(day.day, post, i);
                              const statusCfg = postStatus ? statusBadgeConfig[postStatus] : null;
                              return (
                                <div key={i} className={cn("flex items-center gap-3 py-2 text-xs group", postStatus && "opacity-60")}>
                                  <PostCheckbox postKey={postKey} />
                                  <span className="text-muted-foreground font-mono w-14 shrink-0">{time}</span>
                                  <Badge variant="outline" className="text-[10px] shrink-0">{post.archetype}</Badge>
                                  <Badge className={`text-[10px] shrink-0 ${FUNNEL_BADGE[post.funnel_stage] || FUNNEL_BADGE.TOF}`}>
                                    {post.funnel_stage}
                                  </Badge>
                                  <span className="text-muted-foreground truncate flex-1">
                                    {post.hook_idea ? `"${post.hook_idea}"` : post.topic}
                                  </span>
                                  {statusCfg ? (
                                    <Badge variant="outline" className={cn("text-[10px] gap-0.5 shrink-0", statusCfg.className)}>
                                      <Check className="h-2.5 w-2.5" /> {statusCfg.label}
                                    </Badge>
                                  ) : draftedPosts.has(postKey) ? (
                                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-0.5 shrink-0">
                                      <Check className="h-2.5 w-2.5" /> Drafted
                                    </Badge>
                                  ) : (
                                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary p-0 gap-0.5 shrink-0" disabled={isDrafting || !!draftingLabel[postKey]} onClick={() => handleInlineDraft(post, day.day, i)}>
                                      {isDrafting ? <Loader2 className="h-3 w-3 animate-spin" /> : draftingLabel[postKey] ? <><Check className="h-3 w-3 text-emerald-400" /> {draftingLabel[postKey]}</> : <><Zap className="h-3 w-3" /> Draft</>}
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
              </div>
            )}
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
            <AlertDialogTitle>Regenerate This Week's Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Refresh all hook ideas and topics for the week based on your strategy. This updates your content plan only — no posts will be created. Use the Draft buttons to generate actual posts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegeneratePlan}>Regenerate Plan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Floating Action Bar for batch selection ── */}
      {(hasAnySelected || batchDrafting) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
          <Card className="border-primary/30 shadow-xl shadow-primary/10">
            <CardContent className="p-3 flex items-center gap-4">
              {batchDrafting ? (
                <div className="flex items-center gap-3 px-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    Drafting {batchProgress.current} of {batchProgress.total}...
                  </span>
                  <Progress value={(batchProgress.current / Math.max(batchProgress.total, 1)) * 100} className="h-1.5 w-32" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <span className="font-medium">{selectedPosts.size} post{selectedPosts.size !== 1 ? "s" : ""} selected</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleBatchDraft}
                    className="gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Draft All
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedPosts(new Set())}
                    className="text-muted-foreground"
                  >
                    Clear
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
