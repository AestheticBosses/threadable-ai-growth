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
export function parsePostIdeas(text: string): PostIdea[] {
  const ideas: PostIdea[] = [];

  // --- Pattern A: **1. Title** or **1) Title** ---
  const patternA = /\*\*\s*\d+[\.\)]\s*(.+?)\*\*\s*\n([\s\S]*?)(?=\*\*\s*\d+[\.\)]|$)/g;
  // --- Pattern B: 1. **Title** ---
  const patternB = /(?:^|\n)\s*\d+[\.\)]\s*\*\*(.+?)\*\*\s*\n([\s\S]*?)(?=(?:\n\s*\d+[\.\)])|$)/g;
  // --- Pattern C: ### 1. Title or ## 1. Title ---
  const patternC = /(?:^|\n)\s*#{1,4}\s*\d+[\.\)]\s*(.+?)\s*\n([\s\S]*?)(?=(?:\n\s*#{1,4}\s*\d+[\.\)])|$)/g;
  // --- Pattern D: plain numbered  1. Title (no bold, no headers) ---
  const patternD = /(?:^|\n)\s*(\d+)[\.\)]\s+(.+?)\n([\s\S]*?)(?=(?:\n\s*\d+[\.\)])|$)/g;

  const tryPattern = (pattern: RegExp, titleGroup: number, bodyGroup: number): PostIdea[] => {
    const result: PostIdea[] = [];
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const rawTitle = match[titleGroup].trim().replace(/\*\*/g, "");
      const rawBody = match[bodyGroup].trim();

      // Extract archetype and funnel stage if present
      const archetypeMatch = rawBody.match(/Archetype:\s*(.+)/i);
      const funnelMatch = rawBody.match(/Funnel\s*Stage:\s*(.+)/i);

      let description = rawBody
        .replace(/Archetype:\s*.+/gi, "")
        .replace(/Funnel\s*Stage:\s*.+/gi, "")
        .replace(/\*\*/g, "")
        .trim();

      // Remove trailing dashes/bullets that are just formatting
      description = description.replace(/\n[-•]\s*$/g, "").trim();

      result.push({
        title: rawTitle,
        body: description,
        archetype: archetypeMatch?.[1]?.trim(),
        funnelStage: funnelMatch?.[1]?.trim(),
      });
    }
    return result;
  };

  // Try patterns in order of specificity
  for (const [pattern, tg, bg] of [
    [patternA, 1, 2],
    [patternB, 1, 2],
    [patternC, 1, 2],
    [patternD, 2, 3],
  ] as [RegExp, number, number][]) {
    const result = tryPattern(pattern, tg, bg);
    if (result.length >= 2) return result;
  }

  // Fallback: split by double newlines
  const blocks = text.split(/\n\n+/).filter((b) => b.trim().length > 20);
  if (blocks.length >= 2) {
    return blocks.slice(0, 6).map((block, i) => {
      const lines = block.trim().split("\n");
      const title = lines[0].replace(/^[\d.\-*#]+\s*/, "").replace(/\*\*/g, "").trim() || `Idea ${i + 1}`;
      const bodyLines = lines.slice(1).join("\n").trim();
      const archetypeMatch = bodyLines.match(/Archetype:\s*(.+)/i);
      const funnelMatch = bodyLines.match(/Funnel\s*Stage:\s*(.+)/i);
      let body = bodyLines
        .replace(/Archetype:\s*.+/gi, "")
        .replace(/Funnel\s*Stage:\s*.+/gi, "")
        .trim();
      return {
        title,
        body: body || block.trim(),
        archetype: archetypeMatch?.[1]?.trim(),
        funnelStage: funnelMatch?.[1]?.trim(),
      };
    });
  }

  // Single block fallback
  return [{ title: "Post Idea", body: text.trim() }];
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
