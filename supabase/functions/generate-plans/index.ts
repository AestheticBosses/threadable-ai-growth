// updated
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserContext } from "../_shared/getUserContext.ts";
import { fetchJourneyStage, getStageConfig } from "../_shared/journeyStage.ts";
import { safeParseJSON } from "../_shared/safeParseJSON.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Parse a time string like "7:00 AM", "7:00 AM CST", "14:30" into minutes since midnight.
 */
function parseToMinutes(timeStr: string): number {
  const trimmed = timeStr.trim();
  // Try AM/PM on raw string FIRST (before stripping timezone suffix)
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (period === "PM" && h < 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }
  // Strip timezone suffixes (EST, PST, CST) then retry AM/PM
  const cleaned = trimmed.replace(/\s+[A-Z]{2,4}$/i, "").trim();
  const ampmMatch2 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch2) {
    let h = parseInt(ampmMatch2[1], 10);
    const m = parseInt(ampmMatch2[2], 10);
    const period = ampmMatch2[3].toUpperCase();
    if (period === "PM" && h < 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }
  const parts = cleaned.split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

/**
 * Format minutes since midnight back to a time string.
 * Matches the format of the original best times (12h with suffix, or 24h).
 */
function minutesToTimeStr(mins: number, templateStr: string): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  // Detect timezone suffix (CST, EST, etc.) — exclude AM/PM from match
  const suffixMatch = templateStr.match(/\s+([A-Z]{2,4})$/i);
  const tzSuffix = suffixMatch && !/^(AM|PM)$/i.test(suffixMatch[1]) ? suffixMatch[1].toUpperCase() : null;
  const is12h = /AM|PM/i.test(templateStr);
  if (is12h) {
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const base = `${h12}:${String(m).padStart(2, "0")} ${period}`;
    return tzSuffix ? `${base} ${tzSuffix}` : base;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Derive best posting times from regression hour_averages data.
 * Returns top N hours sorted chronologically, formatted as "H:MM AM".
 */
function deriveBestTimes(regressionInsights: any, count: number): string[] {
  const hourAverages = regressionInsights?.hour_averages;
  if (!Array.isArray(hourAverages) || hourAverages.length === 0) {
    console.log("[deriveBestTimes] no hour_averages, using defaults");
    return ["9:00 AM", "12:00 PM", "5:00 PM"]; // sensible defaults
  }
  console.log("[deriveBestTimes] raw hour_averages:", JSON.stringify(hourAverages));

  // Filter out hours with only 1 post (noise) and unreasonable hours (before 6 AM)
  const MIN_POST_COUNT = 2;
  const MIN_HOUR = 6; // 6 AM — don't schedule posts before this
  const filtered = hourAverages.filter((h: any) => (h.count || 0) >= MIN_POST_COUNT && (h.hour ?? 0) >= MIN_HOUR);
  console.log("[deriveBestTimes] after filtering (count>=2, hour>=6):", JSON.stringify(filtered));

  // If filtering removed everything, fall back to all hours >= MIN_HOUR (ignore count)
  const pool = filtered.length > 0 ? filtered : hourAverages.filter((h: any) => (h.hour ?? 0) >= MIN_HOUR);
  if (pool.length === 0) {
    console.log("[deriveBestTimes] no valid hours after filtering, using defaults");
    return ["9:00 AM", "12:00 PM", "5:00 PM"];
  }

  // Take top N hours by avg performance, then sort chronologically
  const topHours = [...pool]
    .sort((a: any, b: any) => (b.avg || 0) - (a.avg || 0))
    .slice(0, count);
  topHours.sort((a: any, b: any) => a.hour - b.hour);
  console.log("[deriveBestTimes] top hours selected:", JSON.stringify(topHours));

  return topHours.map((h: any) => {
    const hour = h.hour ?? 0;
    const period = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:00 ${period}`;
  });
}

/**
 * Generate time slots for today starting from NOW.
 * Filters regression best times to those still in the future,
 * then fills remaining slots between now and 11:00 PM.
 * Supports up to 20 posts with minimum 3-minute gaps.
 */
function generateTodaySlots(
  regressionBestTimes: string[],
  totalPosts: number,
  nowMinutes: number
): string[] {
  const END_OF_DAY = 23 * 60; // 11:00 PM
  const MIN_GAP = 3;
  const template = regressionBestTimes[0] || "9:00 AM";

  // Start 15 min from now, rounded to nearest 5
  const bufferNow = nowMinutes + 15;
  const startMin = Math.ceil(bufferNow / 5) * 5;

  if (startMin >= END_OF_DAY) {
    // Too late — return single slot at end of day
    console.log("[generateTodaySlots] past 11 PM, returning single end-of-day slot");
    return [minutesToTimeStr(END_OF_DAY, template)];
  }

  // Filter regression times to future ones within today's remaining window
  const futureAnchors = regressionBestTimes
    .map(parseToMinutes)
    .filter(m => m >= bufferNow && m <= END_OF_DAY)
    .sort((a, b) => a - b);

  if (futureAnchors.length >= totalPosts) {
    return futureAnchors.slice(0, totalPosts).map(m => minutesToTimeStr(m, template));
  }

  // Start with available future anchors
  const slots = [...futureAnchors];

  // Fill gaps using startMin and END_OF_DAY as virtual boundaries
  while (slots.length < totalPosts) {
    const withBounds = [...new Set([startMin, ...slots, END_OF_DAY])].sort((a, b) => a - b);
    let maxGap = -1, gapStart = 0, gapEnd = 0;
    for (let i = 0; i < withBounds.length - 1; i++) {
      const gap = withBounds[i + 1] - withBounds[i];
      if (gap > maxGap) { maxGap = gap; gapStart = withBounds[i]; gapEnd = withBounds[i + 1]; }
    }
    if (maxGap < MIN_GAP * 2) break; // Can't fit more slots
    const mid = gapStart + Math.floor(maxGap / 2);
    const rounded = Math.round(mid / 5) * 5;
    const clamped = Math.max(gapStart + MIN_GAP, Math.min(rounded, gapEnd - MIN_GAP));
    slots.push(clamped);
    slots.sort((a, b) => a - b);
  }

  const unique = [...new Set(slots)].sort((a, b) => a - b);
  console.log("[generateTodaySlots] nowMinutes:", nowMinutes, "startMin:", startMin, "slots:", JSON.stringify(unique.map(m => minutesToTimeStr(m, template))));
  return unique.slice(0, totalPosts).map(m => minutesToTimeStr(m, template));
}

/**
 * Expand best posting times to fill totalPosts unique slots.
 * Distributes slots across the full waking window (6 AM - 11 PM),
 * using anchor times as seed points and filling gaps iteratively.
 * Supports up to 20 posts with minimum 3-minute gaps.
 * All generated times are rounded to nearest 5 minutes.
 */
function expandTimeSlots(bestTimes: string[], totalPosts: number): string[] {
  const WAKING_START = 6 * 60;  // 6:00 AM = 360 min
  const WAKING_END = 23 * 60;   // 11:00 PM = 1380 min
  const MIN_GAP = 3;

  console.log("[expandTimeSlots] input bestTimes:", JSON.stringify(bestTimes), "totalPosts:", totalPosts);

  if (totalPosts <= bestTimes.length) {
    console.log("[expandTimeSlots] enough anchors, slicing to", totalPosts);
    return bestTimes.slice(0, totalPosts);
  }
  if (bestTimes.length === 0) return ["09:00"];

  const template = bestTimes[0];
  const anchors = bestTimes.map(parseToMinutes)
    .filter(m => m >= WAKING_START && m <= WAKING_END)
    .sort((a, b) => a - b);

  // If all anchors fell outside waking hours, evenly distribute
  if (anchors.length === 0) {
    console.log("[expandTimeSlots] no anchors in waking window, distributing evenly");
    const gap = totalPosts > 1 ? Math.floor((WAKING_END - WAKING_START) / (totalPosts - 1)) : 0;
    return Array.from({ length: totalPosts }, (_, i) => {
      const m = Math.min(WAKING_START + i * gap, WAKING_END);
      return minutesToTimeStr(Math.round(m / 5) * 5, template);
    });
  }

  // Start with anchor points
  const slots = [...anchors];
  console.log("[expandTimeSlots] anchors in waking window:", JSON.stringify(slots.map(m => minutesToTimeStr(m, template))));

  // Iteratively insert at midpoint of largest gap, using waking window as virtual boundaries
  while (slots.length < totalPosts) {
    const withBounds = [...new Set([WAKING_START, ...slots, WAKING_END])].sort((a, b) => a - b);
    let maxGap = -1, gapStart = 0, gapEnd = 0;
    for (let i = 0; i < withBounds.length - 1; i++) {
      const gap = withBounds[i + 1] - withBounds[i];
      if (gap > maxGap) { maxGap = gap; gapStart = withBounds[i]; gapEnd = withBounds[i + 1]; }
    }
    if (maxGap < MIN_GAP * 2) break; // Can't fit more slots
    const mid = gapStart + Math.floor(maxGap / 2);
    const rounded = Math.round(mid / 5) * 5;
    const clamped = Math.max(gapStart + MIN_GAP, Math.min(rounded, gapEnd - MIN_GAP));
    slots.push(clamped);
    slots.sort((a, b) => a - b);
  }

  const unique = [...new Set(slots)].sort((a, b) => a - b);
  console.log("[expandTimeSlots] final slots:", JSON.stringify(unique.map(m => minutesToTimeStr(m, template))));
  return unique.slice(0, totalPosts).map(m => minutesToTimeStr(m, template));
}

const CONTENT_PLAN_PROMPT = `You are Threadable — a data-driven Threads content strategist. Based on the user's identity, archetypes, regression insights, and top-performing content, create a 7-day content plan.

CRITICAL: Vary post lengths dramatically. Some posts should be under 30 words — raw, punchy, identity-driven. Some should be medium (30-80 words). Some can be longer deep-dives (80-150 words). The regression data below tells you what length performs best for this creator — follow it. Short viral posts often outperform long educational ones.

Archetypes are starting points, not constraints. You may create hybrid posts that blend two archetypes, or freestyle posts that don't fit any archetype cleanly. Label hybrid posts with both archetypes (e.g., 'Dad-Founder Confessional × Build-In-Public'). Label pure identity/vulnerability posts as 'Raw Operator'. The goal is authentic variety, not formula adherence. At least 3-4 posts per day should break the archetype mold.

Mix these formats across each day:
- Identity stacks: short posts that layer who you are in one breath (e.g., 'I'm 35 with ADHD, two kids, and building an AI app after bedtime.')
- Data drops: specific numbers from real results, no fluff
- Hot takes: controversial or contrarian one-liners under 20 words
- Story hooks: open a loop in the first line that demands the reader keep going
- Proof posts: screenshots, metrics, or receipts with minimal caption
- Confessionals: raw vulnerability, no lesson attached
Do NOT make every post educational or lesson-based. Most viral posts are identity-first, lesson-second.

Use the regression insights to determine archetype distribution — weight archetypes higher that have proven to drive more views and engagement in the user's data. Do not distribute archetypes evenly unless the data supports it.

Reference the user's sales funnel steps when creating BOF post ideas — use their real offer names, prices, and URLs.

If a BRANDING PLAN and FUNNEL STRATEGY are provided in the context, you MUST use them as direct input:
- Align daily post topics with the brand pillars from the branding plan
- Use the funnel strategy's TOF/MOF/BOF percentages and post ideas to shape funnel_stage distribution
- Reference the branding plan's voice_summary for tone consistency
- Use the funnel strategy's conversion_path to ensure the week builds toward conversion

The creator's profile includes max_posts_per_day. You MUST use this exact number for posts_per_day in your output. Do not default to 1. If max_posts_per_day is 3, output 3 posts per day. If max_posts_per_day is 7, output 7 posts per day. Each day in daily_plan must have exactly posts_per_day posts.

IMPORTANT: Do NOT generate best_times — posting times are derived from regression data and injected separately. Always generate exactly posts_per_day posts for each day. Time slot assignment happens after generation.

Be extremely concise. Each topic must be under 80 characters. Each hook_idea must be one line only, under 100 characters — just the opening hook sentence, nothing more. No multi-line hook ideas. Hook ideas should match the post's target length. For short posts (<30 words), the hook IS the entire post. Don't write a hook that implies a longer post if the post should be short. Total JSON response must be under 6000 tokens.

This keeps hook ideas as short planning seeds. Full post text gets generated later by generate-draft-posts.

FUNNEL MIX RULES for daily schedule:
- BOF posts should be 1-2 per day maximum regardless of posts_per_day setting. Never over-index on BOF — it kills organic reach on Threads.
- Maintain roughly TOF 45-55%, MOF 30-35%, BOF 10-20% across the weekly plan.

Respond ONLY with valid JSON in this format:
{
  "posts_per_day": number,
  "primary_archetypes": [{"name": "...", "percentage": number}],
  "daily_plan": [
    {
      "day": "Monday",
      "posts": [
        {
          "archetype": "archetype name",
          "funnel_stage": "TOF" | "MOF" | "BOF",
          "topic": "brief description of the post angle",
          "hook_idea": "suggested opening line"
        }
      ]
    }
  ],
  "weekly_themes": [
    {
      "theme": "theme name",
      "angles": ["angle 1", "angle 2", "angle 3"]
    }
  ]
}`;
const BRANDING_PLAN_PROMPT = `You are a personal branding strategist for Threads. Based on the user's identity, story, and audience, create a personal branding plan.

Respond ONLY with valid JSON in this format:
{
  "positioning_statement": "one sentence positioning",
  "brand_pillars": [
    {
      "name": "pillar name",
      "description": "2-3 sentences",
      "post_angles": ["angle 1", "angle 2"],
      "related_archetype": "archetype name"
    }
  ],
  "voice_summary": {
    "tone_descriptors": ["word1", "word2", "word3"],
    "do_list": ["rule 1", "rule 2"],
    "dont_list": ["rule 1", "rule 2"]
  },
  "authority_signals": ["proof point 1", "proof point 2"]
}`;

const FUNNEL_STRATEGY_PROMPT = `You are a content funnel strategist. Based on the user's main goal, identity, and archetypes, create a TOF/MOF/BOF funnel strategy for Threads.

FUNNEL MIX RULES (non-negotiable):
The content share percentages are FIXED. Output exactly these numbers, no exceptions:
- TOF: content_percentage must be exactly 50
- MOF: content_percentage must be exactly 30
- BOF: content_percentage must be exactly 20
Do not deviate from these numbers under any circumstances.

The creator's goal_type, traffic_url, dm_keyword, dm_offer, and revenue_target are in their profile. Build the entire funnel strategy around these:
- If goal_type is "drive_traffic", every BOF post must include the traffic_url as the CTA. Shape MOF content to warm audiences toward clicking.
- If goal_type is "get_comments", every BOF post must use the dm_keyword and dm_offer (e.g. "COMMENT [keyword] to get [offer]"). Shape MOF content to build trust toward commenting.
- If goal_type is "grow_audience", BOF focuses on comments, shares, and saves — optimize for algorithmic reach over direct conversion.
- Use revenue_target to calibrate how aggressive the BOF percentage should be.

Respond ONLY with valid JSON in this format:
{
  "main_goal": "user's goal",
  "tof": {
    "purpose": "...",
    "content_percentage": 50,
    "post_ideas": [
      {"idea": "...", "archetype": "...", "hook": "..."}
    ],
    "metrics": ["metric1", "metric2"]
  },
  "mof": {
    "purpose": "...",
    "content_percentage": 30,
    "post_ideas": [
      {"idea": "...", "archetype": "...", "hook": "..."}
    ],
    "metrics": ["metric1", "metric2"]
  },
  "bof": {
    "purpose": "...",
    "content_percentage": 20,
    "post_ideas": [
      {"idea": "...", "archetype": "...", "hook": "..."}
    ],
    "metrics": ["metric1", "metric2"]
  },
  "conversion_path": "description of how stages connect"
}`;

/**
 * Helper: call Anthropic API with timeout and return raw text response.
 */
/**
 * Attempt to recover a truncated JSON response.
 * Finds the last complete object in an array and closes the structure.
 */
function recoverTruncatedJSON(raw: string, expectedPosts: number, batchLabel: string): any {
  // First try normal parse
  try {
    const parsed = safeParseJSON(raw);
    return parsed;
  } catch (_) {
    // Truncation recovery
    console.warn(`[${batchLabel}] JSON parse failed, attempting truncation recovery...`);
    // Try to find last complete object boundary
    const lastCloseBrace = raw.lastIndexOf('}');
    if (lastCloseBrace <= 0) {
      throw new Error(`[${batchLabel}] Cannot recover truncated JSON — no closing brace found`);
    }
    // Check if we're inside an array (daily_plan or posts array)
    // Strategy: trim to last '}', then close any open arrays/objects
    let candidate = raw.substring(0, lastCloseBrace + 1);
    // Count open vs close brackets to figure out what needs closing
    const openBraces = (candidate.match(/{/g) || []).length;
    const closeBraces = (candidate.match(/}/g) || []).length;
    const openBrackets = (candidate.match(/\[/g) || []).length;
    const closeBrackets = (candidate.match(/\]/g) || []).length;
    // Close any unclosed structures
    for (let i = 0; i < openBrackets - closeBrackets; i++) candidate += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) candidate += '}';
    try {
      const recovered = safeParseJSON(candidate);
      const recoveredDays = recovered?.daily_plan?.length ?? 0;
      const recoveredPosts = recovered?.daily_plan?.reduce((sum: number, d: any) => sum + (d.posts?.length ?? 0), 0) ?? 0;
      console.warn(`[${batchLabel}] TRUNCATION RECOVERY: recovered ${recoveredDays} days, ${recoveredPosts} posts (expected ~${expectedPosts} total posts)`);
      return recovered;
    } catch (e2) {
      console.error(`[${batchLabel}] Truncation recovery failed:`, e2);
      throw new Error(`[${batchLabel}] JSON parse and recovery both failed`);
    }
  }
}

async function callAnthropicForPlan(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  timeoutMs: number = 120000,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error:", res.status, errText);
      throw new Error("AI generation failed");
    }
    const data = await res.json();
    const stopReason = data.stop_reason;
    if (stopReason === "max_tokens") {
      console.warn("[callAnthropicForPlan] Response hit max_tokens — output may be truncated");
    }
    return data.content?.[0]?.text || "";
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { plan_type, include_plans, client_now_minutes, client_day } = body;
    console.log("[generate-plans] client_now_minutes:", client_now_minutes, "client_day:", client_day, "raw body keys:", Object.keys(body));
    if (!["content_plan", "branding_plan", "funnel_strategy"].includes(plan_type)) {
      return new Response(JSON.stringify({ error: "Invalid plan_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for fetching full context
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch getUserContext, profile settings, journey stage, and regression data in parallel
    const [userContext, { data: profile }, journeyStage, { data: regressionRow }] = await Promise.all([
      getUserContext(admin, user.id),
      admin
        .from("profiles")
        .select("max_posts_per_day, goal_type, traffic_url, dm_keyword, dm_offer, revenue_target")
        .eq("id", user.id)
        .maybeSingle(),
      fetchJourneyStage(admin, user.id),
      admin
        .from("content_strategies")
        .select("regression_insights")
        .eq("user_id", user.id)
        .eq("strategy_type", "regression")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const stageConfig = getStageConfig(journeyStage);
    const stageBlock = `\n\n=== JOURNEY STAGE OPTIMIZATION ===\n${stageConfig.promptBlock}`;

    // Build explicit creator settings block for prompt injection
    const creatorSettings = `=== CREATOR SETTINGS (use these exactly) ===
- Posts per day: ${profile?.max_posts_per_day ?? 1}
- Goal type: ${profile?.goal_type ?? "not set"}
- Traffic URL: ${profile?.traffic_url ?? "not set"}
- DM keyword: ${profile?.dm_keyword ?? "not set"}
- DM offer: ${profile?.dm_offer ?? "not set"}
- Revenue target: ${profile?.revenue_target ?? "not set"}
`;

    // If content_plan requests sibling plans, fetch them from user_plans
    let siblingPlansContext = "";
    if (plan_type === "content_plan" && Array.isArray(include_plans) && include_plans.length > 0) {
      const { data: siblingRows } = await admin
        .from("user_plans")
        .select("plan_type, plan_data")
        .eq("user_id", user.id)
        .in("plan_type", include_plans);

      if (siblingRows && siblingRows.length > 0) {
        const blocks = siblingRows.map((row: any) => {
          const label = row.plan_type === "branding_plan" ? "BRANDING PLAN" : "FUNNEL STRATEGY";
          return `=== ${label} (already generated — use this as input) ===\n${JSON.stringify(row.plan_data, null, 2)}`;
        });
        siblingPlansContext = blocks.join("\n\n") + "\n\n";
        console.log("[generate-plans] injecting sibling plans:", include_plans);
      }
    }

    // postsPerDay comes from profiles.max_posts_per_day — capped at 15
    const postsPerDay = Math.min(profile?.max_posts_per_day || 7, 15);
    console.log("[generate-plans] postsPerDay:", postsPerDay, "plan_type:", plan_type);

    // Hardcode the actual posts_per_day value into the JSON schema so the AI can't ignore it
    const contentPlanPrompt = CONTENT_PLAN_PROMPT
      .replace('"posts_per_day": number', `"posts_per_day": ${postsPerDay}`)
      .replace(
        'You MUST use this exact number for posts_per_day in your output. Do not default to 1. If max_posts_per_day is 3, output 3 posts per day. If max_posts_per_day is 7, output 7 posts per day. Each day in daily_plan must have exactly posts_per_day posts.',
        `You MUST output "posts_per_day": ${postsPerDay}. Each day in daily_plan MUST have exactly ${postsPerDay} posts. This is non-negotiable.`
      );

    // Determine today's day name — prefer client's local day over server UTC
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = (client_day && dayNames.includes(client_day)) ? client_day : dayNames[new Date().getDay()];
    const todayAnchor = `\nToday is ${todayName}. The 7-day plan must start from ${todayName} and go forward from there. Do not start from Monday unless today is Monday.\n`;

    const basePrompt =
      plan_type === "content_plan"
        ? contentPlanPrompt
        : plan_type === "branding_plan"
        ? BRANDING_PLAN_PROMPT
        : FUNNEL_STRATEGY_PROMPT;
    const systemPrompt = basePrompt + stageBlock + (plan_type === "content_plan" ? todayAnchor : "");

    // Build goal-based CTA rules block
    const goalType = profile?.goal_type ?? "not set";
    const dmKeyword = profile?.dm_keyword ?? "";
    const dmOffer = profile?.dm_offer ?? "";
    const trafficUrl = profile?.traffic_url ?? "";
    const goalCtaRules = `\n=== GOAL-BASED CTA RULES (follow these exactly) ===
- If Goal Type is "get_comments": ALL conversion CTAs must tell readers to COMMENT the word "${dmKeyword}" to receive "${dmOffer}". Never use "DM me" or "click the link" as the BOF CTA. BOF posts are comment-bait posts designed to trigger the keyword. The conversion path ends with: comment the keyword → they get the offer.
- If Goal Type is "drive_traffic": ALL BOF CTAs must drive clicks to ${trafficUrl}. Use "link in bio" or direct URL CTAs only.
- If Goal Type is "grow_audience": BOF posts focus on follow triggers and shareable content. CTAs are "follow for more" or "share this."

Apply this to every BOF post idea, the conversion path section, and any CTA language generated.\n`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build dynamic regression word count insight for content plans
    let regressionLengthBlock = "";
    if (plan_type === "content_plan") {
      const regInsights = (regressionRow as any)?.regression_insights;
      if (regInsights) {
        const optRange = regInsights.optimal_word_count_range;
        const wordCoeff = regInsights.correlations?.find?.((c: any) => c.feature === "word_count");
        const shortLift = regInsights.boolean_lifts?.find?.((b: any) => b.feature === "is_short_form");
        const parts: string[] = [];
        if (optRange?.min && optRange?.max) {
          parts.push(`Regression data shows optimal post length for this creator is ${optRange.min}-${optRange.max} words.`);
        }
        if (shortLift?.lift_pct !== undefined) {
          const dir = shortLift.lift_pct > 0 ? "more" : "fewer";
          parts.push(`Posts under 30 words get ${Math.abs(Math.round(shortLift.lift_pct))}% ${dir} views than average.`);
        } else if (wordCoeff?.correlation !== undefined) {
          const dir = wordCoeff.correlation < 0 ? "shorter posts tend to get more views" : "longer posts tend to get more views";
          parts.push(`Word count correlation: ${dir} (r=${wordCoeff.correlation.toFixed(2)}).`);
        }
        if (parts.length > 0) {
          parts.push("Adjust your length distribution accordingly.");
          regressionLengthBlock = "\n=== REGRESSION LENGTH INSIGHTS ===\n" + parts.join(" ") + "\n";
        }
      }
    }

    // Build user message once (shared by single and batch paths)
    const userMessage = siblingPlansContext + creatorSettings + ((plan_type === "content_plan" || plan_type === "funnel_strategy") ? goalCtaRules : "") + regressionLengthBlock + "\n" + userContext;

    let planData: any;
    try {
      if (plan_type === "content_plan" && postsPerDay > 7) {
        // 2-batch sequential generation for 8-15 posts/day with cross-batch hook dedup
        const todayIdx = dayNames.indexOf(todayName);
        const orderedDays = Array.from({ length: 7 }, (_, i) => dayNames[(todayIdx + i) % 7]);
        const baseSystemPrompt = basePrompt + stageBlock;
        const BATCH_MAX_TOKENS = 8192;

        // Helper: extract all hook_idea values from parsed batch data
        function extractHooks(batchData: any): string[] {
          const hooks: string[] = [];
          if (batchData?.daily_plan && Array.isArray(batchData.daily_plan)) {
            for (const day of batchData.daily_plan) {
              if (day.posts && Array.isArray(day.posts)) {
                for (const post of day.posts) {
                  if (post.hook_idea) hooks.push(post.hook_idea);
                }
              }
            }
          }
          return hooks;
        }

        // Helper: build dedup instruction block from previously used hooks
        function buildDedupBlock(usedHooks: string[]): string {
          if (usedHooks.length === 0) return "";
          return `\n\nALREADY USED HOOKS — do NOT repeat, rephrase, or closely paraphrase any of these:\n${usedHooks.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n\nEvery hook you generate must be meaningfully different from the above. Same insight reworded is still a duplicate.\n`;
        }

        // 2-batch split: days 1-4 then days 5-7
        const batch1Days = orderedDays.slice(0, 4);
        const batch2Days = orderedDays.slice(4);
        console.log("[generate-plans] 2-BATCH SEQUENTIAL MODE: postsPerDay:", postsPerDay, "batch1:", batch1Days, "batch2:", batch2Days);

        // Batch 1
        const batch1System = baseSystemPrompt + `\nToday is ${todayName}. Generate posts ONLY for these ${batch1Days.length} days: ${batch1Days.join(", ")}. Each day must have exactly ${postsPerDay} posts. Also generate primary_archetypes. Do NOT generate weekly_themes.\n`;
        const raw1 = await callAnthropicForPlan(ANTHROPIC_API_KEY, batch1System, userMessage, BATCH_MAX_TOKENS);
        console.log("[generate-plans] batch1 length:", raw1.length);
        const batch1Data = recoverTruncatedJSON(raw1, batch1Days.length * postsPerDay, "Batch1");
        if (!batch1Data?.daily_plan) throw new Error("Batch 1 returned no daily_plan");
        const batch1Hooks = extractHooks(batch1Data);
        console.log("[generate-plans] batch1 hooks extracted:", batch1Hooks.length);

        // Batch 2 — inject batch 1 hooks for dedup
        const batch2System = baseSystemPrompt + `\nToday is ${todayName}. Generate posts ONLY for these ${batch2Days.length} days: ${batch2Days.join(", ")}. Each day must have exactly ${postsPerDay} posts. Also generate weekly_themes. Do NOT generate primary_archetypes.\n` + buildDedupBlock(batch1Hooks);
        const raw2 = await callAnthropicForPlan(ANTHROPIC_API_KEY, batch2System, userMessage, BATCH_MAX_TOKENS);
        console.log("[generate-plans] batch2 length:", raw2.length);
        const batch2Data = recoverTruncatedJSON(raw2, batch2Days.length * postsPerDay, "Batch2");
        if (!batch2Data?.daily_plan) throw new Error("Batch 2 returned no daily_plan");

        planData = {
          ...batch1Data,
          daily_plan: [...(batch1Data.daily_plan || []), ...(batch2Data.daily_plan || [])],
          weekly_themes: batch2Data.weekly_themes || batch1Data.weekly_themes || [],
        };
        console.log("[generate-plans] 2-BATCH COMBINE: total days:", planData.daily_plan.length, "total hooks:", batch1Hooks.length + extractHooks(batch2Data).length);
      } else {
        // Single call for <= 10 posts/day or non-content-plan types
        const maxTokens = Math.min(3000 + (postsPerDay * 600), 10000);
        const rawText = await callAnthropicForPlan(ANTHROPIC_API_KEY, systemPrompt, userMessage, maxTokens);
        console.log("Raw AI response length:", rawText.length);
        planData = safeParseJSON(rawText);
        if (!planData || typeof planData !== "object") throw new Error("Parsed result is not an object");
      }

      // Log warnings for incomplete days after batch or single generation
      if (plan_type === "content_plan" && planData?.daily_plan) {
        for (const day of planData.daily_plan) {
          const postCount = day.posts?.length ?? 0;
          if (postCount < postsPerDay) {
            console.warn(`[generate-plans] WARNING: ${day.day} has ${postCount}/${postsPerDay} posts (incomplete)`);
          }
        }
        if (planData.daily_plan.length < 7) {
          console.warn(`[generate-plans] WARNING: Only ${planData.daily_plan.length}/7 days generated`);
        }
      }
    } catch (e: any) {
      console.error("AI generation error:", e);
      const isTimeout = e?.message?.includes("abort") || e?.message?.includes("timed out");
      const errorMsg = isTimeout
        ? "AI request timed out. Please try again."
        : "Plan generation failed — please try again.";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Force posts_per_day to match profile and derive best times from regression data
    if (plan_type === "content_plan") {
      // Single source of truth: derive best posting times from regression hour_averages
      const regressionInsights = (regressionRow as any)?.regression_insights;
      // No cap — pull as many top-performing hours as postsPerDay from regression
      const regressionBestTimes = deriveBestTimes(regressionInsights, postsPerDay);
      console.log("[generate-plans] regression-derived best_times:", JSON.stringify(regressionBestTimes));
      console.log("[generate-plans] postsPerDay from profile:", postsPerDay);
      console.log("[generate-plans] daily_plan posts:", planData.daily_plan?.map((d: any) => `${d.day}: ${d.posts?.length} posts`));

      // Store regression-backed best times for display (Weekly Overview)
      planData.original_best_times = regressionBestTimes;

      // Expand time slots so every post gets a unique slot
      const expandedTimes = expandTimeSlots(regressionBestTimes, postsPerDay);
      planData.best_times = expandedTimes;
      planData.posts_per_day = postsPerDay;

      console.log("[generate-plans] expanded best_times:", JSON.stringify(expandedTimes));
      console.log("[generate-plans] forcing posts_per_day to:", postsPerDay);

      // For TODAY specifically, generate time slots starting from NOW
      const nowMins = typeof client_now_minutes === "number" ? client_now_minutes : (new Date().getUTCHours() * 60 + new Date().getUTCMinutes());
      const todayInPlan = planData.daily_plan?.find((d: any) => d.day === todayName);
      if (todayInPlan) {
        const todaySlots = generateTodaySlots(regressionBestTimes, postsPerDay, nowMins);
        planData.today_best_times = todaySlots;
        planData.today_day_name = todayName;
        console.log("[generate-plans] nowMinutes:", nowMins, "today_best_times:", JSON.stringify(todaySlots));
      }
    }

    // Force funnel percentages to fixed values regardless of AI output
    if (plan_type === "funnel_strategy") {
      if (planData.tof) planData.tof.content_percentage = 50;
      if (planData.mof) planData.mof.content_percentage = 30;
      if (planData.bof) planData.bof.content_percentage = 20;
    }

    // Build profile snapshot fingerprint
    const profileSnapshot = {
      goal_type: profile?.goal_type ?? null,
      dm_keyword: profile?.dm_keyword ?? null,
      dm_offer: profile?.dm_offer ?? null,
      max_posts_per_day: profile?.max_posts_per_day ?? 1,
      traffic_url: profile?.traffic_url ?? null,
    };

    // Fetch additional fields for snapshot
    const { data: snapshotProfile } = await admin
      .from("profiles")
      .select("niche, mission")
      .eq("id", user.id)
      .maybeSingle();

    (profileSnapshot as any).niche = snapshotProfile?.niche ?? null;
    (profileSnapshot as any).mission = snapshotProfile?.mission ?? null;

    // Diagnostic: log planData keys and critical fields before upsert
    console.log("[generate-plans] PRE-UPSERT planData keys:", Object.keys(planData));
    console.log("[generate-plans] PRE-UPSERT planData.best_times:", JSON.stringify(planData.best_times));
    console.log("[generate-plans] PRE-UPSERT planData.original_best_times:", JSON.stringify(planData.original_best_times));
    console.log("[generate-plans] PRE-UPSERT planData.today_best_times:", JSON.stringify(planData.today_best_times));
    console.log("[generate-plans] PRE-UPSERT planData.today_day_name:", planData.today_day_name);
    console.log("[generate-plans] PRE-UPSERT planData.posts_per_day:", planData.posts_per_day);

    // Upsert into user_plans — use admin (service role) to bypass RLS
    const { error: upsertError } = await admin.from("user_plans").upsert(
      {
        user_id: user.id,
        plan_type,
        plan_data: planData,
        profile_snapshot: profileSnapshot,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,plan_type" }
    );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to save plan" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ plan_data: planData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-plans error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
