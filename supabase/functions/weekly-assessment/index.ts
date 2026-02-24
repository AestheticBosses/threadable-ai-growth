import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserContext } from "../_shared/getUserContext.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Stats helpers (reused from run-regression) ──

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_INDEX: Record<string, number> = Object.fromEntries(DAYS.map((d, i) => [d, i]));

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const mx = mean(x);
  const my = mean(y);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

function liftPct(withVal: number, withoutVal: number): number {
  if (withoutVal === 0) return 0;
  return Math.round(((withVal - withoutVal) / withoutVal) * 100);
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

// ── Regression logic ──

function runRegression(posts: any[]) {
  const boolFeatures = [
    "has_question", "has_credibility_marker", "has_emoji",
    "has_hashtag", "has_url", "starts_with_number",
  ] as const;
  const numFeatures = ["word_count", "char_count", "line_count", "hour_posted"] as const;
  const targets = ["views", "engagement_rate", "virality_score"] as const;

  const featureVecs: Record<string, number[]> = {};
  const targetVecs: Record<string, number[]> = {};
  for (const f of [...boolFeatures, ...numFeatures, "day_of_week" as const]) featureVecs[f] = [];
  for (const t of targets) targetVecs[t] = [];

  for (const p of posts) {
    for (const f of boolFeatures) featureVecs[f].push(p[f] ? 1 : 0);
    for (const f of numFeatures) featureVecs[f].push(p[f] ?? 0);
    featureVecs["day_of_week"].push(DAY_INDEX[p.day_of_week as string] ?? 0);
    for (const t of targets) targetVecs[t].push(p[t] ?? 0);
  }

  const allFeatureNames = [...boolFeatures, ...numFeatures, "day_of_week"];
  const correlations = allFeatureNames.map((f) => ({
    feature: f,
    r_views: pearson(featureVecs[f], targetVecs["views"]),
    r_engagement: pearson(featureVecs[f], targetVecs["engagement_rate"]),
    r_virality: pearson(featureVecs[f], targetVecs["virality_score"]),
  }));

  const sortedByViews = [...correlations].sort((a, b) => b.r_views - a.r_views);
  const topPositive = sortedByViews.slice(0, 5).map((c) => ({ feature: c.feature, correlation: +c.r_views.toFixed(3) }));
  const topNegative = [...correlations].sort((a, b) => a.r_views - b.r_views).slice(0, 3).map((c) => ({ feature: c.feature, correlation: +c.r_views.toFixed(3) }));

  const boolLifts: Record<string, { with_avg: number; without_avg: number; lift: number }> = {};
  for (const f of boolFeatures) {
    const withV: number[] = [], withoutV: number[] = [];
    posts.forEach((p, i) => { if (p[f]) withV.push(targetVecs["views"][i]); else withoutV.push(targetVecs["views"][i]); });
    const wAvg = mean(withV), woAvg = mean(withoutV);
    boolLifts[f] = { with_avg: Math.round(wAvg), without_avg: Math.round(woAvg), lift: liftPct(wAvg, woAvg) };
  }

  const dayStats: Record<string, { views: number[]; eng: number[] }> = {};
  for (const d of DAYS) dayStats[d] = { views: [], eng: [] };
  posts.forEach((p, i) => {
    const d = p.day_of_week as string;
    if (dayStats[d]) { dayStats[d].views.push(targetVecs["views"][i]); dayStats[d].eng.push(targetVecs["engagement_rate"][i]); }
  });
  const dayAverages = DAYS.map((d) => ({ day: d, avg_views: Math.round(mean(dayStats[d].views)), avg_engagement: +mean(dayStats[d].eng).toFixed(2), count: dayStats[d].views.length })).filter((d) => d.count > 0);
  const bestDay = [...dayAverages].sort((a, b) => b.avg_views - a.avg_views)[0] || { day: "N/A", avg_views: 0, avg_engagement: 0 };

  const hourStats: Record<number, { views: number[]; eng: number[] }> = {};
  posts.forEach((p, i) => {
    const h = p.hour_posted ?? 0;
    if (!hourStats[h]) hourStats[h] = { views: [], eng: [] };
    hourStats[h].views.push(targetVecs["views"][i]);
    hourStats[h].eng.push(targetVecs["engagement_rate"][i]);
  });
  const hourAverages = Object.entries(hourStats).map(([h, s]) => ({ hour: Number(h), avg_views: Math.round(mean(s.views)), avg_engagement: +mean(s.eng).toFixed(2), count: s.views.length }));
  const bestHour = [...hourAverages].sort((a, b) => b.avg_views - a.avg_views)[0] || { hour: 0, avg_views: 0 };

  const sortedByEng = [...posts].sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0));
  const topQ = sortedByEng.slice(0, Math.max(3, Math.ceil(posts.length * 0.25)));
  const topWC = topQ.map((p) => p.word_count ?? 0).sort((a, b) => a - b);

  const humanInsights: string[] = [];
  if (boolLifts.has_credibility_marker.lift > 0) humanInsights.push(`Posts with credibility markers get ${boolLifts.has_credibility_marker.lift}% more views`);
  if (boolLifts.has_question.lift !== 0) humanInsights.push(`Questions get ${Math.abs(boolLifts.has_question.lift)}% ${boolLifts.has_question.lift > 0 ? "more" : "fewer"} views`);
  if (bestDay.day !== "N/A") humanInsights.push(`Best day is ${bestDay.day} with avg ${bestDay.avg_views.toLocaleString()} views`);
  humanInsights.push(`Best hour is ${bestHour.hour}:00 with avg ${bestHour.avg_views.toLocaleString()} views`);

  return {
    top_positive_predictors: topPositive,
    top_negative_predictors: topNegative,
    best_posting_day: { day: bestDay.day, avg_views: bestDay.avg_views },
    best_posting_hour: { hour: bestHour.hour, avg_views: bestHour.avg_views },
    optimal_word_count_range: { min: topWC[0] ?? 0, max: topWC[topWC.length - 1] ?? 0 },
    boolean_feature_lifts: boolLifts,
    day_averages: dayAverages,
    hour_averages: hourAverages,
    correlations,
    human_readable_insights: humanInsights,
  };
}

