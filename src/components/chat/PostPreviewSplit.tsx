import { useState } from "react";
import { ArrowLeft, CalendarDays, Send, Pencil, RefreshCw, Loader2, Upload, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThreadsPreview } from "./ThreadsPreview";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PostPreviewSplitProps {
  postContent: string;
  analysis: string;
  displayName: string;
  username: string;
  profilePicUrl?: string | null;
  threadsConnected?: boolean;
  onBack: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

interface AnalysisData {
  angle: string;
  hook: string;
  content: string;
  ending: string;
  improvements: string[];
}

function tryParseAnalysisJSON(text: string): AnalysisData | null {
  try {
    // Try to extract JSON from response (may have markdown code fences)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    // Also try raw JSON
    const braceStart = jsonStr.indexOf("{");
    const braceEnd = jsonStr.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd !== -1) {
      jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
    }
    const parsed = JSON.parse(jsonStr);
    if (parsed.angle && parsed.hook && parsed.content && parsed.ending) {
      return {
        angle: parsed.angle,
        hook: parsed.hook,
        content: parsed.content,
        ending: parsed.ending,
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      };
    }
    return null;
  } catch {
    return null;
  }
}

function fallbackCleanAnalysis(text: string): string {
  // Strip markdown headers and AI preamble
  return text
    .replace(/^#{1,3}\s*/gm, "")
    .replace(/^\*\*?(Analysis|Here's an analysis)[^*]*\*?\*?:?\s*/i, "")
    .replace(/\*\*/g, "")
    .trim();
}

export function PostPreviewSplit({
  postContent,
  analysis,
  displayName,
  username,
  profilePicUrl,
  threadsConnected = false,
  onBack,
  onRegenerate,
  isRegenerating,
}: PostPreviewSplitProps) {
  const { user } = useAuth();
  const [editableContent, setEditableContent] = useState(postContent);
  const [isEditing, setIsEditing] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const parsedAnalysis = analysis ? tryParseAnalysisJSON(analysis) : null;

  const saveToQueue = async (status: string, scheduledFor?: Date) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("scheduled_posts")
        .insert({
          user_id: user.id,
          text_content: editableContent,
          status,
          scheduled_for: scheduledFor?.toISOString() || null,
          ai_generated: true,
          source: "chat",
        } as any);
      if (error) throw error;
      toast({
        title: status === "scheduled" ? "Scheduled!" : "Added to queue",
        description: status === "scheduled" ? "Post has been scheduled." : "Post added to your content queue.",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const publishToThreads = async () => {
    if (!user) return;
    setIsPublishing(true);
    try {
      // Save post to queue first
      const { data: insertedPost, error: insertError } = await supabase
        .from("scheduled_posts")
        .insert({
          user_id: user.id,
          text_content: editableContent,
          status: "approved",
          ai_generated: true,
          source: "chat",
        } as any)
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Call publish-post edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/publish-post`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ postId: (insertedPost as any).id }),
        }
      );

      const result = await resp.json();

      if (!resp.ok || result.error) {
        const errMsg = result.error || "Publishing failed";
        if (errMsg.toLowerCase().includes("expired") || errMsg.toLowerCase().includes("reconnect")) {
          toast({
            title: "Connection expired",
            description: "Your Threads connection has expired. Reconnect in Settings.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Failed to publish",
            description: errMsg,
            variant: "destructive",
          });
        }
        return;
      }

      setPublished(true);
      toast({ title: "Published to Threads! 🎉", description: "Your post is now live." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsPublishing(false);
    }
  };

  const renderAnalysis = () => {
    if (!analysis) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing post...
        </div>
      );
    }

    if (parsedAnalysis) {
      const sections = [
        { label: "ANGLE", text: parsedAnalysis.angle },
        { label: "HOOK", text: parsedAnalysis.hook },
        { label: "CONTENT", text: parsedAnalysis.content },
        { label: "ENDING", text: parsedAnalysis.ending },
      ];

      return (
        <div className="space-y-4">
          {sections.map((s) => (
            <div key={s.label}>
              <h4 className="text-[10px] font-bold tracking-widest text-primary mb-1">{s.label}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
            </div>
          ))}
          {parsedAnalysis.improvements.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold tracking-widest text-primary mb-1">OPTIONAL IMPROVEMENTS</h4>
              <ul className="text-xs text-muted-foreground leading-relaxed space-y-1">
                {parsedAnalysis.improvements.map((imp, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-muted-foreground/60 mt-0.5">•</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Fallback: clean and display raw text
    return (
      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {fallbackCleanAnalysis(analysis)}
      </p>
    );
  };

  return (
    <div className="max-w-[900px] mx-auto px-4 py-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to ideas
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Why this post works */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Why this post works</h3>
          {renderAnalysis()}
        </div>

        {/* Right: Threads Preview + Actions */}
        <div className="space-y-4">
          <ThreadsPreview
            content={editableContent}
            displayName={displayName}
            username={username}
            profilePicUrl={profilePicUrl}
            isEditing={isEditing}
            onContentChange={setEditableContent}
          />

          {/* Action buttons */}
          <div className="space-y-2">
            {/* Row 1: Primary actions */}
            <div className="grid grid-cols-2 gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button
                        size="sm"
                        className="gap-2 text-xs w-full bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white"
                        onClick={() => setShowPublishConfirm(true)}
                        disabled={!threadsConnected || isPublishing || published || isSaving}
                      >
                        {published ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Published
                          </>
                        ) : isPublishing ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5" /> Publish to Threads
                          </>
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!threadsConnected && (
                    <TooltipContent>
                      <p>Connect your Threads account in Settings to publish directly</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-xs" disabled={isSaving || isPublishing}>
                    <CalendarDays className="h-3.5 w-3.5" /> Schedule
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduleDate}
                    onSelect={(date) => {
                      setScheduleDate(date);
                      if (date) saveToQueue("scheduled", date);
                    }}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Row 2: Secondary actions */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Pencil className="h-3.5 w-3.5" /> {isEditing ? "Done" : "Edit"}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-xs"
                onClick={onRegenerate}
                disabled={isRegenerating}
              >
                {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Regenerate
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => saveToQueue("draft")}
                disabled={isSaving || isPublishing}
              >
                <Send className="h-3.5 w-3.5" /> To Queue
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Publish confirmation dialog */}
      <AlertDialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post this to Threads now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately publish your post to Threads. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={publishToThreads}>Publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
