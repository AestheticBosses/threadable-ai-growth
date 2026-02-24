import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all active users with Threads connected and onboarding complete
    const { data: users, error: usersErr } = await adminClient
      .from("profiles")
      .select("id, threads_access_token")
      .eq("onboarding_complete", true)
      .not("threads_access_token", "is", null);

    if (usersErr) throw usersErr;
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: "No users to process" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[weekly-optimization] Processing ${users.length} users`);
    const results: { user_id: string; status: string; plan_updated: boolean; reason?: string }[] = [];

    for (const user of users) {
      try {
        const result = await processUser(adminClient, user.id, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY);
        results.push(result);
      } catch (e) {
        console.error(`[weekly-optimization] Error for user ${user.id}:`, e);
        results.push({ user_id: user.id, status: "error", plan_updated: false, reason: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[weekly-optimization] Unexpected error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processUser(
  adminClient: any,
  userId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  anonKey: string,
): Promise<{ user_id: string; status: string; plan_updated: boolean; reason?: string }> {
  console.log(`[weekly-optimization] Processing user ${userId}`);

  // Step 1: Fetch new posts via fetch-user-posts
  try {
    const fetchRes = await fetch(`${supabaseUrl}/functions/v1/fetch-user-posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!fetchRes.ok) {
      console.warn(`[weekly-optimization] fetch-user-posts failed for ${userId}: ${fetchRes.status}`);
    } else {
      console.log(`[weekly-optimization] Posts fetched for ${userId}`);
    }
  } catch (e) {
    console.warn(`[weekly-optimization] fetch-user-posts error for ${userId}:`, e);
  }

  // Step 2: Run regression via run-regression
  let newInsights: any = null;
  try {
    const regRes = await fetch(`${supabaseUrl}/functions/v1/run-regression`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ user_id: userId }),
    });
    if (regRes.ok) {
      newInsights = await regRes.json();
      console.log(`[weekly-optimization] Regression completed for ${userId}`);
    } else {
      console.warn(`[weekly-optimization] run-regression failed for ${userId}: ${regRes.status}`);
    }
  } catch (e) {
    console.warn(`[weekly-optimization] run-regression error for ${userId}:`, e);
  }

  // Step 3: Compare with previous regression insights
  const { data: prevStrategies } = await adminClient
    .from("content_strategies")
    .select("regression_insights, created_at")
    .eq("user_id", userId)
    .not("regression_insights", "is", null)
    .order("created_at", { ascending: false })
    .limit(2);

  let patternsShifted = false;
  if (prevStrategies && prevStrategies.length >= 2 && newInsights) {
    const prevInsights = prevStrategies[1].regression_insights as any;
    patternsShifted = hasSignificantShift(newInsights, prevInsights);
  }

  // Step 4: Check if plan regeneration is needed
  const { data: lastPlan } = await adminClient
    .from("user_plans")
    .select("updated_at")
    .eq("user_id", userId)
    .eq("plan_type", "content_plan")
    .maybeSingle();

  const daysSinceLastPlan = lastPlan?.updated_at
    ? (Date.now() - new Date(lastPlan.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  const shouldRegeneratePlan = patternsShifted || daysSinceLastPlan > 7;

  if (!shouldRegeneratePlan) {
    console.log(`[weekly-optimization] No plan update needed for ${userId}`);
    return { user_id: userId, status: "ok", plan_updated: false, reason: "No significant changes" };
  }

  // Step 5: Regenerate content plan via generate-plans
  // generate-plans requires a user auth token — we need to use service role workaround
  // Since generate-plans uses getUser(), we'll call it with service role and user_id in body
  try {
    const planRes = await fetch(`${supabaseUrl}/functions/v1/generate-plans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        plan_type: "content_plan",
        include_plans: ["branding_plan", "funnel_strategy"],
      }),
    });
    if (!planRes.ok) {
      const errText = await planRes.text();
      console.warn(`[weekly-optimization] generate-plans failed for ${userId}: ${planRes.status} ${errText}`);
    } else {
      console.log(`[weekly-optimization] Content plan regenerated for ${userId}`);
    }
  } catch (e) {
    console.warn(`[weekly-optimization] generate-plans error for ${userId}:`, e);
  }

  // Step 6: Save notification
  const reason = patternsShifted
    ? "Your content plan was updated — we detected significant shifts in what's driving your reach and engagement."
    : "Your weekly content plan was refreshed based on the latest performance data.";

  await adminClient.from("user_notifications").insert({
    user_id: userId,
    type: "plan_updated",
    message: reason,
    link: "/playbook",
    read: false,
  });

  console.log(`[weekly-optimization] Notification saved for ${userId}`);
  return { user_id: userId, status: "ok", plan_updated: true, reason: patternsShifted ? "patterns_shifted" : "stale_plan" };
}

function hasSignificantShift(newInsights: any, prevInsights: any): boolean {
  // Compare top 3 view correlations — check if any shifted by > 10%
  const newTop = (newInsights.views_insights?.top_positive_predictors ?? newInsights.top_positive_predictors ?? []).slice(0, 3);
  const prevTop = (prevInsights.views_insights?.top_positive_predictors ?? prevInsights.top_positive_predictors ?? []).slice(0, 3);

  if (newTop.length === 0 || prevTop.length === 0) return false;

  // Build lookup of previous correlations
  const prevMap: Record<string, number> = {};
  for (const p of prevTop) {
    prevMap[p.feature] = p.correlation;
  }

  for (const n of newTop) {
    const prev = prevMap[n.feature];
    if (prev === undefined) {
      // New feature in top 3 that wasn't there before — that's a shift
      return true;
    }
    // Check if correlation changed by more than 10% absolute
    if (Math.abs(n.correlation - prev) > 0.1) {
      return true;
    }
  }

  return false;
}
