import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CONTENT_PLAN_PROMPT = `You are a Threads content strategist. Based on the user's identity, archetypes, and top-performing content, create a 7-day content plan.

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { plan_type } = await req.json();
    if (!["content_plan", "branding_plan", "funnel_strategy"].includes(plan_type)) {
      return new Response(JSON.stringify({ error: "Invalid plan_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user data in parallel
    const [identityRes, offersRes, audiencesRes, personalInfoRes, postsRes, prefsRes, styleRes, archetypesRes] =
      await Promise.all([
        supabase.from("user_identity").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_offers").select("*").eq("user_id", userId),
        supabase.from("user_audiences").select("*").eq("user_id", userId),
        supabase.from("user_personal_info").select("*").eq("user_id", userId),
        supabase
          .from("posts_analyzed")
          .select("text_content, engagement_rate, views, likes, archetype")
          .eq("user_id", userId)
          .eq("source", "own")
          .order("views", { ascending: false })
          .limit(20),
        supabase.from("content_preferences").select("content").eq("user_id", userId),
        supabase.from("user_writing_style").select("selected_style, custom_style_description").eq("user_id", userId).maybeSingle(),
        supabase
          .from("content_strategies")
          .select("strategy_data")
          .eq("user_id", userId)
          .eq("strategy_type", "archetype_discovery")
          .limit(1),
      ]);

    const identity = identityRes.data;
    const offers = offersRes.data || [];
    const audiences = audiencesRes.data || [];
    const personalInfo = personalInfoRes.data || [];
    const topPosts = postsRes.data || [];
    const preferences = prefsRes.data || [];
    const writingStyle = styleRes.data;
    const archetypeData = archetypesRes.data?.[0]?.strategy_data;

    // Build user context
    const userContext = `
USER IDENTITY:
- About: ${identity?.about_you || "Not provided"}
- Desired perception: ${identity?.desired_perception || "Not provided"}
- Main goal: ${identity?.main_goal || "Not provided"}

OFFERS: ${offers.map((o: any) => `${o.name}: ${o.description || ""}`).join("; ") || "None"}

TARGET AUDIENCES: ${audiences.map((a: any) => a.name).join(", ") || "None"}

PERSONAL INFO: ${personalInfo.map((p: any) => p.content).join("; ") || "None"}

CONTENT PREFERENCES: ${preferences.map((p: any) => p.content).join("; ") || "None"}

WRITING STYLE: ${writingStyle?.selected_style || "default"}${writingStyle?.custom_style_description ? ` - ${writingStyle.custom_style_description}` : ""}

DISCOVERED ARCHETYPES: ${archetypeData ? JSON.stringify((archetypeData as any).archetypes?.map((a: any) => ({ name: a.name, percentage: a.recommended_percentage }))) : "None"}

TOP PERFORMING POSTS (by views):
${topPosts.map((p: any, i: number) => `${i + 1}. [${p.archetype || "unknown"}] (${p.views} views, ${(p.engagement_rate || 0).toFixed(2)}% eng) ${(p.text_content || "").slice(0, 200)}`).join("\n")}
`;

    const systemPrompt =
      plan_type === "content_plan"
        ? CONTENT_PLAN_PROMPT
        : plan_type === "branding_plan"
        ? BRANDING_PLAN_PROMPT
        : FUNNEL_STRATEGY_PROMPT;

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
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userContext }],
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
    console.log("Raw AI response length:", rawText.length, "First 300 chars:", rawText.slice(0, 300));

    // Extract JSON from response
    let planData: any;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      planData = JSON.parse(jsonMatch[0]);
      // Validate critical fields
      if (!planData || typeof planData !== "object") throw new Error("Parsed result is not an object");
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", rawText.slice(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse AI response. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert into user_plans
    const { error: upsertError } = await supabase.from("user_plans").upsert(
      {
        user_id: userId,
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
