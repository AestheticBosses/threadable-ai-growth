import { format } from "date-fns";
import { Clock, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PostStatusIndicatorProps {
  status: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  threadsMediaId: string | null;
  threadsUsername: string | null;
  errorMessage: string | null;
  onRetry: () => void;
}

export function PostStatusIndicator({
  status,
  scheduledFor,
  publishedAt,
  threadsMediaId,
  threadsUsername,
  errorMessage,
  onRetry,
}: PostStatusIndicatorProps) {
  if (status === "approved" && scheduledFor) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-primary">
        <Clock className="h-3 w-3" />
        <span>Scheduled for {format(new Date(scheduledFor), "MMM d, HH:mm")}</span>
      </div>
    );
  }

  if (status === "published") {
    const threadUrl = threadsMediaId && threadsUsername
      ? `https://threads.net/@${threadsUsername}/post/${threadsMediaId}`
      : null;
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
        <CheckCircle2 className="h-3 w-3" />
        <span>Published {publishedAt ? `at ${format(new Date(publishedAt), "MMM d, HH:mm")}` : ""}</span>
        {threadUrl && (
          <a
            href={threadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 underline hover:no-underline"
          >
            View <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertTriangle className="h-3 w-3" />
        <span className="flex-1">{errorMessage || "Publishing failed"}</span>
        <Button size="sm" variant="outline" onClick={onRetry} className="h-5 text-[10px] px-2">
          Retry
        </Button>
      </div>
    );
  }

  return null;
}