// ── Compute week metrics ──

function computeMetrics(posts: any[]) {
  const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);
  const totalEngagement = posts.reduce((s, p) => s + (p.likes ?? 0) + (p.replies ?? 0) + (p.reposts ?? 0) + (p.shares ?? 0) + (p.quotes ?? 0), 0);
  const avgEngRate = posts.length > 0 ? posts.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / posts.length : 0;
  return { total_views: totalViews, total_engagement: totalEngagement, avg_engagement_rate: +avgEngRate.toFixed(4), total_posts: posts.length };
}

// ── Main ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let userIds: string[] = [];

    const authHeader = req.headers.get("Authorization");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (body.user_id) {
      userIds = [body.user_id];
    } else if (authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY)) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, threads_access_token, threads_user_id, threads_username")
        .not("threads_access_token", "is", null);
      userIds = (profiles || []).map((p: any) => p.id);
    } else if (authHeader?.startsWith("Bearer ")) {
      const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userIds = [claimsData.claims.sub as string];
    }

    if (!userIds.length) {
      return new Response(JSON.stringify({ message: "No users to process" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const userId of userIds) {
      try {
        const report = await processUser(adminClient, userId, ANTHROPIC_API_KEY, SUPABASE_URL);
        results.push({ user_id: userId, status: "ok", report });
      } catch (e) {
        console.error(`Error processing user ${userId}:`, e);
        results.push({ user_id: userId, status: "error", error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processUser(adminClient: any, userId: string, apiKey: string, supabaseUrl: string) {
  const now = new Date();
  const thisWeekStart = new Date(now.getTime() - 7 * 86400000);
  const prevWeekStart = new Date(now.getTime() - 14 * 86400000);

  const { data: thisWeekPosts } = await adminClient
    .from("posts_analyzed")
    .select("*")
    .eq("user_id", userId)
    .gte("posted_at", thisWeekStart.toISOString())
    .lte("posted_at", now.toISOString())
    .order("posted_at", { ascending: true });

  const { data: prevWeekPosts } = await adminClient
    .from("posts_analyzed")
    .select("*")
    .eq("user_id", userId)
    .gte("posted_at", prevWeekStart.toISOString())
    .lt("posted_at", thisWeekStart.toISOString())
    .order("posted_at", { ascending: true });

  const tw = thisWeekPosts || [];
  const pw = prevWeekPosts || [];

  const thisMetrics = computeMetrics(tw);
  const prevMetrics = computeMetrics(pw);

  const changes = {
    views_change: pctChange(thisMetrics.total_views, prevMetrics.total_views),
    engagement_change: pctChange(thisMetrics.total_engagement, prevMetrics.total_engagement),
    avg_engagement_change: pctChange(thisMetrics.avg_engagement_rate, prevMetrics.avg_engagement_rate),
    posts_change: pctChange(thisMetrics.total_posts, prevMetrics.total_posts),
  };

  const sortedByViews = [...tw].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  const topPost = sortedByViews[0] || null;
  const worstPost = sortedByViews[sortedByViews.length - 1] || null;

  const { data: profile } = await adminClient
    .from("profiles")
    .select("threads_access_token, threads_user_id, threads_username")
    .eq("id", userId)
    .single();

  let followerCount: number | null = null;
  if (profile?.threads_access_token && profile?.threads_user_id) {
    try {
      const threadsResp = await fetch(
        `https://graph.threads.net/v1.0/${profile.threads_user_id}?fields=followers_count&access_token=${profile.threads_access_token}`
      );
      if (threadsResp.ok) {
        const threadsData = await threadsResp.json();
        followerCount = threadsData.followers_count ?? null;
      }
    } catch (e) {
      console.error("Failed to fetch Threads follower count:", e);
    }
  }

  if (followerCount !== null) {
    await adminClient.from("follower_snapshots").insert({
      user_id: userId,
      follower_count: followerCount,
      recorded_at: now.toISOString(),
    });
  }

  const { data: prevSnapshot } = await adminClient
    .from("follower_snapshots")
    .select("follower_count")
    .eq("user_id", userId)
    .lt("recorded_at", thisWeekStart.toISOString())
    .order("recorded_at", { ascending: false })
    .limit(1);

  const prevFollowerCount = prevSnapshot?.[0]?.follower_count ?? null;
  const followerGrowth = followerCount !== null && prevFollowerCount !== null
    ? followerCount - prevFollowerCount
    : null;

  const { data: allPosts } = await adminClient
    .from("posts_analyzed")
    .select("*")
    .eq("user_id", userId);

  let regressionInsights: any = null;
  if (allPosts && allPosts.length >= 5) {
    regressionInsights = runRegression(allPosts);
  }

  const { data: currentStrategy } = await adminClient
    .from("content_strategies")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  const activeStrategy = currentStrategy?.[0] ?? null;

  const topPostInfo = topPost
    ? `"${(topPost.text_content || "").slice(0, 300)}" — ${topPost.views} views, ${topPost.likes} likes, ${topPost.replies} replies, ${(topPost.engagement_rate ?? 0).toFixed(2)}% engagement`
    : "No posts this week";

  const worstPostInfo = worstPost && worstPost.id !== topPost?.id
    ? `"${(worstPost.text_content || "").slice(0, 300)}" — ${worstPost.views} views, ${worstPost.likes} likes, ${worstPost.replies} replies, ${(worstPost.engagement_rate ?? 0).toFixed(2)}% engagement`
    : "N/A";

  // Fetch full user context for richer assessment
  const userContext = await getUserContext(adminClient, userId);

  const aiPrompt = `You are Threadable — a data-driven Threads growth analyst. Review this week's performance data and generate actionable insights.

You also know the user's business goals, sales funnel, and target audience. Frame the assessment in terms of their specific goals — not just vanity metrics. For example:
- Are they posting enough BOF content to drive conversions?
- Are their top-performing archetypes being used at the right frequency?
- Is their content moving people through their sales funnel?
- What should they update in their Identity, Voice, or Knowledge Base to improve next week's content?

Always end with 2-3 specific, actionable recommendations tied to their data.

USER CONTEXT:
${userContext}

THIS WEEK: ${JSON.stringify(thisMetrics)}

LAST WEEK: ${JSON.stringify(prevMetrics)}

CHANGE: Views ${changes.views_change}%, Engagement ${changes.engagement_change}%, Avg Engagement Rate ${changes.avg_engagement_change}%, Posts ${changes.posts_change}%

TOP POST: ${topPostInfo}

WORST POST: ${worstPostInfo}

CURRENT STRATEGY: ${JSON.stringify(activeStrategy?.strategy_json || "No strategy set")}

UPDATED REGRESSION INSIGHTS: ${JSON.stringify(regressionInsights?.human_readable_insights || "Not enough data")}

Generate a response with summary, wins, improvements, strategy adjustments, updated content ratios, and focus for next week.`;

  const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      system: "You are Threadable — a data-driven Threads growth analyst. Return ONLY the requested data.",
      messages: [
        { role: "user", content: aiPrompt },
      ],
      tools: [
        {
          name: "weekly_assessment",
          description: "Output the weekly assessment insights",
          input_schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              wins: { type: "array", items: { type: "string" } },
              improvements: { type: "array", items: { type: "string" } },
              strategy_adjustments: { type: "array", items: { type: "string" } },
              updated_content_ratios: {
                type: "object",
                properties: {
                  authority: { type: "number" },
                  engagement: { type: "number" },
                  storytelling: { type: "number" },
                  cta: { type: "number" },
                },
                required: ["authority", "engagement", "storytelling", "cta"],
              },
              focus_for_next_week: { type: "string" },
            },
            required: ["summary", "wins", "improvements", "strategy_adjustments", "updated_content_ratios", "focus_for_next_week"],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: "tool", name: "weekly_assessment" },
    }),
  });

  let aiInsights: any = null;
  if (aiResponse.ok) {
    const aiData = await aiResponse.json();
    const toolUse = aiData.content?.find((block: any) => block.type === "tool_use");
    if (toolUse?.input) {
      aiInsights = toolUse.input;
    } else {
      const textBlock = aiData.content?.find((block: any) => block.type === "text");
      const content = textBlock?.text || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) aiInsights = JSON.parse(jsonMatch[0]);
    }
  } else {
    console.error("Anthropic API error:", aiResponse.status, await aiResponse.text());
  }

  const weekStart = thisWeekStart.toISOString().split("T")[0];
  const weekEnd = now.toISOString().split("T")[0];

  const { data: reportRow, error: reportErr } = await adminClient
    .from("weekly_reports")
    .insert({
      user_id: userId,
      week_start: weekStart,
      week_end: weekEnd,
      total_views: thisMetrics.total_views,
      total_engagement: thisMetrics.total_engagement,
      avg_engagement_rate: thisMetrics.avg_engagement_rate,
      total_posts: thisMetrics.total_posts,
      top_post_id: topPost?.id || null,
      worst_post_id: worstPost?.id || null,
      follower_count_start: prevFollowerCount,
      follower_count_end: followerCount,
      follower_growth: followerGrowth,
      insights: aiInsights,
      strategy_adjustments: aiInsights?.strategy_adjustments || null,
    })
    .select()
    .single();

  if (reportErr) console.error("Failed to save weekly report:", reportErr);

  if (activeStrategy) {
    await adminClient
      .from("content_strategies")
      .update({
        status: "completed",
        performance_vs_previous: {
          ...changes,
          this_week: thisMetrics,
          last_week: prevMetrics,
        },
      })
      .eq("id", activeStrategy.id);
  }

  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);

  await adminClient.from("content_strategies").insert({
    user_id: userId,
    regression_insights: regressionInsights,
    strategy_json: activeStrategy?.strategy_json || null,
    week_number: weekNumber,
    year: now.getFullYear(),
    status: "active",
  });

  return {
    week_start: weekStart,
    week_end: weekEnd,
    this_week: thisMetrics,
    last_week: prevMetrics,
    changes,
    top_post: topPost ? { id: topPost.id, text: (topPost.text_content || "").slice(0, 200), views: topPost.views } : null,
    worst_post: worstPost ? { id: worstPost.id, text: (worstPost.text_content || "").slice(0, 200), views: worstPost.views } : null,
    follower_count: followerCount,
    follower_growth: followerGrowth,
    insights: aiInsights,
    regression_updated: !!regressionInsights,
  };
}
