import { useState } from "react";
import { BookOpen, Package, FileText, BarChart3, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatContextData } from "@/hooks/useChatContextData";

interface ContextSelectionProps {
  contextData: ChatContextData;
  onSend: (contextText: string) => void;
  onBack: () => void;
}

interface SelectedItem {
  type: "story" | "offer" | "knowledge" | "post";
  index: number;
  label: string;
  content: string;
}

export function ContextSelection({ contextData, onSend, onBack }: ContextSelectionProps) {
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const { stories, offers, knowledge, topPosts } = contextData;

  const isSelected = (type: string, index: number) =>
    selected.some((s) => s.type === type && s.index === index);

  const toggle = (item: SelectedItem) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.type === item.type && s.index === item.index);
      if (exists) return prev.filter((s) => !(s.type === item.type && s.index === item.index));
      return [...prev, item];
    });
  };

  const handleSend = () => {
    if (selected.length === 0) return;
    const contextParts = selected.map((s) => `[${s.type.toUpperCase()}: ${s.label}]\n${s.content}`);
    const contextText = `Generate 5 post ideas based on this context:\n\n${contextParts.join("\n\n")}`;
    onSend(contextText);
  };

  return (
    <div className="max-w-[600px] mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground text-sm">← Back</button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-lg">💡</span>
        <h2 className="text-lg font-semibold text-foreground">What do you want your post ideas to be about?</h2>
      </div>

      {/* Knowledge Base */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Knowledge base ({knowledge.length} items)</span>
        </div>
        <p className="text-xs text-muted-foreground">Add your expertise and experiences to get personalized post ideas</p>
        {knowledge.length === 0 ? (
          <a href="/knowledge-base" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="h-3 w-3" /> Add Info
          </a>
        ) : (
          <div className="space-y-2">
            {knowledge.map((k, i) => (
              <button
                key={k.id}
                onClick={() => toggle({ type: "knowledge", index: i, label: k.title, content: k.content || k.title })}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 text-xs transition-all",
                  isSelected("knowledge", i)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card hover:border-primary/30 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium truncate">{k.title}</span>
                  </div>
                  {isSelected("knowledge", i) && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Stories */}
      {stories.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">My stories</span>
          </div>
          <div className="space-y-2">
            {stories.map((s, i) => (
              <button
                key={i}
                onClick={() => toggle({ type: "story", index: i, label: s.title, content: `${s.story}\nLesson: ${s.lesson}` })}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 text-xs transition-all",
                  isSelected("story", i)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card hover:border-primary/30 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium truncate">{s.title}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground truncate pl-5.5">{s.story?.slice(0, 80)}...</p>
                  </div>
                  {isSelected("story", i) && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Offers */}
      {offers.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">My offers</span>
          </div>
          <div className="space-y-2">
            {offers.map((o, i) => (
              <button
                key={o.id}
                onClick={() => toggle({ type: "offer", index: i, label: o.name, content: `${o.name}: ${o.description || ""}` })}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 text-xs transition-all",
                  isSelected("offer", i)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card hover:border-primary/30 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium truncate">{o.name}</span>
                    </div>
                    {o.description && <p className="mt-1 text-muted-foreground truncate pl-5.5">{o.description.slice(0, 80)}...</p>}
                  </div>
                  {isSelected("offer", i) && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Top Posts */}
      {topPosts.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Previous posts (top performing)</span>
          </div>
          <div className="space-y-2">
            {topPosts.map((p, i) => (
              <button
                key={p.id}
                onClick={() => toggle({ type: "post", index: i, label: `"${(p.text_content || "").slice(0, 40)}..."`, content: p.text_content })}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 text-xs transition-all",
                  isSelected("post", i)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card hover:border-primary/30 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium truncate">"{(p.text_content || "").slice(0, 50)}..."</span>
                    </div>
                    <p className="mt-1 text-muted-foreground pl-5.5">
                      {(p.views || 0).toLocaleString()} views · {p.engagement_rate ? (p.engagement_rate * 100).toFixed(2) : "0"}% eng
                    </p>
                  </div>
                  {isSelected("post", i) && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Send button */}
      <div className="sticky bottom-0 bg-background pt-3 pb-2">
        <button
          onClick={handleSend}
          disabled={selected.length === 0}
          className={cn(
            "w-full rounded-xl py-3 text-sm font-medium transition-all",
            selected.length > 0
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted/20 text-muted-foreground cursor-not-allowed"
          )}
        >
          {selected.length > 0 ? `Generate ideas from ${selected.length} selected` : "Select context to generate ideas"}
        </button>
      </div>
    </div>
  );
}
