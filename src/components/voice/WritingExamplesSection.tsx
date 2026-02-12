import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useWritingStyle } from "@/hooks/useVoiceSettings";
import { cn } from "@/lib/utils";
import threadableIcon from "@/assets/threadable-icon.png";
import { useRef } from "react";

interface StyleCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets?: string[];
  description?: string;
}

const STYLE_CARDS: StyleCard[] = [
  {
    id: "threadable",
    icon: <img src={threadableIcon} alt="" className="h-8 w-8 rounded-lg" />,
    title: "Threadable Style",
    subtitle: "AI-optimized writing for Threads",
    bullets: [
      "Data-driven hooks that stop the scroll",
      "Proven Threads engagement patterns",
      "Smart formatting for mobile readers",
      "Authority-building frameworks",
      "Psychology-based CTAs",
    ],
  },
  {
    id: "personal",
    icon: <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">Y</div>,
    title: "Your Style",
    subtitle: "Click to update your style",
    description: "Connect your account and analyze your voice to unlock your personalized writing style.",
  },
  {
    id: "storyteller",
    icon: <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 text-lg">📖</div>,
    title: "The Storyteller",
    subtitle: "Narrative-driven content",
    description: "Leads with personal narrative. Uses vulnerability and specific details to build connection. Every post reads like a chapter.",
  },
  {
    id: "educator",
    icon: <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-lg">🎓</div>,
    title: "The Educator",
    subtitle: "Knowledge-focused content",
    description: "Breaks down complex topics into digestible insights. Uses frameworks, numbered lists, and clear takeaways.",
  },
  {
    id: "provocateur",
    icon: <div className="h-8 w-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 text-lg">🔥</div>,
    title: "The Provocateur",
    subtitle: "Contrarian, bold content",
    description: "Opens with contrarian takes. Challenges conventional wisdom. Uses strong language and bold claims to drive engagement.",
  },
];

export function WritingExamplesSection() {
  const { selectedStyle, isLoading, saveStyle, isSaving } = useWritingStyle();
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const current = localSelected ?? selectedStyle;

  const handleSave = async () => {
    await saveStyle(current);
    toast({ title: "Writing style saved ✅" });
  };

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Writing examples</h2>
          <p className="text-sm text-muted-foreground">Select a writing style to guide how your posts are generated, or show us your own unique style.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-1 shrink-0">
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save style
        </Button>
      </div>

      <div className="relative">
        <Button
          size="icon"
          variant="outline"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 h-8 w-8 rounded-full hidden md:flex"
          onClick={() => scroll(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 h-8 w-8 rounded-full hidden md:flex"
          onClick={() => scroll(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border">
          {STYLE_CARDS.map((card) => {
            const isActive = current === card.id;
            return (
              <Card
                key={card.id}
                onClick={() => setLocalSelected(card.id)}
                className={cn(
                  "min-w-[240px] max-w-[260px] cursor-pointer transition-all shrink-0",
                  isActive ? "border-primary ring-1 ring-primary/30" : "hover:border-primary/30"
                )}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    {card.icon}
                    {isActive && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{card.title}</p>
                    <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                  </div>
                  {card.bullets && (
                    <ul className="space-y-1">
                      {card.bullets.map((b, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">•</span>{b}
                        </li>
                      ))}
                    </ul>
                  )}
                  {card.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
