import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_INDEX: Record<string, number> = Object.fromEntries(DAYS.map((d, i) => [d, i]));

// ── Stats helpers ──

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

// ── Build insights for a given target metric ──

function buildInsights(
  posts: any[],
  featureVecs: Record<string, number[]>,
  targetVec: number[],
  allFeatureNames: string[],
  boolFeatures: readonly string[],
  metricLabel: string,
) {
  // Correlations
  type CorrelationEntry = { feature: string; r: number };
  const correlations: CorrelationEntry[] = allFeatureNames.map((f) => ({
    feature: f,
    r: pearson(featureVecs[f], targetVec),
  }));

  const sortedByR = [...correlations].sort((a, b) => b.r - a.r);
  const topPositive = sortedByR.slice(0, 5).map((c) => ({
    feature: c.feature,
    correlation: +c.r.toFixed(3),
  }));
  const topNegative = [...correlations]
    .sort((a, b) => a.r - b.r)
    .slice(0, 3)
    .map((c) => ({ feature: c.feature, correlation: +c.r.toFixed(3) }));

  // Boolean feature lifts
  const boolLifts: Record<string, { with_avg: number; without_avg: number; lift: number }> = {};
  for (const f of boolFeatures) {
    const withVals: number[] = [];
    const withoutVals: number[] = [];
    posts.forEach((p, i) => {
      const v = targetVec[i];
      if (p[f]) withVals.push(v); else withoutVals.push(v);
    });
    const wAvg = mean(withVals);
    const woAvg = mean(withoutVals);
    boolLifts[f] = { with_avg: Math.round(wAvg), without_avg: Math.round(woAvg), lift: liftPct(wAvg, woAvg) };
  }

  // Day of week analysis
  const dayStats: Record<string, { vals: number[] }> = {};
  for (const d of DAYS) dayStats[d] = { vals: [] };
  posts.forEach((p, i) => {
    const d = p.day_of_week as string;
    if (dayStats[d]) dayStats[d].vals.push(targetVec[i]);
  });

  const dayAverages = DAYS.map((d) => ({
    day: d,
    avg: Math.round(mean(dayStats[d].vals)),
    count: dayStats[d].vals.length,
  })).filter((d) => d.count > 0);

  const bestDay = [...dayAverages].sort((a, b) => b.avg - a.avg)[0] || { day: "N/A", avg: 0 };

  // Hour analysis
  const hourStats: Record<number, number[]> = {};
  posts.forEach((p, i) => {
    const h = p.hour_posted ?? 0;
    if (!hourStats[h]) hourStats[h] = [];
    hourStats[h].push(targetVec[i]);
  });

  const hourAverages = Object.entries(hourStats).map(([h, vals]) => ({
    hour: Number(h),
    avg: Math.round(mean(vals)),
    count: vals.length,
  }));

  const bestHour = [...hourAverages].sort((a, b) => b.avg - a.avg)[0] || { hour: 0, avg: 0 };

  // Optimal word count range
  const sortedByTarget = [...posts]
    .map((p, i) => ({ ...p, _targetVal: targetVec[i] }))
    .sort((a, b) => (b._targetVal ?? 0) - (a._targetVal ?? 0));
  const topQuartile = sortedByTarget.slice(0, Math.max(3, Math.ceil(posts.length * 0.25)));
  const topWordCounts = topQuartile.map((p) => p.word_count ?? 0).sort((a: number, b: number) => a - b);
  const optimalWordCount = {
    min: topWordCounts[0] ?? 0,
    max: topWordCounts[topWordCounts.length - 1] ?? 0,
  };

  // Human-readable insights
  const humanInsights: string[] = [];
  if (boolLifts.has_credibility_marker?.lift > 0) {
    humanInsights.push(`Posts with credibility markers get ${boolLifts.has_credibility_marker.lift}% more ${metricLabel}`);
  }
  if (boolLifts.has_question?.lift !== 0) {
    const dir = boolLifts.has_question.lift > 0 ? "more" : "fewer";
    humanInsights.push(`Questions get ${Math.abs(boolLifts.has_question.lift)}% ${dir} ${metricLabel}`);
  }
  if (bestDay.day !== "N/A") {
    humanInsights.push(`Your best day for ${metricLabel} is ${bestDay.day} with avg ${bestDay.avg.toLocaleString()}`);
  }
  humanInsights.push(`Best posting hour for ${metricLabel} is ${bestHour.hour}:00 with avg ${bestHour.avg.toLocaleString()}`);
  if (optimalWordCount.max > 0) {
    humanInsights.push(`Top posts for ${metricLabel} are ${optimalWordCount.min}-${optimalWordCount.max} words long`);
  }
  if (boolLifts.has_emoji?.lift !== 0) {
    const dir = boolLifts.has_emoji.lift > 0 ? "more" : "fewer";
    humanInsights.push(`Posts with emojis get ${Math.abs(boolLifts.has_emoji.lift)}% ${dir} ${metricLabel}`);
  }
  if (boolLifts.has_url?.lift < -10) {
    humanInsights.push(`Including URLs reduces ${metricLabel} by ${Math.abs(boolLifts.has_url.lift)}%`);
  }

  return {
    top_positive_predictors: topPositive,
    top_negative_predictors: topNegative,
    best_posting_day: { day: bestDay.day, avg: bestDay.avg },
    best_posting_hour: { hour: bestHour.hour, avg: bestHour.avg },
    optimal_word_count_range: optimalWordCount,
    boolean_feature_lifts: boolLifts,
    day_averages: dayAverages,
    hour_averages: hourAverages,
    correlations,
    human_readable_insights: humanInsights,
  };
}

