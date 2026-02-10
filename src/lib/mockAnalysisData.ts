// Mock analysis data with power law distribution + Pearson correlation

export interface MockThread {
  id: number;
  title: string;
  views: number;
  likes: number;
  comments: number;
  reposts: number;
  follows: number;
  engRate: number;
  followRate: number;
  archetype: "Vault Drop" | "Truth Bomb" | "Hot Take" | "Window";
  tags: string[];
}

type MockThreadInput = Omit<MockThread, "engRate" | "followRate"> & { engRate?: number; followRate?: number };


export interface CorrelationRow {
  variable: string;
  rViews: number;
  rLikes: number;
  rReposts: number;
  rFollows: number;
  rLikeRate: number;
  rRepostRate: number;
  rFollowRate: number;
  count: number;
}

const THREAD_DATA_RAW: MockThreadInput[] = [
  { id: 1, title: "I tracked 147 cold DMs over 6 months. Here's the exact framework that got 23% reply rate:", views: 41200, likes: 1847, comments: 312, reposts: 487, follows: 891, archetype: "Vault Drop", tags: ["authority", "educational", "dollar", "emotional"] },
  { id: 2, title: "The uncomfortable truth about 'posting consistently':", views: 28900, likes: 1203, comments: 198, reposts: 621, follows: 412, archetype: "Truth Bomb", tags: ["vulnerability", "universal", "emotional"] },
  { id: 3, title: "I spent $47K on ads before I realized organic was 3x better. Here's what I'd do differently:", views: 19800, likes: 987, comments: 267, reposts: 398, follows: 534, archetype: "Vault Drop", tags: ["authority", "dollar", "educational", "vivid"] },
  { id: 4, title: "Unpopular opinion: Most 'personal brands' are just ego projects with no revenue model.", views: 15600, likes: 723, comments: 445, reposts: 312, follows: 287, archetype: "Hot Take", tags: ["controversy", "emotional", "profanity"] },
  { id: 5, title: "Stop optimizing your bio. Start optimizing your first line.", views: 12300, likes: 567, comments: 89, reposts: 234, follows: 178, archetype: "Truth Bomb", tags: ["universal", "short", "emotional"] },
  { id: 6, title: "Just lost my biggest client. Sitting in my car processing. Here's what I'm thinking:", views: 11200, likes: 845, comments: 312, reposts: 123, follows: 267, archetype: "Window", tags: ["vulnerability", "vivid", "emotional"] },
  { id: 7, title: "5 pricing mistakes that cost me $120K in my first year:", views: 9800, likes: 534, comments: 156, reposts: 289, follows: 345, archetype: "Vault Drop", tags: ["authority", "dollar", "educational"] },
  { id: 8, title: "Your content isn't bad. Your hooks are.", views: 8900, likes: 412, comments: 67, reposts: 198, follows: 134, archetype: "Truth Bomb", tags: ["universal", "short"] },
  { id: 9, title: "Every 'guru' telling you to post 3x/day is selling you a course, not giving you a strategy.", views: 8100, likes: 389, comments: 278, reposts: 167, follows: 198, archetype: "Hot Take", tags: ["controversy", "emotional", "profanity"] },
  { id: 10, title: "Behind the scenes of how I write 10 posts in 45 minutes:", views: 7600, likes: 423, comments: 134, reposts: 178, follows: 223, archetype: "Window", tags: ["vivid", "educational"] },
  { id: 11, title: "I analyzed 500 viral threads. The pattern nobody talks about:", views: 6200, likes: 312, comments: 98, reposts: 156, follows: 189, archetype: "Vault Drop", tags: ["authority", "educational", "emotional"] },
  { id: 12, title: "Engagement pods are the MLM of social media.", views: 5800, likes: 287, comments: 198, reposts: 134, follows: 87, archetype: "Hot Take", tags: ["controversy", "short", "profanity"] },
  { id: 13, title: "The best content strategy is having something worth saying.", views: 5200, likes: 267, comments: 45, reposts: 189, follows: 67, archetype: "Truth Bomb", tags: ["universal", "short"] },
  { id: 14, title: "Real talk: I almost quit last Tuesday. Then this happened:", views: 4800, likes: 345, comments: 167, reposts: 89, follows: 134, archetype: "Window", tags: ["vulnerability", "vivid", "emotional"] },
  { id: 15, title: "3 copywriting frameworks that doubled my engagement in 30 days:", views: 4500, likes: 234, comments: 78, reposts: 123, follows: 178, archetype: "Vault Drop", tags: ["authority", "educational"] },
  { id: 16, title: "Nobody cares about your morning routine.", views: 3900, likes: 198, comments: 134, reposts: 87, follows: 45, archetype: "Truth Bomb", tags: ["short", "controversy"] },
  { id: 17, title: "I charge $500/hr and my competitors charge $50. Here's why both are right:", views: 3400, likes: 178, comments: 89, reposts: 67, follows: 98, archetype: "Hot Take", tags: ["dollar", "controversy", "authority"] },
  { id: 18, title: "Recording this from my garage office at 11pm. The unsexy truth about building in public:", views: 3100, likes: 198, comments: 112, reposts: 45, follows: 87, archetype: "Window", tags: ["vulnerability", "vivid"] },
  { id: 19, title: "If your hook doesn't stop the scroll in 0.5 seconds, your post is dead.", views: 2800, likes: 145, comments: 34, reposts: 78, follows: 56, archetype: "Truth Bomb", tags: ["universal", "emotional", "vivid"] },
  { id: 20, title: "The $0 marketing stack I used to get my first 10K followers:", views: 2500, likes: 134, comments: 67, reposts: 89, follows: 123, archetype: "Vault Drop", tags: ["dollar", "educational", "authority"] },
  { id: 21, title: "Controversial: B2B content should be MORE emotional, not less.", views: 2200, likes: 112, comments: 89, reposts: 56, follows: 78, archetype: "Hot Take", tags: ["controversy", "emotional"] },
  { id: 22, title: "Just shipped a feature nobody asked for. Here's why:", views: 1900, likes: 98, comments: 56, reposts: 34, follows: 45, archetype: "Window", tags: ["vivid", "vulnerability"] },
  { id: 23, title: "Your audience doesn't want 'value'. They want to feel seen.", views: 1700, likes: 89, comments: 23, reposts: 67, follows: 34, archetype: "Truth Bomb", tags: ["universal", "emotional"] },
  { id: 24, title: "How I structure a Vault Drop post (step by step):", views: 1500, likes: 78, comments: 45, reposts: 34, follows: 67, archetype: "Vault Drop", tags: ["educational"] },
  { id: 25, title: "Hot take: Threads is better than Twitter for B2B. Fight me.", views: 1300, likes: 67, comments: 89, reposts: 23, follows: 34, archetype: "Hot Take", tags: ["controversy", "short"] },
  { id: 26, title: "Sitting in a coffee shop rewriting my entire offer. Live updates:", views: 1100, likes: 56, comments: 34, reposts: 12, follows: 23, archetype: "Window", tags: ["vivid", "vulnerability"] },
  { id: 27, title: "Stop trying to go viral. Start trying to go specific.", views: 900, likes: 45, comments: 12, reposts: 23, follows: 18, archetype: "Truth Bomb", tags: ["short", "universal"] },
  { id: 28, title: "My exact content calendar template (steal this):", views: 800, likes: 34, comments: 23, reposts: 12, follows: 34, archetype: "Vault Drop", tags: ["educational", "authority"] },
  { id: 29, title: "Generic hot takes are the worst performing content type. Period.", views: 600, likes: 23, comments: 34, reposts: 8, follows: 12, archetype: "Hot Take", tags: ["controversy", "short"] },
  { id: 30, title: "Quick behind the scenes: testing a new hook format today:", views: 450, likes: 18, comments: 12, reposts: 5, follows: 8, archetype: "Window", tags: ["vivid"] },
];

