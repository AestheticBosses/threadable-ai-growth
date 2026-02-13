import { useState } from "react";
import { ArrowLeft, CalendarDays, Send, Pencil, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThreadsPreview } from "./ThreadsPreview";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface PostPreviewSplitProps {
  postContent: string;
  analysis: string;
  displayName: string;
  username: string;
  profilePicUrl?: string | null;
  onBack: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

function parseAnalysis(text: string) {
  const sections: { heading: string; body: string }[] = [];
  // Match headings like **Angle:** or ## Angle or Angle:
  const lines = text.split("\n");
  let current: { heading: string; body: string } | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(?:\*\*|##?\s*)?(?:\d+\.\s*)?(Angle|Hook|Content|Ending|Optional [Ii]mprovements?)[:\s*]*(.*?)(?:\*\*)?$/i);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { heading: headingMatch[1], body: headingMatch[2]?.trim() || "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) sections.push(current);

  if (sections.length === 0) {
    return [{ heading: "Analysis", body: text }];
  }
  return sections;
}

export function PostPreviewSplit({
  postContent,
  analysis,
  displayName,
  username,
  profilePicUrl,
  onBack,
  onRegenerate,
  isRegenerating,
}: PostPreviewSplitProps) {
  const { user } = useAuth();
  const [editableContent, setEditableContent] = useState(postContent);
  const [isEditing, setIsEditing] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const analysisBlocks = parseAnalysis(analysis);

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
      toast({ title: status === "scheduled" ? "Scheduled!" : "Added to queue", description: status === "scheduled" ? "Post has been scheduled." : "Post added to your content queue." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
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
          {analysis ? (
            <div className="space-y-4">
              {analysisBlocks.map((block, i) => (
                <div key={i}>
                  <h4 className="text-xs font-semibold text-primary mb-1">{block.heading}:</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {block.body.replace(/\*\*/g, "").trim()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing post...
            </div>
          )}
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
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-xs" disabled={isSaving}>
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

            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => saveToQueue("approved")}
              disabled={isSaving}
            >
              <Send className="h-3.5 w-3.5" /> Publish
            </Button>

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
          </div>
        </div>
      </div>
    </div>
  );
}
