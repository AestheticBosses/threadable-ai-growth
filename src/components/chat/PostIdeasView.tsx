import { FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PostIdea {
  title: string;
  body: string;
  archetype?: string;
  funnelStage?: string;
}

interface PostIdeasViewProps {
  ideas: PostIdea[];
  onDraft: (idea: PostIdea) => void;
  onBack: () => void;
  rawContent?: string;
}

/**
 * Robust parser for AI-generated post ideas.
 * Handles multiple formats:
 *   **1. Title** ... body
 *   1. **Title** ... body
 *   ### 1. Title ... body
 *   **Title 1:** ... body
 */
export function parsePostIdeas(text: string): PostIdea[] | null {
  if (!text) return null;

  // Split by **NUMBER. TITLE** pattern — handles **1. Title**, **Idea 1: Title**, etc.
  const parts = text.split(/\*\*(?:Idea\s*)?\d+[\.\):\s]\s*/);

  if (parts.length >= 3) {
    // parts[0] is intro text, parts[1..n] start with "Title**\nContent"
    const ideas: PostIdea[] = [];
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const closingBold = part.indexOf("**");
      if (closingBold === -1) continue;

      const title = part.substring(0, closingBold).trim();
      let body = part.substring(closingBold + 2).trim();

      // Extract archetype and funnel stage if present
      const archetypeMatch = body.match(/Archetype:\s*(.+)/i);
      const funnelMatch = body.match(/Funnel\s*Stage:\s*(.+)/i);
      body = body
        .replace(/Archetype:\s*.+/gi, "")
        .replace(/Funnel\s*Stage:\s*.+/gi, "")
        .trim();

      if (title && body) {
        ideas.push({
          title,
          body,
          archetype: archetypeMatch?.[1]?.trim(),
          funnelStage: funnelMatch?.[1]?.trim(),
        });
      }
    }
    if (ideas.length >= 2) return ideas;
  }

  // Fallback: try 1. **Title** (number outside bold)
  const altPattern = /(?:^|\n)\s*\d+[\.\)]\s*\*\*(.+?)\*\*\s*\n([\s\S]*?)(?=(?:\n\s*\d+[\.\)]\s*\*\*)|$)/g;
  const altIdeas: PostIdea[] = [];
  let match;
  while ((match = altPattern.exec(text)) !== null) {
    const title = match[1].trim();
    const body = match[2].trim();
    if (title && body) altIdeas.push({ title, body });
  }
  if (altIdeas.length >= 2) return altIdeas;

  // Fallback: ### 1. Title (headers)
  const headerPattern = /(?:^|\n)\s*#{1,4}\s*\d+[\.\)]\s*(.+?)\s*\n([\s\S]*?)(?=(?:\n\s*#{1,4}\s*\d+[\.\)])|$)/g;
  const headerIdeas: PostIdea[] = [];
  while ((match = headerPattern.exec(text)) !== null) {
    const title = match[1].trim().replace(/\*\*/g, "");
    const body = match[2].trim();
    if (title && body) headerIdeas.push({ title, body });
  }
  if (headerIdeas.length >= 2) return headerIdeas;

  // Can't parse — return null so caller falls back to plain text
  return null;
}

export function PostIdeasView({ ideas, onDraft, onBack, rawContent }: PostIdeasViewProps) {
  return (
    <div className="max-w-[600px] mx-auto px-4 py-6 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to context
      </button>

      <p className="text-sm text-muted-foreground">Here are {ideas.length} post ideas based on your story:</p>

      <div className="space-y-3">
        {ideas.map((idea, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Idea {i + 1}: {idea.title}</h3>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {idea.body.length > 250 ? idea.body.slice(0, 250) + "..." : idea.body}
            </p>
            {(idea.archetype || idea.funnelStage) && (
              <div className="flex gap-2 flex-wrap">
                {idea.archetype && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {idea.archetype}
                  </span>
                )}
                {idea.funnelStage && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground border border-border">
                    {idea.funnelStage}
                  </span>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs text-primary hover:text-primary hover:bg-primary/10 min-h-[44px]"
              onClick={() => onDraft(idea)}
            >
              <FileText className="h-3.5 w-3.5" /> Draft this post
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
