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
        .select("regression_insights")
        .eq("user_id", user.id)
        .not("regression_insights", "is", null)
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
    const currentRegression = regressionRes.data?.regression_insights || null;
    const currentContentPlan = contentPlanRes.data?.plan_data || null;

    // --- Find the last MEANINGFULLY DIFFERENT snapshot ---
    const { data: recentSnapshots } = await adminClient
      .from("weekly_strategy_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    const currentAStr = JSON.stringify(currentArchetypes);
    const currentRStr = JSON.stringify(currentRegression);
    const currentCStr = JSON.stringify(currentContentPlan);

    let previousSnapshot: any = null;
    for (const snap of (recentSnapshots ?? [])) {
      const samA = JSON.stringify(snap.archetypes) === currentAStr;
      const samR = JSON.stringify(snap.regression_insights) === currentRStr;
      const samC = JSON.stringify(snap.content_plan) === currentCStr;
      if (!samA || !samR || !samC) {
        previousSnapshot = snap;
        break;
      }
    }

    const isFirstRun = !previousSnapshot;
    console.log(
      `[cmo-summary] ${isFirstRun ? "No meaningfully different snapshot found — treating as first run" : `Using snapshot from ${previousSnapshot.created_at} for comparison`}`,
    );

    // --- Build prompt ---
    const cmoVoiceRules = `VOICE & TONE — You are a sharp, experienced CMO briefing a founder over coffee. Not an AI generating a report.
- Use plain language a non-marketer would understand. No jargon without explanation.
- Be direct and opinionated. Say "Do this" and "Stop doing that" — not "Consider exploring."
- Ground every recommendation in a specific number or result from the data.
- If something is working, say WHY it's working in simple terms.
- If something is underperforming, say what to do about it specifically.

OUTPUT FORMAT — Return ONLY valid JSON with this exact structure:
{"headline": "string", "changes": ["string", "string"], "top_insight": "string", "recommendation": "string"}

FIELD RULES:
- headline: One punchy sentence a founder can act on. A directive, not a summary. Example good: "Your credibility posts are crushing it — shift 35% of your content there this week." Example bad: "Content Strategy Evolution: Streamlined Archetypes with Enhanced Performance Focus."
- changes: Array of plain-English strings. Each describes what shifted and WHY, tied to actual data. Include before vs after numbers when available. No labels like "archetype_consolidation" — just clear bullets.
- top_insight: The single most important thing the data is telling them. One sentence, specific, with a number.
- recommendation: The #1 action they should take this week. Specific, actionable, measurable. Not "consider" or "explore" — tell them exactly what to do and why.`;

    let summaryPrompt: string;

    if (isFirstRun) {
      summaryPrompt = `${cmoVoiceRules}

You are reviewing this creator's content strategy for the first time. There is no previous data to compare — this is their baseline. Analyze what they have and tell them what's strong, what's weak, and what to do first.

CURRENT archetypes:
${JSON.stringify(currentArchetypes, null, 2)}

CURRENT regression insights:
${JSON.stringify(currentRegression, null, 2)}

CURRENT content plan:
${JSON.stringify(currentContentPlan, null, 2)}

For the "changes" array, describe the key strengths and gaps you see in their current strategy (3-4 bullets). For the headline, give them the single most important takeaway about their starting position.`;
    } else {
      summaryPrompt = `${cmoVoiceRules}

COMPARISON RULES — Be precise about what actually changed:
- If archetype COUNT changed: say "Consolidated from X to Y" or "Expanded from X to Y" and explain why.
- If archetype NAMES changed but the count is the same: say "Repositioned X archetypes" and describe the angle shift. NEVER say "reduced from 5 to 5" — that's not a reduction.
- If archetype weights/percentages shifted: describe the reallocation as a strategic bet — what are you betting more on and why.
- If regression insights changed: focus on what NEW correlations emerged or what old ones got stronger/weaker.
- If the content plan shifted: describe the practical impact — what's different about what they'll post this week.
- If nothing meaningful changed in a category: skip it entirely. Don't manufacture fake changes.

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
${JSON.stringify(currentContentPlan, null, 2)}

Compare before and after. Only describe changes that actually happened. Be honest — if the data barely changed, say so and focus on what the stable patterns mean.`;
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
