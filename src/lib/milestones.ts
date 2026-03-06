export const MILESTONE_THRESHOLDS = {
  streak: [7, 14, 30, 60, 100],
  views: [10_000, 50_000, 100_000, 500_000, 1_000_000],
  viral: [10, 5, 1], // top X%
  growth: [100, 200, 500], // % growth
  posts: [10, 25, 50, 100, 250],
};

export interface UserStats {
  streak: number;
  totalViews: number;
  topPostPercentile: number | null;
  growthPct: number | null;
  postsPublished: number;
}

export interface MilestoneHit {
  type: "streak" | "views" | "viral" | "growth" | "posts";
  value: number;
  isNew: boolean;
}

/** Build the milestone key used in shown_milestones array */
export function milestoneKey(type: string, value: number): string {
  return `${type}_${value}`;
}

/** Check if current stats cross any threshold that previous (shown) milestones did not. */
export function checkMilestones(
  current: UserStats,
  shownKeys: string[],
): MilestoneHit[] {
  const shownSet = new Set(shownKeys);
  const hits: MilestoneHit[] = [];

  for (const threshold of MILESTONE_THRESHOLDS.streak) {
    if (current.streak >= threshold) {
      const key = milestoneKey("streak", threshold);
      if (!shownSet.has(key)) {
        hits.push({ type: "streak", value: threshold, isNew: true });
      }
    }
  }

  for (const threshold of MILESTONE_THRESHOLDS.views) {
    if (current.totalViews >= threshold) {
      const key = milestoneKey("views", threshold);
      if (!shownSet.has(key)) {
        hits.push({ type: "views", value: threshold, isNew: true });
      }
    }
  }

  // Viral: lower percentile = better (top 1% > top 5% > top 10%)
  if (current.topPostPercentile !== null) {
    for (const threshold of MILESTONE_THRESHOLDS.viral) {
      if (current.topPostPercentile <= threshold) {
        const key = milestoneKey("viral", threshold);
        if (!shownSet.has(key)) {
          hits.push({ type: "viral", value: threshold, isNew: true });
        }
      }
    }
  }

  if (current.growthPct !== null) {
    for (const threshold of MILESTONE_THRESHOLDS.growth) {
      if (current.growthPct >= threshold) {
        const key = milestoneKey("growth", threshold);
        if (!shownSet.has(key)) {
          hits.push({ type: "growth", value: threshold, isNew: true });
        }
      }
    }
  }

  for (const threshold of MILESTONE_THRESHOLDS.posts) {
    if (current.postsPublished >= threshold) {
      const key = milestoneKey("posts", threshold);
      if (!shownSet.has(key)) {
        hits.push({ type: "posts", value: threshold, isNew: true });
      }
    }
  }

  return hits;
}

/** Returns all milestones the user has currently earned (regardless of whether they are new). */
export function getEarnedMilestones(current: UserStats): MilestoneHit[] {
  const hits: MilestoneHit[] = [];

  for (const threshold of MILESTONE_THRESHOLDS.streak) {
    if (current.streak >= threshold) {
      hits.push({ type: "streak", value: threshold, isNew: false });
    }
  }

  for (const threshold of MILESTONE_THRESHOLDS.views) {
    if (current.totalViews >= threshold) {
      hits.push({ type: "views", value: threshold, isNew: false });
    }
  }

  if (current.topPostPercentile !== null) {
    for (const threshold of MILESTONE_THRESHOLDS.viral) {
      if (current.topPostPercentile <= threshold) {
        hits.push({ type: "viral", value: threshold, isNew: false });
      }
    }
  }

  if (current.growthPct !== null) {
    for (const threshold of MILESTONE_THRESHOLDS.growth) {
      if (current.growthPct >= threshold) {
        hits.push({ type: "growth", value: threshold, isNew: false });
      }
    }
  }

  for (const threshold of MILESTONE_THRESHOLDS.posts) {
    if (current.postsPublished >= threshold) {
      hits.push({ type: "posts", value: threshold, isNew: false });
    }
  }

  return hits;
}

/** Format a milestone for display */
export function getMilestoneLabel(type: MilestoneHit["type"], value: number): { emoji: string; label: string; subtext: string } {
  switch (type) {
    case "streak":
      return { emoji: "\uD83D\uDD25", label: `${value} Day Streak`, subtext: "Consistency compounds" };
    case "views":
      return { emoji: "\uD83D\uDC41\uFE0F", label: `${(value / 1000).toLocaleString()}K Views`, subtext: "Your reach is growing" };
    case "viral":
      return { emoji: "\uD83D\uDEA8", label: `Top ${value}% Engagement`, subtext: "Outperforming the crowd" };
    case "growth":
      return { emoji: "\uD83D\uDCC8", label: `+${value}% Growth`, subtext: "Data, not guesswork" };
    case "posts":
      return { emoji: "\u26A1", label: `${value} Posts Published`, subtext: "Building your engine" };
  }
}
