import { FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PostIdea {
  title: string;
  body: string;
}

interface PostIdeasViewProps {
  ideas: PostIdea[];
  onDraft: (idea: PostIdea) => void;
  onBack: () => void;
  rawContent?: string;
}

export function parsePostIdeas(text: string): PostIdea[] {
  const ideas: PostIdea[] = [];
  // Try to match numbered ideas: "Idea 1:", "1.", "**Idea 1:**", etc.
  const patterns = [
    /(?:^|\n)\s*(?:\*\*)?(?:Idea\s*\d+[:.]\s*)(.*?)(?:\*\*)?(?:\n)([\s\S]*?)(?=(?:\n\s*(?:\*\*)?(?:Idea\s*\d+))|$)/gi,
    /(?:^|\n)\s*(?:\d+)\.\s*\*\*(.+?)\*\*\s*\n([\s\S]*?)(?=(?:\n\s*\d+\.)|$)/gi,
    /(?:^|\n)\s*(?:\d+)\.\s*(.+?)\n([\s\S]*?)(?=(?:\n\s*\d+\.)|$)/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length >= 2) {
      for (const m of matches) {
        ideas.push({
          title: m[1].trim().replace(/\*\*/g, ""),
          body: m[2].trim().replace(/\*\*/g, ""),
        });
      }
      return ideas;
    }
  }

  // Fallback: split by double newlines and treat each as an idea
  const blocks = text.split(/\n\n+/).filter((b) => b.trim().length > 20);
  if (blocks.length >= 2) {
    return blocks.slice(0, 6).map((block, i) => {
      const lines = block.trim().split("\n");
      return {
        title: lines[0].replace(/^[\d.\-*#]+\s*/, "").replace(/\*\*/g, "").trim() || `Idea ${i + 1}`,
        body: lines.slice(1).join("\n").trim() || block.trim(),
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

      <p className="text-sm text-muted-foreground">Here are 5 post ideas based on your story:</p>

      <div className="space-y-3">
        {ideas.map((idea, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Idea {i + 1}: {idea.title}</h3>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {idea.body.length > 250 ? idea.body.slice(0, 250) + "..." : idea.body}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => onDraft(idea)}
            >
              <FileText className="h-3.5 w-3.5" /> Draft post
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
