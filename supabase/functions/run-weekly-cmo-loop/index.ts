import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PipelineStep {
  name: string;
  endpoint: string;
  body?: Record<string, unknown>;
}

async function callFunction(
  supabaseUrl: string,
  endpoint: string,
  authToken: string,
  body: Record<string, unknown> = {},
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const rawText = await res.text();
    console.log(`[cmo-loop] ${endpoint} → ${res.status} | ${rawText.slice(0, 500)}`);

    let data: any = null;
    try { data = JSON.parse(rawText); } catch { /* non-JSON response */ }

    if (!res.ok) {
      return { ok: false, status: res.status, error: data?.error || `HTTP ${res.status}: ${rawText.slice(0, 200)}` };
    }
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    clearTimeout(timeout);
    const msg = e.name === "AbortError" ? "Timed out after 90s" : e.message;
    console.log(`[cmo-loop] ${endpoint} → EXCEPTION: ${msg}`);
    return { ok: false, status: 0, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // --- Auth ---
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

    console.log(`[cmo-loop] Starting for user ${user.id}`);

    // --- Fetch BEFORE state ---
    const [beforeArchetypesRes, beforeRegressionRes] = await Promise.all([
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
        .select("regression_insights")
        .eq("user_id", user.id)
        .eq("strategy_type", "weekly")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const beforeArchetypes = beforeArchetypesRes.data?.strategy_data || null;
    const beforeRegression = beforeRegressionRes.data?.regression_insights || null;
    console.log("[cmo-loop] Before state captured");

    // --- Run pipeline sequentially ---
    const steps: PipelineStep[] = [
      { name: "run-analysis", endpoint: "run-analysis" },
      { name: "run-regression", endpoint: "run-regression" },
      { name: "discover-archetypes", endpoint: "discover-archetypes" },
      { name: "branding-plan", endpoint: "generate-plans", body: { plan_type: "branding_plan" } },
      { name: "funnel-strategy", endpoint: "generate-plans", body: { plan_type: "funnel_strategy" } },
      { name: "content-plan", endpoint: "generate-plans", body: { plan_type: "content_plan", include_plans: ["branding_plan", "funnel_strategy"] } },
    ];

    const stepResults: { name: string; ok: boolean; error?: string }[] = [];

    for (const step of steps) {
      console.log(`[cmo-loop] Step: ${step.name} — starting`);
      const result = await callFunction(supabaseUrl, step.endpoint, jwt, step.body || {});
      stepResults.push({ name: step.name, ok: result.ok, error: result.error });
      if (result.ok) {
        console.log(`[cmo-loop] Step: ${step.name} — complete`);
      } else {
        console.error(`[cmo-loop] Step: ${step.name} — FAILED: ${result.error}`);
      }
    }

    // --- Fetch AFTER state ---
    const [afterArchetypesRes, afterRegressionRes] = await Promise.all([
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
        .select("regression_insights")
        .eq("user_id", user.id)
        .eq("strategy_type", "weekly")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const afterArchetypes = afterArchetypesRes.data?.strategy_data || null;
    const afterRegression = afterRegressionRes.data?.regression_insights || null;
    console.log("[cmo-loop] After state captured");

    // --- Generate what-changed summary ---
    const summaryPrompt = `You are a CMO summarizing what changed in a content strategy. Compare the before and after data and return ONLY valid JSON with this structure: {"headline": "string", "changes": [{"type": "string", "change": "string"}], "top_insight": "string", "recommendation": "string"}. Be specific and data-driven.

BEFORE archetypes:
${JSON.stringify(beforeArchetypes, null, 2)}

AFTER archetypes:
${JSON.stringify(afterArchetypes, null, 2)}

BEFORE regression insights:
${JSON.stringify(beforeRegression, null, 2)}

AFTER regression insights:
${JSON.stringify(afterRegression, null, 2)}

Pipeline step results:
${JSON.stringify(stepResults, null, 2)}`;

    let summary: any = { headline: "Weekly refresh completed", changes: [], top_insight: "Pipeline ran successfully", recommendation: "Review your updated content plan" };

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
          console.log("[cmo-loop] Summary generated:", summary.headline);
        }
      } else {
        console.error("[cmo-loop] Claude summary call failed:", claudeRes.status);
      }
    } catch (e: any) {
      console.error("[cmo-loop] Summary generation error:", e.message);
    }

    // --- Update profiles ---
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        last_weekly_refresh_at: new Date().toISOString(),
        weekly_refresh_summary: summary,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("[cmo-loop] Profile update error:", updateError);
    }

    console.log(`[cmo-loop] Complete for user ${user.id}`);

    return new Response(JSON.stringify({ success: true, summary, steps: stepResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[cmo-loop] Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
