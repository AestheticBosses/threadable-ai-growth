import { Flame, TrendingUp } from "lucide-react";

interface StreakBannerProps {
  streak: number;
}

export function StreakBanner({ streak }: StreakBannerProps) {
  if (streak < 2) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <Flame className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold text-primary">{streak} day posting streak</span>
      </div>
      <TrendingUp className="h-4 w-4 text-primary/60" />
      <span className="text-xs text-muted-foreground">
        {streak >= 7 ? "You're on fire! Keep it going." : "Build momentum — keep posting daily!"}
      </span>
    </div>
  );
}
