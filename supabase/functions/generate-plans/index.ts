// updated
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserContext } from "../_shared/getUserContext.ts";
import { fetchJourneyStage, getStageConfig } from "../_shared/journeyStage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CONTENT_PLAN_PROMPT = `You are Threadable — a data-driven Threads content strategist. Based on the user's identity, archetypes, regression insights, and top-performing content, create a 7-day content plan.

Use the regression insights to determine archetype distribution — weight archetypes higher that have proven to drive more views and engagement in the user's data. Do not distribute archetypes evenly unless the data supports it.

Reference the user's sales funnel steps when creating BOF post ideas — use their real offer names, prices, and URLs.

The creator's profile includes max_posts_per_day. You MUST use this exact number for posts_per_day in your output. Do not default to 1. If max_posts_per_day is 3, output 3 posts per day. If max_posts_per_day is 7, output 7 posts per day. Each day in daily_plan must have exactly posts_per_day posts.

Each hook_idea must be 500 characters or less. Threads has a 500 character limit. Write hooks that are punchy and complete within that limit.

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

The creator's goal_type, traffic_url, dm_keyword, dm_offer, revenue_target, and biggest_challenge are in their profile. Build the entire funnel strategy around these:
- If goal_type is "drive_traffic", every BOF post must include the traffic_url as the CTA. Shape MOF content to warm audiences toward clicking.
- If goal_type is "dm_leads", every BOF post must use the dm_keyword and dm_offer (e.g. "DM me [keyword] to get [offer]"). Shape MOF content to build trust toward DMing.
- If goal_type is "grow_audience", BOF focuses on comments, shares, and saves — optimize for algorithmic reach over direct conversion.
- Use revenue_target to calibrate how aggressive the BOF percentage should be.
- Use biggest_challenge to inform what MOF content should address to overcome objections.

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

    const { plan_type } = await req.json();
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
        .select("max_posts_per_day, goal_type, traffic_url, dm_keyword, dm_offer, revenue_target, biggest_challenge")
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
- Biggest challenge: ${profile?.biggest_challenge ?? "not set"}
`;

    const postsPerDay = profile?.max_posts_per_day ?? 1;
    console.log("[generate-plans] postsPerDay:", postsPerDay, "plan_type:", plan_type);

    // Hardcode the actual posts_per_day value into the JSON schema so the AI can't ignore it
    const contentPlanPrompt = CONTENT_PLAN_PROMPT
      .replace('"posts_per_day": number', `"posts_per_day": ${postsPerDay}`)
      .replace(
        'You MUST use this exact number for posts_per_day in your output. Do not default to 1. If max_posts_per_day is 3, output 3 posts per day. If max_posts_per_day is 7, output 7 posts per day. Each day in daily_plan must have exactly posts_per_day posts.',
        `You MUST output "posts_per_day": ${postsPerDay}. Each day in daily_plan MUST have exactly ${postsPerDay} posts. This is non-negotiable.`
      );

    const basePrompt =
      plan_type === "content_plan"
        ? contentPlanPrompt
        : plan_type === "branding_plan"
        ? BRANDING_PLAN_PROMPT
        : FUNNEL_STRATEGY_PROMPT;
    const systemPrompt = basePrompt + stageBlock;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: Math.min(4000 + (postsPerDay * 800), 16000),
        system: systemPrompt,
        messages: [{ role: "user", content: creatorSettings + "\n" + userContext }],
      }),
    });

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
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      planData = JSON.parse(jsonMatch[0]);
      if (!planData || typeof planData !== "object") throw new Error("Parsed result is not an object");
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", rawText.slice(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse AI response. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Force posts_per_day to match profile even if AI hallucinated a different value
    if (plan_type === "content_plan") {
      console.log("[generate-plans] forcing posts_per_day to:", postsPerDay);
      planData.posts_per_day = postsPerDay;
    }

    // Upsert into user_plans
    const { error: upsertError } = await supabase.from("user_plans").upsert(
      {
        user_id: user.id,
        plan_type,
        plan_data: planData,
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
