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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

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

    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch user context in parallel
    const [regressionRow, profileRow, prefsRows, styleRow] = await Promise.all([
      adminClient
        .from("content_strategies")
        .select("regression_insights")
        .eq("user_id", userId)
        .eq("strategy_type", "weekly")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminClient
        .from("profiles")
        .select("goal_type, dm_keyword, dm_offer, traffic_url, dream_client, niche")
        .eq("id", userId)
        .single(),
      adminClient
        .from("content_preferences")
        .select("content")
        .eq("user_id", userId)
        .order("sort_order"),
      adminClient
        .from("user_writing_style")
        .select("selected_style, custom_style_description")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const regression = regressionRow.data?.regression_insights as any;
    const profile = profileRow.data;
    const prefs = prefsRows.data?.map((p: any) => p.content) || [];
    const style = styleRow.data;

    // Build regression context
    const viewsInsights = regression?.views_insights;
    const boolLifts = viewsInsights?.boolean_feature_lifts || {};
    
    let regressionContext = "No regression data available yet.";
    if (viewsInsights) {
      const liftLines: string[] = [];
      for (const [feature, data] of Object.entries(boolLifts)) {
        const d = data as any;
        if (d?.with_avg && d?.without_avg) {
          const multiplier = (d.with_avg / d.without_avg).toFixed(1);
          liftLines.push(`- ${feature}: ${d.with_avg.toLocaleString()} avg views WITH vs ${d.without_avg.toLocaleString()} WITHOUT (${multiplier}x lift)`);
        }
      }
      const topPos = viewsInsights.top_positive_predictors?.slice(0, 3) || [];
      const topNeg = viewsInsights.top_negative_predictors?.slice(0, 3) || [];
      
      regressionContext = [
        "REGRESSION DATA (from user's actual post performance):",
        ...liftLines,
        topPos.length ? `Top positive predictors: ${topPos.map((p: any) => `${p.feature} (r=${p.correlation?.toFixed(2)})`).join(", ")}` : "",
        topNeg.length ? `Top negative predictors (suppress reach): ${topNeg.map((p: any) => `${p.feature} (r=${p.correlation?.toFixed(2)})`).join(", ")}` : "",
      ].filter(Boolean).join("\n");
    }

    const systemPrompt = `You are a post quality scorer for a Threads content creator. You evaluate posts against 6 criteria using the creator's ACTUAL performance data.

CREATOR CONTEXT:
- Goal: ${profile?.goal_type || "grow_audience"}
- Niche: ${profile?.niche || "not specified"}
- Dream client: ${profile?.dream_client || "not specified"}
- DM keyword: ${profile?.dm_keyword || "none"}
- DM offer: ${profile?.dm_offer || "none"}
- Traffic URL: ${profile?.traffic_url || "none"}
- Writing style: ${style?.selected_style || "default"}${style?.custom_style_description ? ` — ${style.custom_style_description}` : ""}
- Content rules: ${prefs.length ? prefs.join("; ") : "none specified"}

${regressionContext}

SCORING CRITERIA (evaluate each):
1. hook — Hook Strength: First line must be <15 words, no filler, bold statement or question. Does it stop the scroll?
2. credibility — Credibility Signals: Contains specific numbers, dollar amounts, authority names, or concrete proof. Reference the regression data for has_credibility_marker lift if available.
3. suppressors — No Reach Suppressors: Check for hashtags, URLs, emojis that the regression data shows hurt reach. Reference specific negative predictor data.
4. voice — Voice Match: Does the tone match the creator's writing style profile? Is it authentic to them?
5. niche — Niche Specificity: Does it speak directly to the dream client / target audience, not generic?
6. goal — Goal Alignment: Does it serve the creator's goal? For get_comments: has a comment CTA with keyword. For drive_traffic: has link CTA. For grow_audience: maximizes shareability.

IMPORTANT: Your "reason" for each criterion MUST reference the creator's actual data when available (e.g., "your credibility posts average 24,000 views vs 1,000 without"). Do NOT give generic advice.

Return ONLY valid JSON with this exact structure:
{
  "scores": [
    { "id": "hook", "label": "Hook Strength", "passed": true, "reason": "one line explanation" },
    { "id": "credibility", "label": "Credibility Signals", "passed": true, "reason": "..." },
    { "id": "suppressors", "label": "No Reach Suppressors", "passed": true, "reason": "..." },
    { "id": "voice", "label": "Voice Match", "passed": true, "reason": "..." },
    { "id": "niche", "label": "Niche Specificity", "passed": true, "reason": "..." },
    { "id": "goal", "label": "Goal Alignment", "passed": true, "reason": "..." }
  ],
  "total": 6
}`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          { role: "user", content: `Score this post:\n\n${text}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI scoring failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const raw = aiData.content?.[0]?.text || "";
    
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      console.error("Failed to parse AI response:", raw);
      return new Response(JSON.stringify({ error: "Failed to parse scoring response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("score-post error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
