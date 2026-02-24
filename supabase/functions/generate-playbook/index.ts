import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserContext } from "../_shared/getUserContext.ts";
import { fetchJourneyStage, getStageConfig } from "../_shared/journeyStage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("generate-playbook for user:", user.id);

    // Get archetypes (needed as raw JSON for prompt structure)
    const { data: archetypeRow } = await adminClient
      .from("content_strategies")
      .select("strategy_data")
      .eq("user_id", user.id)
      .eq("strategy_type", "archetype_discovery")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!archetypeRow?.strategy_data) {
      return new Response(
        JSON.stringify({ error: "No archetypes found. Run 'Discover Archetypes' first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const archetypes = archetypeRow.strategy_data;

    // Get full user context (replaces 4 manual queries)
    const [userContext, journeyStage] = await Promise.all([
      getUserContext(adminClient, user.id),
      fetchJourneyStage(adminClient, user.id),
    ]);
    const stageConfig = getStageConfig(journeyStage);

    const prompt = `You are building a personalized content playbook for a Threads creator.

Here are their discovered content archetypes (from analyzing their top posts):
${JSON.stringify(archetypes, null, 2)}

Here is everything you know about this creator:

${userContext}

Journey stage optimization:
${stageConfig.promptBlock}

Create a complete, actionable playbook that includes:

1. WEEKLY ROTATION: A 7-day posting schedule using their discovered archetypes, weighted by what drives the most engagement. Include which archetype each day, and a brief note on why.

2. PRE-POST CHECKLIST: 6 scoring criteria (3 rule-based, 3 data-driven) specific to THIS creator's data. Each criterion should reference their actual regression results or top post patterns. Include point values adding up to 6.

3. TEMPLATES: One fill-in-the-blank template per archetype, based on their actual top-performing posts in that category.

4. RULES: 5-7 rules validated by their specific data. Each rule must reference a specific finding.

5. CONTENT GENERATION GUIDELINES: Instructions for an AI to write posts in this creator's style, including tone, vocabulary, length preferences, and what to avoid.

Respond ONLY in this exact JSON format with no other text:
{
  "weekly_schedule": [{ "day": "Monday", "archetype": "name", "emoji": "🔥", "notes": "why" }],
  "checklist": [{ "points": 2, "question": "Does it...?", "data_backing": "stat from their data" }],
  "templates": [{ "archetype": "name", "emoji": "🔥", "template": "fill in blank template", "example": "example from their posts" }],
  "rules": [{ "rule": "Rule text", "evidence": "Data point supporting it" }],
  "generation_guidelines": { "tone": "", "avg_length": "", "vocabulary": [], "avoid": [] }
}`;

    console.log("Calling Claude for playbook generation...");

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 6000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const claudeData = await claudeResponse.json();
    if (!claudeResponse.ok) {
      console.error("Claude error:", JSON.stringify(claudeData));
      return new Response(
        JSON.stringify({ error: "Claude API error", details: claudeData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analysisText = claudeData.content[0].text;
    let playbook: any;
    try {
      const cleanJson = analysisText.replace(/```json\n?|```\n?/g, "").trim();
      playbook = JSON.parse(cleanJson);
    } catch (e: any) {
      console.error("JSON parse error:", e.message);
      return new Response(
        JSON.stringify({ error: "Failed to parse playbook response", raw: analysisText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert to content_strategies
    const { error: upsertError } = await adminClient
      .from("content_strategies")
      .upsert(
        {
          user_id: user.id,
          strategy_type: "playbook",
          strategy_data: playbook,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,strategy_type" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
    }

    console.log("=== PLAYBOOK GENERATED ===");

    return new Response(JSON.stringify({ success: true, playbook }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
