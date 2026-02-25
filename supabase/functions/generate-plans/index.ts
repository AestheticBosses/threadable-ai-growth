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

const CONTENT_PLAN_PROMPT = `You are Threadable — a data-driven Threads content strategist. Based on the user's identity, archetypes, regression insights, and top-performing content, create a 7-day content plan.

Use the regression insights to determine archetype distribution — weight archetypes higher that have proven to drive more views and engagement in the user's data. Do not distribute archetypes evenly unless the data supports it.

Reference the user's sales funnel steps when creating BOF post ideas — use their real offer names, prices, and URLs.

If a BRANDING PLAN and FUNNEL STRATEGY are provided in the context, you MUST use them as direct input:
- Align daily post topics with the brand pillars from the branding plan
- Use the funnel strategy's TOF/MOF/BOF percentages and post ideas to shape funnel_stage distribution
- Reference the branding plan's voice_summary for tone consistency
- Use the funnel strategy's conversion_path to ensure the week builds toward conversion

The creator's profile includes max_posts_per_day. You MUST use this exact number for posts_per_day in your output. Do not default to 1. If max_posts_per_day is 3, output 3 posts per day. If max_posts_per_day is 7, output 7 posts per day. Each day in daily_plan must have exactly posts_per_day posts.

Be extremely concise. Each topic must be under 80 characters. Each hook_idea must be one line only, under 100 characters — just the opening hook sentence, nothing more. No multi-line hook ideas. Total JSON response must be under 6000 tokens.

This keeps hook ideas as short planning seeds. Full post text gets generated later by generate-draft-posts.

FUNNEL MIX RULES for daily schedule:
- BOF posts should be 1-2 per day maximum regardless of posts_per_day setting. Never over-index on BOF — it kills organic reach on Threads.
- Maintain roughly TOF 45-55%, MOF 30-35%, BOF 10-20% across the weekly plan.

Respond ONLY with valid JSON in this format:
{
  "posts_per_day": number,
  "best_times": ["time1", "time2"],
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

    const { plan_type, include_plans } = await req.json();
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

    // Fetch getUserContext, profile settings, and journey stage in parallel
    const [userContext, { data: profile }, journeyStage] = await Promise.all([
      getUserContext(admin, user.id),
      admin
        .from("profiles")
        .select("max_posts_per_day, goal_type, traffic_url, dm_keyword, dm_offer, revenue_target")
        .eq("id", user.id)
        .maybeSingle(),
      fetchJourneyStage(admin, user.id),
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

    const postsPerDay = profile?.max_posts_per_day ?? 1;
    console.log("[generate-plans] postsPerDay:", postsPerDay, "plan_type:", plan_type);

    // Hardcode the actual posts_per_day value into the JSON schema so the AI can't ignore it
    const contentPlanPrompt = CONTENT_PLAN_PROMPT
      .replace('"posts_per_day": number', `"posts_per_day": ${postsPerDay}`)
      .replace(
        'You MUST use this exact number for posts_per_day in your output. Do not default to 1. If max_posts_per_day is 3, output 3 posts per day. If max_posts_per_day is 7, output 7 posts per day. Each day in daily_plan must have exactly posts_per_day posts.',
        `You MUST output "posts_per_day": ${postsPerDay}. Each day in daily_plan MUST have exactly ${postsPerDay} posts. This is non-negotiable.`
      );

    // Determine today's day name for anchoring the plan
    const today = new Date();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[today.getDay()];
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    let anthropicRes: Response;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: Math.min(3000 + (postsPerDay * 600), 10000),
          system: systemPrompt,
          messages: [{ role: "user", content: siblingPlansContext + creatorSettings + ((plan_type === "content_plan" || plan_type === "funnel_strategy") ? goalCtaRules : "") + "\n" + userContext }],
        }),
      });
      clearTimeout(timeoutId);
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("Fetch error:", e);
      return new Response(JSON.stringify({ error: "AI request failed or timed out. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text || "";
    console.log("Raw AI response length:", rawText.length);

    let planData: any;
    try {
      planData = safeParseJSON(rawText);
      if (!planData || typeof planData !== "object") throw new Error("Parsed result is not an object");
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", rawText.slice(0, 500));
      return new Response(JSON.stringify({ error: "Plan generation was cut short — please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Force posts_per_day to match profile even if AI hallucinated a different value
    if (plan_type === "content_plan") {
      console.log("[generate-plans] forcing posts_per_day to:", postsPerDay);
      planData.posts_per_day = postsPerDay;
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

    // Upsert into user_plans
    const { error: upsertError } = await supabase.from("user_plans").upsert(
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