// Enrich with rates
const THREAD_DATA: MockThread[] = THREAD_DATA_RAW.map((t) => ({
  ...t,
  engRate: parseFloat((((t.likes + t.comments + t.reposts) / t.views) * 100).toFixed(2)),
  followRate: parseFloat(((t.follows / t.views) * 100).toFixed(2)),
}));

export function getMockThreads(): MockThread[] {
  return THREAD_DATA;
}

// Pearson correlation coefficient
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : parseFloat((num / den).toFixed(3));
}

const TAG_VARIABLE_MAP: Record<string, string> = {
  authority: "Authority Name-Drop",
  educational: "Educational / Steps Format",
  dollar: "Dollar Amount in Hook",
  vulnerability: "Vulnerability / Personal",
  universal: "Universal Relatability",
  short: "Short One-Liner",
  vivid: "Vivid Visual / Scene",
  profanity: "Profanity",
  controversy: "Controversy / Hot Take",
  emotional: "2+ Emotional Triggers",
};

export function computeCorrelations(): CorrelationRow[] {
  const threads = getMockThreads();
  const tagKeys = Object.keys(TAG_VARIABLE_MAP);

  return tagKeys.map((tag) => {
    const hasTag = threads.map((t) => (t.tags.includes(tag) ? 1 : 0));
    const count = hasTag.filter((v) => v === 1).length;

    return {
      variable: TAG_VARIABLE_MAP[tag],
      rViews: pearson(hasTag, threads.map((t) => t.views)),
      rLikes: pearson(hasTag, threads.map((t) => t.likes)),
      rReposts: pearson(hasTag, threads.map((t) => t.reposts)),
      rFollows: pearson(hasTag, threads.map((t) => t.follows)),
      rLikeRate: pearson(hasTag, threads.map((t) => t.likes / Math.max(t.views, 1))),
      rRepostRate: pearson(hasTag, threads.map((t) => t.reposts / Math.max(t.views, 1))),
      rFollowRate: pearson(hasTag, threads.map((t) => t.follows / Math.max(t.views, 1))),
      count,
    };
  });
}

