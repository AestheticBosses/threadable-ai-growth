import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    // 1. Get discovered archetypes
    const { data: archetypeRow } = await adminClient
      .from("content_strategies")
      .select("strategy_data")
      .eq("user_id", user.id)
      .eq("strategy_type", "archetype_discovery")
      .limit(1)
      .single();

    if (!archetypeRow?.strategy_data) {
      return new Response(
        JSON.stringify({ error: "No archetypes found. Run 'Discover Archetypes' first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get regression insights (if available)
    const { data: strategyRow } = await adminClient
      .from("content_strategies")
      .select("regression_insights")
      .eq("user_id", user.id)
      .eq("strategy_type", "weekly")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const regressionInsights = (strategyRow?.regression_insights as any) || null;

    // 3. Get top 10 posts
    const { data: topPosts } = await adminClient
      .from("posts_analyzed")
      .select("text_content, views, likes, replies, reposts, quotes, engagement_rate")
      .eq("user_id", user.id)
      .order("views", { ascending: false })
      .limit(10);

    // 4. Get voice profile
    const { data: profileData } = await adminClient
      .from("profiles")
      .select("voice_profile, niche, dream_client, end_goal, posting_cadence, traffic_url, goal_type, dm_keyword, dm_offer, posts_per_day")
      .eq("id", user.id)
      .single();

    // Get journey stage for funnel optimization
    const journeyStage = await fetchJourneyStage(adminClient, user.id);
    const stageConfig = getStageConfig(journeyStage);

    const archetypes = archetypeRow.strategy_data;
    const insightsBullets = regressionInsights?.human_readable_insights
      ? (regressionInsights.human_readable_insights as string[]).map((i: string) => `• ${i}`).join("\n")
      : "No regression data available yet.";

    const topPostsText = (topPosts || [])
      .map(
        (p: any, i: number) =>
          `${i + 1}. (${p.views} views, ${p.likes} likes, ${p.replies} replies, ${p.reposts} reposts, ${(p.engagement_rate || 0).toFixed(2)}% eng)\n"${(p.text_content || "").slice(0, 400)}"`
      )
      .join("\n\n");

    const prompt = `You are building a personalized content playbook for a Threads creator.

Here are their discovered content archetypes (from analyzing their top posts):
${JSON.stringify(archetypes, null, 2)}

Here is their regression analysis showing what drives engagement:
${insightsBullets}

Here are their top 10 posts with engagement data:
${topPostsText}

Creator context:
- Niche: ${profileData?.niche || "Not specified"}
- Dream client: ${profileData?.dream_client || "Not specified"}
- End goal: ${profileData?.end_goal || "Not specified"}
- Goal type: ${profileData?.goal_type || "Not set"}
- Posting cadence: ${profileData?.posting_cadence || "Not set"}
- Posts per day: ${profileData?.posts_per_day || "Not set"}
- Traffic URL (for BOF/CTA posts): ${profileData?.traffic_url || "Not set"}
- DM keyword: ${profileData?.dm_keyword || "Not set"}
- DM offer: ${profileData?.dm_offer || "Not set"}
- Voice profile: ${profileData?.voice_profile ? JSON.stringify(profileData.voice_profile) : "Not set"}

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
        model: "claude-sonnet-4-20250514",
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
