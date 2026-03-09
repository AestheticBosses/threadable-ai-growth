import { useRef, useState, useCallback } from "react";
import { toPng } from "html-to-image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShareStatCard } from "./ShareStatCard";
import { milestoneKey, type MilestoneHit } from "@/lib/milestones";
import { Download, Copy, Image, ExternalLink, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MilestoneShareModalProps {
  milestone: MilestoneHit;
  user: { name: string; handle: string; avatarUrl?: string };
  meta?: { posts?: number; sevenDayViews?: number };
  onClose: () => void;
  onMarkShown: (key: string) => void;
}

function buildCaption(type: MilestoneHit["type"], value: number, meta?: { posts?: number; sevenDayViews?: number }): string {
  switch (type) {
    case "streak":
      return `\uD83D\uDD25 ${value} day Threads streak.\n\nConsistency compounds.\n\nthreadable.ai`;
    case "views": {
      const formatted = value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : `${Math.round(value / 1000)}K`;
      const detailLine = meta?.sevenDayViews
        ? `${meta.sevenDayViews.toLocaleString()} views in the last 7 days. $0 ad spend.`
        : "";
      return `\uD83D\uDC41\uFE0F ${formatted} total views on Threads.\n\n${detailLine}\n\nthreadable.ai`;
    }
    case "viral":
      return `\uD83D\uDEA8 Top ${value}% engagement pattern detected.\n\nAnalyzed by Threadable AI.\n\nthreadable.ai`;
    case "growth":
      return `\uD83D\uDCC8 +${value}% reach growth in 30 days.\n\nData, not guesswork.\n\nthreadable.ai`;
    case "posts":
      return `\u26A1 ${value} posts published with AI strategy.\n\nNot a content calendar. A CMO.\n\nthreadable.ai`;
  }
}

export function MilestoneShareModal({ milestone, user, meta, onClose, onMarkShown }: MilestoneShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "loading" | "done">("idle");
  const caption = buildCaption(milestone.type, milestone.value, meta);
  const key = milestoneKey(milestone.type, milestone.value);

  const handleClose = useCallback(() => {
    onMarkShown(key);
    onClose();
  }, [key, onMarkShown, onClose]);

  const generatePng = useCallback(async () => {
    if (!cardRef.current) return null;
    return toPng(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#0E1320" });
  }, []);

  const handleShareToThreads = async () => {
    setShareState("loading");
    setBusy(true);

    const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(caption)}`;

    try {
      const dataUrl = await generatePng();
      if (!dataUrl) throw new Error("No card rendered");

      // Download PNG automatically
      const link = document.createElement("a");
      link.download = `threadable-${milestone.type}-${milestone.value}.png`;
      link.href = dataUrl;
      link.click();

      setShareState("done");

      // Open Threads after short delay so user sees confirmation
      setTimeout(() => {
        window.open(threadsUrl, "_blank", "noopener,noreferrer");
      }, 800);
    } catch {
      // If image generation fails, still open Threads with caption
      toast.error("Couldn't generate card — caption is ready in Threads");
      setShareState("idle");
      window.open(threadsUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const dataUrl = await generatePng();
      if (!dataUrl) return;
      const link = document.createElement("a");
      link.download = `threadable-${milestone.type}-${milestone.value}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Image downloaded");
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyImage = async () => {
    setBusy(true);
    try {
      const dataUrl = await generatePng();
      if (!dataUrl) return;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Image copied to clipboard");
    } catch {
      toast.error("Copy failed — try downloading instead");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Caption copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden bg-background border-border">
        <div className="p-5 space-y-4">
          {/* Header badge */}
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/25 animate-pulse">
              Milestone Unlocked
            </span>
          </div>

          <DialogTitle className="text-center text-lg font-bold text-foreground">
            You hit a new milestone
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground -mt-2">
            Your authority is compounding. Share it.
          </p>

          {/* Card preview */}
          <div className="flex justify-center py-2">
            <ShareStatCard
              ref={cardRef}
              variant={milestone.type}
              value={milestone.value}
              user={user}
              meta={meta}
            />
          </div>

          {/* Caption preview */}
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Post Caption</p>
            <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">{caption}</p>
          </div>

          {/* Actions */}
          <div className="space-y-1.5">
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleShareToThreads}
              disabled={busy}
            >
              {shareState === "done" ? (
                <>
                  <Check className="h-4 w-4 mr-1.5" />
                  Card saved — opening Threads...
                </>
              ) : shareState === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Preparing your card...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Share to Threads
                </>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Your card will download automatically — attach it in Threads
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={handleCopyImage} disabled={busy}>
              <Image className="h-3.5 w-3.5 mr-1" />
              Copy Image
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={handleCopyCaption}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Caption
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={handleDownload} disabled={busy}>
              <Download className="h-3.5 w-3.5 mr-1" />
              PNG
            </Button>
          </div>

          {/* Dismiss */}
          <button
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            onClick={handleClose}
          >
            Not now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