export function getArchetypeStats() {
  const threads = getMockThreads();
  const archetypes = ["Vault Drop", "Truth Bomb", "Hot Take", "Window"] as const;

  return archetypes.map((archetype) => {
    const group = threads.filter((t) => t.archetype === archetype);
    const n = group.length;
    if (n === 0) return { archetype, count: 0, avgViews: 0, avgLikes: 0, avgFollows: 0, avgReposts: 0, medianViews: 0, followRate: 0 };

    const sorted = [...group].sort((a, b) => a.views - b.views);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1].views + sorted[n / 2].views) / 2 : sorted[Math.floor(n / 2)].views;

    return {
      archetype,
      count: n,
      avgViews: Math.round(group.reduce((s, t) => s + t.views, 0) / n),
      avgLikes: Math.round(group.reduce((s, t) => s + t.likes, 0) / n),
      avgFollows: Math.round(group.reduce((s, t) => s + t.follows, 0) / n),
      avgReposts: Math.round(group.reduce((s, t) => s + t.reposts, 0) / n),
      medianViews: Math.round(median),
      followRate: parseFloat(((group.reduce((s, t) => s + t.follows, 0) / group.reduce((s, t) => s + t.views, 0)) * 100).toFixed(2)),
    };
  });
}

export function getOverviewKPIs() {
  const threads = getMockThreads();
  const totalViews = threads.reduce((s, t) => s + t.views, 0);
  const totalFollows = threads.reduce((s, t) => s + t.follows, 0);
  const totalReposts = threads.reduce((s, t) => s + t.reposts, 0);
  const sortedViews = [...threads].sort((a, b) => a.views - b.views);
  const n = threads.length;
  const medianViews = n % 2 === 0 ? Math.round((sortedViews[n / 2 - 1].views + sortedViews[n / 2].views) / 2) : sortedViews[Math.floor(n / 2)].views;
  const topPost = [...threads].sort((a, b) => b.engRate - a.engRate)[0];

  return {
    totalPosts: n,
    avgViews: Math.round(totalViews / n),
    medianViews,
    totalFollows,
    followRate: parseFloat(((totalFollows / totalViews) * 100).toFixed(2)),
    totalReposts,
    repostRate: parseFloat(((totalReposts / totalViews) * 100).toFixed(2)),
    topEngRate: topPost.engRate,
    topEngPost: topPost.title.slice(0, 40) + "...",
  };
}

