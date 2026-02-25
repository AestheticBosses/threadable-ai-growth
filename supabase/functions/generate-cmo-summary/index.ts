import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseKey);

    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[cmo-summary] Starting for user ${user.id}`);

    // --- Read CURRENT state (pipeline already updated these) ---
    const [archetypesRes, regressionRes, contentPlanRes] = await Promise.all([
      adminClient
        .from("content_strategies")
        .select("strategy_data")
        .eq("user_id", user.id)
        .eq("strategy_type", "archetype_discovery")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminClient
        .from("content_strategies")
        .select("strategy_data")
        .eq("user_id", user.id)
        .eq("strategy_type", "regression_insights")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminClient
        .from("user_plans")
        .select("plan_data")
        .eq("user_id", user.id)
        .eq("plan_type", "content_plan")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const currentArchetypes = archetypesRes.data?.strategy_data || null;
    const currentRegression = regressionRes.data?.strategy_data || null;
    const currentContentPlan = contentPlanRes.data?.plan_data || null;

    // --- Read PREVIOUS state from snapshots ---
    const { data: previousSnapshot } = await adminClient
      .from("weekly_strategy_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const isFirstRun = !previousSnapshot;
    console.log(
      `[cmo-summary] ${isFirstRun ? "First run — no previous snapshot" : "Previous snapshot found"}`,
    );

    // --- Build prompt ---
    let summaryPrompt: string;

    if (isFirstRun) {
      summaryPrompt = `You are a CMO reviewing a content strategy for the first time. Analyze the current strategy data and return ONLY valid JSON with this structure: {"headline": "string", "changes": [{"type": "string", "change": "string"}], "top_insight": "string", "recommendation": "string"}. Since this is the first analysis, summarize the current strategy strengths and opportunities. Be specific and data-driven, reference actual numbers and patterns.

CURRENT archetypes:
${JSON.stringify(currentArchetypes, null, 2)}

CURRENT regression insights:
${JSON.stringify(currentRegression, null, 2)}

CURRENT content plan:
${JSON.stringify(currentContentPlan, null, 2)}`;
    } else {
      summaryPrompt = `You are a CMO summarizing weekly content strategy changes. Compare the before and after data and return ONLY valid JSON with this structure: {"headline": "string", "changes": [{"type": "string", "change": "string"}], "top_insight": "string", "recommendation": "string"}. Be specific and data-driven, reference actual numbers and patterns.

PREVIOUS archetypes:
${JSON.stringify(previousSnapshot.archetypes, null, 2)}

CURRENT archetypes:
${JSON.stringify(currentArchetypes, null, 2)}

PREVIOUS regression insights:
${JSON.stringify(previousSnapshot.regression_insights, null, 2)}

CURRENT regression insights:
${JSON.stringify(currentRegression, null, 2)}

PREVIOUS content plan:
${JSON.stringify(previousSnapshot.content_plan, null, 2)}

CURRENT content plan:
${JSON.stringify(currentContentPlan, null, 2)}`;
    }

    // --- Call Claude ---
    let summary: any = {
      headline: isFirstRun
        ? "Baseline strategy established"
        : "Weekly strategy refresh completed",
      changes: [],
      top_insight: "Pipeline ran successfully",
      recommendation: "Review your updated content plan",
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: summaryPrompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (claudeRes.ok) {
        const claudeData = await claudeRes.json();
        const text = claudeData.content?.[0]?.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          summary = JSON.parse(jsonMatch[0]);
          console.log("[cmo-summary] Summary generated:", summary.headline);
        }
      } else {
        console.error(
          "[cmo-summary] Claude call failed:",
          claudeRes.status,
          await claudeRes.text().catch(() => ""),
        );
      }
    } catch (e: any) {
      console.error("[cmo-summary] Summary generation error:", e.message);
    }

    // --- Save current state as new snapshot ---
    const { error: snapshotError } = await adminClient
      .from("weekly_strategy_snapshots")
      .insert({
        user_id: user.id,
        archetypes: currentArchetypes,
        regression_insights: currentRegression,
        content_plan: currentContentPlan,
      });

    if (snapshotError) {
      console.error("[cmo-summary] Snapshot insert error:", snapshotError);
    } else {
      console.log("[cmo-summary] Snapshot saved");
    }

    // --- Update profile with summary ---
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ weekly_refresh_summary: summary })
      .eq("id", user.id);

    if (updateError) {
      console.error("[cmo-summary] Profile update error:", updateError);
    }

    console.log(`[cmo-summary] Complete for user ${user.id}`);

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[cmo-summary] Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
