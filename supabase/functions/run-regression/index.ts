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
    const userId = claimsData.claims.sub as string;

    // Fetch posts
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: posts, error: postsErr } = await adminClient
      .from("posts_analyzed")
      .select("*")
      .eq("user_id", userId)
      .eq("source", "own");

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

    const targets = ["views", "engagement_rate", "virality_score"] as const;

    // Extract numeric arrays
    const featureVecs: Record<string, number[]> = {};
    const targetVecs: Record<string, number[]> = {};

    for (const f of [...boolFeatures, ...numFeatures, "day_of_week" as const]) {
      featureVecs[f] = [];
    }
    for (const t of targets) {
      targetVecs[t] = [];
    }

    for (const p of posts) {
      for (const f of boolFeatures) {
        featureVecs[f].push(p[f] ? 1 : 0);
      }
      for (const f of numFeatures) {
        featureVecs[f].push(p[f] ?? 0);
      }
      featureVecs["day_of_week"].push(DAY_INDEX[p.day_of_week as string] ?? 0);
      for (const t of targets) {
        targetVecs[t].push(p[t] ?? 0);
      }
    }

    const allFeatureNames = [...boolFeatures, ...numFeatures, "day_of_week"];

    // ── Correlations ──

    type CorrelationEntry = { feature: string; r_views: number; r_engagement: number; r_virality: number };
    const correlations: CorrelationEntry[] = allFeatureNames.map((f) => ({
      feature: f,
      r_views: pearson(featureVecs[f], targetVecs["views"]),
      r_engagement: pearson(featureVecs[f], targetVecs["engagement_rate"]),
      r_virality: pearson(featureVecs[f], targetVecs["virality_score"]),
    }));

    // Top positive & negative predictors by views correlation
    const sortedByViews = [...correlations].sort((a, b) => b.r_views - a.r_views);
    const topPositive = sortedByViews.slice(0, 5).map((c) => ({
      feature: c.feature,
      correlation: +c.r_views.toFixed(3),
    }));
    const topNegative = [...correlations]
      .sort((a, b) => a.r_views - b.r_views)
      .slice(0, 3)
      .map((c) => ({ feature: c.feature, correlation: +c.r_views.toFixed(3) }));

    // ── Boolean feature lifts ──

    const boolLifts: Record<string, { with_avg: number; without_avg: number; lift: number }> = {};
    for (const f of boolFeatures) {
      const withViews: number[] = [];
      const withoutViews: number[] = [];
      posts.forEach((p, i) => {
        const v = targetVecs["views"][i];
        if (p[f]) withViews.push(v); else withoutViews.push(v);
      });
      const wAvg = mean(withViews);
      const woAvg = mean(withoutViews);
      boolLifts[f] = { with_avg: Math.round(wAvg), without_avg: Math.round(woAvg), lift: liftPct(wAvg, woAvg) };
    }

    // ── Day of week analysis ──

    const dayStats: Record<string, { views: number[]; eng: number[] }> = {};
    for (const d of DAYS) dayStats[d] = { views: [], eng: [] };
    posts.forEach((p, i) => {
      const d = p.day_of_week as string;
      if (dayStats[d]) {
        dayStats[d].views.push(targetVecs["views"][i]);
        dayStats[d].eng.push(targetVecs["engagement_rate"][i]);
      }
    });

    const dayAverages = DAYS.map((d) => ({
      day: d,
      avg_views: Math.round(mean(dayStats[d].views)),
      avg_engagement: +mean(dayStats[d].eng).toFixed(2),
      count: dayStats[d].views.length,
    })).filter((d) => d.count > 0);

    const bestDay = [...dayAverages].sort((a, b) => b.avg_views - a.avg_views)[0] || { day: "N/A", avg_views: 0, avg_engagement: 0 };

    // ── Hour analysis ──

    const hourStats: Record<number, { views: number[]; eng: number[] }> = {};
    posts.forEach((p, i) => {
      const h = p.hour_posted ?? 0;
      if (!hourStats[h]) hourStats[h] = { views: [], eng: [] };
      hourStats[h].views.push(targetVecs["views"][i]);
      hourStats[h].eng.push(targetVecs["engagement_rate"][i]);
    });

    const hourAverages = Object.entries(hourStats).map(([h, s]) => ({
      hour: Number(h),
      avg_views: Math.round(mean(s.views)),
      avg_engagement: +mean(s.eng).toFixed(2),
      count: s.views.length,
    }));

    const bestHour = [...hourAverages].sort((a, b) => b.avg_views - a.avg_views)[0] || { hour: 0, avg_views: 0, avg_engagement: 0 };

    // ── Optimal word count range ──

    const sortedByEng = [...posts].sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0));
    const topQuartile = sortedByEng.slice(0, Math.max(3, Math.ceil(posts.length * 0.25)));
    const topWordCounts = topQuartile.map((p) => p.word_count ?? 0).sort((a, b) => a - b);
    const optimalWordCount = {
      min: topWordCounts[0] ?? 0,
      max: topWordCounts[topWordCounts.length - 1] ?? 0,
    };

    // ── Human-readable insights ──

    const humanInsights: string[] = [];

    if (boolLifts.has_credibility_marker.lift > 0) {
      humanInsights.push(`Posts with credibility markers get ${boolLifts.has_credibility_marker.lift}% more views`);
    }
    if (boolLifts.has_question.lift !== 0) {
      const dir = boolLifts.has_question.lift > 0 ? "more" : "fewer";
      humanInsights.push(`Questions get ${Math.abs(boolLifts.has_question.lift)}% ${dir} views`);
    }
    if (bestDay.day !== "N/A") {
      humanInsights.push(`Your best day is ${bestDay.day} with avg ${bestDay.avg_views.toLocaleString()} views`);
    }
    humanInsights.push(`Best posting hour is ${bestHour.hour}:00 with avg ${bestHour.avg_views.toLocaleString()} views`);
    if (optimalWordCount.max > 0) {
      humanInsights.push(`Top posts are ${optimalWordCount.min}-${optimalWordCount.max} words long`);
    }
    if (boolLifts.has_emoji.lift !== 0) {
      const dir = boolLifts.has_emoji.lift > 0 ? "more" : "fewer";
      humanInsights.push(`Posts with emojis get ${Math.abs(boolLifts.has_emoji.lift)}% ${dir} views`);
    }
    if (boolLifts.has_url.lift < -10) {
      humanInsights.push(`Including URLs reduces views by ${Math.abs(boolLifts.has_url.lift)}%`);
    }

    // ── Build final insights object ──

    const regressionInsights = {
      top_positive_predictors: topPositive,
      top_negative_predictors: topNegative,
      best_posting_day: { day: bestDay.day, avg_views: bestDay.avg_views, avg_engagement: bestDay.avg_engagement },
      best_posting_hour: { hour: bestHour.hour, avg_views: bestHour.avg_views, avg_engagement: bestHour.avg_engagement },
      optimal_word_count_range: optimalWordCount,
      credibility_marker_lift: boolLifts.has_credibility_marker.lift,
      question_lift: boolLifts.has_question.lift,
      boolean_feature_lifts: boolLifts,
      day_averages: dayAverages,
      hour_averages: hourAverages,
      correlations,
      human_readable_insights: humanInsights,
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