// ── Main ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    let userId: string;

    // Support service-role calls with user_id in body
    if (token === SUPABASE_SERVICE_ROLE_KEY) {
      const body = await req.json().catch(() => ({}));
      if (!body.user_id) {
        return new Response(JSON.stringify({ error: "user_id required for service role calls" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = body.user_id;
    } else {
      const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub as string;
    }

    // Fetch posts
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: posts, error: postsErr } = await adminClient
      .from("posts_analyzed")
      .select("*")
      .eq("user_id", userId);

    if (postsErr) throw postsErr;
    if (!posts || posts.length < 5) {
      return new Response(
        JSON.stringify({ error: "Need at least 5 posts to run regression" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Build feature vectors ──

    const boolFeatures = [
      "has_question", "has_credibility_marker", "has_emoji",
      "has_hashtag", "has_url", "starts_with_number",
    ] as const;

    const numFeatures = [
      "word_count", "char_count", "line_count", "hour_posted",
    ] as const;

    // Extract numeric arrays
    const featureVecs: Record<string, number[]> = {};
    for (const f of [...boolFeatures, ...numFeatures, "day_of_week" as const]) {
      featureVecs[f] = [];
    }

    const viewsVec: number[] = [];
    const repliesVec: number[] = [];

    for (const p of posts) {
      for (const f of boolFeatures) {
        featureVecs[f].push(p[f] ? 1 : 0);
      }
      for (const f of numFeatures) {
        featureVecs[f].push(p[f] ?? 0);
      }
      featureVecs["day_of_week"].push(DAY_INDEX[p.day_of_week as string] ?? 0);
      viewsVec.push(p.views ?? 0);
      repliesVec.push(p.replies ?? 0);
    }

    const allFeatureNames = [...boolFeatures, ...numFeatures, "day_of_week"];

    // ── Run both regressions ──

    const viewsResult = buildInsights(posts, featureVecs, viewsVec, allFeatureNames, boolFeatures, "views");
    const commentsResult = buildInsights(posts, featureVecs, repliesVec, allFeatureNames, boolFeatures, "comments");

    // Merge top 3 from each for backwards compatibility
    const combinedInsights = [
      ...viewsResult.human_readable_insights.slice(0, 3),
      ...commentsResult.human_readable_insights.slice(0, 3),
    ];

    const regressionInsights = {
      views_insights: viewsResult,
      comments_insights: commentsResult,
      human_readable_insights: combinedInsights,
      // Keep legacy top-level fields for backwards compat
      top_positive_predictors: viewsResult.top_positive_predictors,
      top_negative_predictors: viewsResult.top_negative_predictors,
      best_posting_day: viewsResult.best_posting_day,
      best_posting_hour: viewsResult.best_posting_hour,
      optimal_word_count_range: viewsResult.optimal_word_count_range,
      boolean_feature_lifts: viewsResult.boolean_feature_lifts,
      correlations: viewsResult.correlations,
    };

    // ── Store in content_strategies ──

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);

    const { error: insertErr } = await adminClient
      .from("content_strategies")
      .insert({
        user_id: userId,
        regression_insights: regressionInsights,
        week_number: weekNumber,
        year: now.getFullYear(),
        status: "active",
      });

    if (insertErr) {
      console.error("Failed to store regression insights:", insertErr);
    }

    return new Response(JSON.stringify(regressionInsights), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
