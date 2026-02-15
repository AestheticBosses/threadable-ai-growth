import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("niche, dream_client, end_goal, voice_profile")
      .eq("id", userId)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: strategy } = await adminClient
      .from("content_strategies")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!strategy || !strategy.regression_insights) {
      return new Response(JSON.stringify({ error: "No regression insights found. Run analysis first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: topPosts } = await adminClient
      .from("posts_analyzed")
      .select("text_content, views, likes, replies, reposts, engagement_rate, virality_score, word_count, has_credibility_marker, has_question")
      .eq("user_id", userId)
      .order("engagement_rate", { ascending: false })
      .limit(10);

    const insights = strategy.regression_insights as any;
    const insightsText = (insights.human_readable_insights || []).join("\n- ");

    const topPostsText = (topPosts || [])
      .map((p: any, i: number) =>
        `${i + 1}. "${(p.text_content || "").slice(0, 150)}..." — ${p.views} views, ${p.engagement_rate?.toFixed(1)}% eng, ${p.likes} likes, ${p.replies} replies`
      )
      .join("\n");

    const systemPrompt = `You are an expert Threads content strategist. Based on the user's niche, dream client, end goal, and data-driven insights from their post performance, create a weekly content strategy.

USER CONTEXT:
Niche: ${profile.niche || "Not specified"}
Dream Client: ${profile.dream_client || "Not specified"}
End Goal: ${profile.end_goal || "Not specified"}

DATA INSIGHTS:
- ${insightsText || "No insights available"}
- Best posting day: ${insights.best_posting_day?.day || "N/A"} (avg ${insights.best_posting_day?.avg_views || 0} views)
- Best posting hour: ${insights.best_posting_hour?.hour || "N/A"}:00 (avg ${insights.best_posting_hour?.avg_views || 0} views)
- Optimal word count: ${insights.optimal_word_count_range?.min || 0}-${insights.optimal_word_count_range?.max || 0} words
- Credibility marker lift: ${insights.credibility_marker_lift || 0}%
- Question lift: ${insights.question_lift || 0}%

TOP PERFORMING POSTS:
${topPostsText || "No posts analyzed yet"}`;

    const userPrompt = `Generate a weekly content strategy. Return the strategy as a JSON object with this structure:
{
  "content_pillars": [{ "name": "string", "description": "string", "percentage_of_content": number, "example_topics": ["string"] }],
  "weekly_schedule": [{ "day": "Monday", "posts_count": number, "content_types": ["string"], "best_time": "HH:MM" }],
  "content_ratios": { "authority": number, "engagement": number, "storytelling": number, "cta": number },
  "hooks_to_use": ["string - 10 proven hook formulas"],
  "topics_for_this_week": ["string - 14 to 21 specific post topics"],
  "avoid": ["string - things to avoid based on data"]
}

Return ONLY valid JSON, no other text.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            name: "output_strategy",
            description: "Output the weekly content strategy",
            input_schema: {
              type: "object",
              properties: {
                content_pillars: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      percentage_of_content: { type: "number" },
                      example_topics: { type: "array", items: { type: "string" } },
                    },
                    required: ["name", "description", "percentage_of_content", "example_topics"],
                  },
                },
                weekly_schedule: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day: { type: "string" },
                      posts_count: { type: "number" },
                      content_types: { type: "array", items: { type: "string" } },
                      best_time: { type: "string" },
                    },
                    required: ["day", "posts_count", "content_types", "best_time"],
                  },
                },
                content_ratios: {
                  type: "object",
                  properties: {
                    authority: { type: "number" },
                    engagement: { type: "number" },
                    storytelling: { type: "number" },
                    cta: { type: "number" },
                  },
                  required: ["authority", "engagement", "storytelling", "cta"],
                },
                hooks_to_use: { type: "array", items: { type: "string" } },
                topics_for_this_week: { type: "array", items: { type: "string" } },
                avoid: { type: "array", items: { type: "string" } },
              },
              required: ["content_pillars", "weekly_schedule", "content_ratios", "hooks_to_use", "topics_for_this_week", "avoid"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "output_strategy" },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("Anthropic API error:", status, errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let strategyJson: any;

    // Extract from tool use response
    const toolUse = aiData.content?.find((block: any) => block.type === "tool_use");
    if (toolUse?.input) {
      strategyJson = toolUse.input;
    } else {
      // Fallback: try parsing from text content
      const textBlock = aiData.content?.find((block: any) => block.type === "text");
      const content = textBlock?.text || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        strategyJson = JSON.parse(jsonMatch[0]);
      } else {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: updateErr } = await adminClient
      .from("content_strategies")
      .update({ strategy_json: strategyJson })
      .eq("id", strategy.id);

    if (updateErr) {
      console.error("Failed to save strategy:", updateErr);
    }

    return new Response(JSON.stringify(strategyJson), {
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