export function getDistributionInsight() {
  const threads = getMockThreads();
  const sorted = [...threads].sort((a, b) => b.views - a.views);
  const totalViews = threads.reduce((s, t) => s + t.views, 0);
  const top3Views = sorted.slice(0, 3).reduce((s, t) => s + t.views, 0);
  const top3Pct = Math.round((top3Views / totalViews) * 100);
  const sortedAsc = [...threads].sort((a, b) => a.views - b.views);
  const n = threads.length;
  const median = n % 2 === 0 ? Math.round((sortedAsc[n / 2 - 1].views + sortedAsc[n / 2].views) / 2) : sortedAsc[Math.floor(n / 2)].views;
  return { top3Pct, median };
}

// Playbook: 10 ready-to-post threads
export interface PlaybookThread {
  archetype: "Vault Drop" | "Truth Bomb" | "Hot Take" | "Window";
  score: number;
  goal: string;
  hookType: string;
  emotionalTriggers: string[];
  text: string;
  whyItWorks: string;
}

export function getPlaybookThreads(): PlaybookThread[] {
  return [
    {
      archetype: "Vault Drop", score: 6, goal: "Follows + Saves",
      hookType: "Data-backed claim", emotionalTriggers: ["Curiosity", "Aspiration"],
      text: "I tracked every piece of content I posted for 90 days.\n\nHere's the exact breakdown of what drove follows vs. what drove views:\n\n1. Educational threads → 72% of new follows\n2. Hot takes → highest view count but lowest follow rate\n3. Behind-the-scenes → most DMs per impression\n4. One-liners → best repost rate\n\nThe takeaway: Views ≠ Growth. Follows come from UTILITY.",
      whyItWorks: "Opens with a specific, verifiable data point. Uses numbered framework for scannability. Ends with a contrarian insight that reframes the metric people obsess over."
    },
    {
      archetype: "Truth Bomb", score: 5, goal: "Reposts + Reach",
      hookType: "Universal truth", emotionalTriggers: ["Recognition", "Defiance"],
      text: "Your best content comes from your worst experiences.",
      whyItWorks: "Under 15 words. Hits Recognition (everyone's been there) and Defiance (reframes pain as advantage). Highly repostable because it makes the sharer look wise."
    },
    {
      archetype: "Hot Take", score: 5, goal: "Comments + Targeted Follows",
      hookType: "Contrarian opener", emotionalTriggers: ["Defiance", "Curiosity"],
      text: "Unpopular opinion: Posting 3x/day is destroying your brand.\n\nHere's what nobody tells you:\n\n→ Quantity dilutes quality perception\n→ Your audience can't keep up\n→ You train the algorithm to expect filler\n→ One great post > five mediocre ones\n\nPost LESS. Make each one count.",
      whyItWorks: "Attacks a widely-held belief in the niche. Specific to content creators (not generic). The framework format adds credibility to the contrarian claim."
    },
    {
      archetype: "Window", score: 5, goal: "Trust + DMs",
      hookType: "Real-time update", emotionalTriggers: ["Belonging", "Curiosity"],
      text: "Just rewrote my entire offer suite. Sitting in my office at 11:47pm.\n\nOld model: 3 tiers, confusing pricing, 12% close rate\nNew model: 1 offer, premium price, simple yes/no\n\nI'm terrified and excited. Will report back in 30 days.",
      whyItWorks: "Present tense creates urgency. Specific details (11:47pm, 12% close rate) build trust. Vulnerability + competence is the most powerful combo for conversions."
    },
    {
      archetype: "Vault Drop", score: 6, goal: "Follows + Saves",
      hookType: "Authority claim", emotionalTriggers: ["Aspiration", "FOMO"],
      text: "I've helped 340+ creators grow past 10K followers.\n\nThe ones who grow fastest all do this:\n\n1. They pick ONE archetype and master it first\n2. They write hooks before content\n3. They study competitors weekly\n4. They treat every post as an experiment\n5. They never post without scoring it first\n\nSimple ≠ Easy. But it works.",
      whyItWorks: "Authority name-drop in line 1 (340+ creators). Numbered list is saveable. Each point is actionable. Closing line is memorable and repostable."
    },
    {
      archetype: "Truth Bomb", score: 5, goal: "Reposts + Reach",
      hookType: "Counterintuitive truth", emotionalTriggers: ["Recognition", "Humor"],
      text: "The best marketing strategy is being so good people screenshot your posts.",
      whyItWorks: "Short, punchy, universally shareable. Self-referential humor — sharing this post IS the behavior it describes."
    },
    {
      archetype: "Hot Take", score: 4, goal: "Comments",
      hookType: "Industry callout", emotionalTriggers: ["Defiance", "FOMO"],
      text: "90% of 'thought leadership' on Threads is just recycled Twitter threads from 2021.\n\nIf your content could've been written by anyone in your niche, it's not thought leadership. It's thought followership.\n\nOriginal data > Original opinions > Recycled wisdom.",
      whyItWorks: "Attacks a common behavior without attacking individuals. The hierarchy at the end gives people a framework to self-evaluate. Comment-bait: people will defend or agree."
    },
    {
      archetype: "Window", score: 5, goal: "Trust + Warm Leads",
      hookType: "Behind-the-scenes reveal", emotionalTriggers: ["Curiosity", "Belonging"],
      text: "Behind the scenes of how I write 10 posts in 45 minutes:\n\n→ Open my swipe file (5 min)\n→ Pick 2 hooks that match today's archetype\n→ Write the body in 3 min per post\n→ Score each post on the 6-point checklist\n→ Cut anything below 4/6\n→ Schedule the survivors\n\nThat's it. No magic. Just a system.",
      whyItWorks: "Specific time claims create intrigue. Step-by-step format is saveable. 'No magic, just a system' builds trust and positions as approachable expert."
    },
    {
      archetype: "Vault Drop", score: 5, goal: "Follows",
      hookType: "Surprising data point", emotionalTriggers: ["Curiosity", "Aspiration"],
      text: "I spent $0 on ads and grew to 15K followers in 4 months.\n\nHere are the 3 non-obvious things that actually moved the needle:\n\n1. I replied to 20 large accounts daily (borrowed audience)\n2. I posted my worst failures, not just wins\n3. I used the same 4 hook templates on rotation\n\nGrowth isn't creative. It's systematic.",
      whyItWorks: "Dollar amount + timeline in hook creates specificity. 'Non-obvious' signals insider knowledge. Each point is contrarian to common advice."
    },
    {
      archetype: "Truth Bomb", score: 5, goal: "Reposts + Reach",
      hookType: "Bold universal claim", emotionalTriggers: ["Defiance", "Recognition"],
      text: "Nobody ever built a real business by 'adding value' in the comments section.",
      whyItWorks: "Challenges a widely recommended tactic. Under 15 words. Provocative enough to generate both agreement and disagreement reposts."
    },
  ];
}
