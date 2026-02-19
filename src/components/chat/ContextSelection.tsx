import { useState } from "react";
import { BookOpen, Package, FileText, BarChart3, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatContextData } from "@/hooks/useChatContextData";

interface InlineContextCardsProps {
  contextData: ChatContextData;
  disabled: boolean;
  selectedLabel?: string;
  onSelect: (item: { type: string; label: string; content: string }) => void;
}

export function InlineContextCards({ contextData, disabled, selectedLabel, onSelect }: InlineContextCardsProps) {
  const { stories, offers, knowledge, topPosts } = contextData;

  const isItemSelected = (label: string) => selectedLabel === label;
  const isDisabledItem = (label: string) => disabled && !isItemSelected(label);

  const handleClick = (item: { type: string; label: string; content: string }) => {
    if (disabled) return;
    onSelect(item);
  };

  return (
    <div className="space-y-4 py-2">
      {/* Stories */}
      {stories.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">My stories</span>
          </div>
          <div className="space-y-1.5">
            {stories.map((s, i) => {
              const label = s.title;
              const selected = isItemSelected(label);
              const faded = isDisabledItem(label);
              return (
                <button
                  key={i}
                  onClick={() => handleClick({ type: "story", label, content: `${s.story}\nLesson: ${s.lesson}` })}
                  disabled={disabled}
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2 text-xs transition-all",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : faded
                      ? "border-border bg-card/50 text-muted-foreground/40 cursor-not-allowed"
                      : "border-border bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{label}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Offers */}
      {offers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">My offers</span>
          </div>
          <div className="space-y-1.5">
            {offers.map((o) => {
              const label = o.name;
              const selected = isItemSelected(label);
              const faded = isDisabledItem(label);
              return (
                <button
                  key={o.id}
                  onClick={() => handleClick({ type: "offer", label, content: `${o.name}: ${o.description || ""}` })}
                  disabled={disabled}
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2 text-xs transition-all",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : faded
                      ? "border-border bg-card/50 text-muted-foreground/40 cursor-not-allowed"
                      : "border-border bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{label}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Posts */}
      {topPosts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Previous posts (top performing)</span>
          </div>
          <div className="space-y-1.5">
            {topPosts.map((p) => {
              const label = `"${(p.text_content || "").slice(0, 40)}..."`;
              const selected = isItemSelected(label);
              const faded = isDisabledItem(label);
              return (
                <button
                  key={p.id}
                  onClick={() => handleClick({ type: "post", label, content: p.text_content })}
                  disabled={disabled}
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2 text-xs transition-all",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : faded
                      ? "border-border bg-card/50 text-muted-foreground/40 cursor-not-allowed"
                      : "border-border bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="truncate font-medium block">{label}</span>
                      <span className="text-muted-foreground/60 text-[10px]">
                        {(p.views || 0).toLocaleString()} views · {p.engagement_rate ? p.engagement_rate.toFixed(1) : "0"}% eng
                      </span>
                    </div>
                    {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Knowledge base */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Knowledge base ({knowledge.length} items)</span>
        </div>
        {knowledge.length === 0 ? (
          <a href="/knowledge-base" className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-1">
            <Plus className="h-3 w-3" /> Add Info
          </a>
        ) : (
          <div className="space-y-1.5">
            {knowledge.map((k) => {
              const label = k.title;
              const selected = isItemSelected(label);
              const faded = isDisabledItem(label);
              return (
                <button
                  key={k.id}
                  onClick={() => handleClick({ type: "knowledge", label, content: k.content || k.title })}
                  disabled={disabled}
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2 text-xs transition-all",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : faded
                      ? "border-border bg-card/50 text-muted-foreground/40 cursor-not-allowed"
                      : "border-border bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground cursor-pointer"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{label}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
