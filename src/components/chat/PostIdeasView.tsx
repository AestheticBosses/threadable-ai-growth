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
  const fullText = text;

  // Primary pattern: **1. Title** or **Idea 1: Title** or **1) Title**
  const splitPattern = /\*\*(?:Idea\s*)?\d+[\.\):\s]\s*(.+?)\*\*/g;

  const titles: { title: string; startIndex: number; matchEnd: number }[] = [];
  let match;

  while ((match = splitPattern.exec(fullText)) !== null) {
    titles.push({
      title: match[1].trim(),
      startIndex: match.index,
      matchEnd: match.index + match[0].length,
    });
  }

  // Fallback: 1. **Title** (number outside bold)
  if (titles.length < 2) {
    titles.length = 0;
    const altPattern = /(?:^|\n)\s*\d+[\.\)]\s*\*\*(.+?)\*\*/g;
    while ((match = altPattern.exec(fullText)) !== null) {
      titles.push({
        title: match[1].trim(),
        startIndex: match.index,
        matchEnd: match.index + match[0].length,
      });
    }
  }

  // Fallback: ### 1. Title (headers)
  if (titles.length < 2) {
    titles.length = 0;
    const headerPattern = /(?:^|\n)\s*#{1,4}\s*\d+[\.\)]\s*(.+)/g;
    while ((match = headerPattern.exec(fullText)) !== null) {
      titles.push({
        title: match[1].trim().replace(/\*\*/g, ""),
        startIndex: match.index,
        matchEnd: match.index + match[0].length,
      });
    }
  }

  // Fallback: plain numbered "1. Title" at start of line (short lines only)
  if (titles.length < 2) {
    titles.length = 0;
    const plainPattern = /(?:^|\n)\s*(\d+)[\.\)]\s+(.+)/g;
    while ((match = plainPattern.exec(fullText)) !== null) {
      if (match[2].trim().length < 100) {
        titles.push({
          title: match[2].trim().replace(/\*\*/g, ""),
          startIndex: match.index,
          matchEnd: match.index + match[0].length,
        });
      }
    }
  }

  if (titles.length < 2) {
    // Can't parse — return single idea fallback
    return [{ title: "Post Idea", body: text.trim() }];
  }

  // Extract content between each title
  for (let i = 0; i < titles.length; i++) {
    const contentStart = titles[i].matchEnd;
    const contentEnd = i < titles.length - 1 ? titles[i + 1].startIndex : fullText.length;
    let body = fullText.substring(contentStart, contentEnd).trim();

    // Extract archetype and funnel stage if present
    const archetypeMatch = body.match(/Archetype:\s*(.+)/i);
    const funnelMatch = body.match(/Funnel\s*Stage:\s*(.+)/i);

    body = body
      .replace(/Archetype:\s*.+/gi, "")
      .replace(/Funnel\s*Stage:\s*.+/gi, "")
      .replace(/^\s*\n/, "")
      .trim();

    ideas.push({
      title: titles[i].title,
      body,
      archetype: archetypeMatch?.[1]?.trim(),
      funnelStage: funnelMatch?.[1]?.trim(),
    });
  }

  return ideas;
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
