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

  // Step 2: Backfill missing post_results for posts older than 48 hours
  await backfillPostResults(adminClient, userId);

  // Step 3: Run regression via run-regression
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

  // Step 4: Compare with previous regression insights
  const { data: prevStrategies } = await adminClient
    .from("content_strategies")
    .select("regression_insights, created_at")
    .eq("user_id", userId)
    .eq("strategy_type", "regression")
    .order("created_at", { ascending: false })
    .limit(2);

  let shiftCount = 0;
  if (prevStrategies && prevStrategies.length >= 2 && newInsights) {
    const prevInsights = prevStrategies[1].regression_insights as any;
    shiftCount = countSignificantShifts(newInsights, prevInsights);
  }

  // Step 5: Check if plan regeneration is needed
  const { data: lastPlan } = await adminClient
    .from("user_plans")
    .select("updated_at")
    .eq("user_id", userId)
    .eq("plan_type", "content_plan")
    .maybeSingle();

  const daysSinceLastPlan = lastPlan?.updated_at
    ? (Date.now() - new Date(lastPlan.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  const patternsShifted = shiftCount >= 1;
  const fullCascade = shiftCount >= 2 || daysSinceLastPlan > 7;
  const shouldRegenerate = patternsShifted || daysSinceLastPlan > 7;

  if (!shouldRegenerate) {
    console.log(`[weekly-optimization] No plan update needed for ${userId}`);
    return { user_id: userId, status: "ok", plan_updated: false, reason: "No significant changes" };
  }

  const serviceHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  if (fullCascade) {
    // Step 6a: Full cascade regeneration — each step depends on the previous
    console.log(`[weekly-optimization] Running FULL cascade for ${userId} (${shiftCount} shifts, ${Math.round(daysSinceLastPlan)}d old)`);

    const cascadeSteps = [
      { name: "discover-archetypes", body: { user_id: userId } },
      { name: "generate-content-buckets", body: { user_id: userId } },
      { name: "generate-content-pillars", body: { user_id: userId } },
      { name: "generate-plans", body: { plan_type: "branding_plan", user_id: userId } },
      { name: "generate-plans", body: { plan_type: "funnel_strategy", user_id: userId } },
      { name: "generate-plans", body: { plan_type: "content_plan", user_id: userId } },
    ];

    for (const step of cascadeSteps) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${step.name}`, {
          method: "POST",
          headers: serviceHeaders,
          body: JSON.stringify(step.body),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.warn(`[weekly-optimization] ${step.name} failed for ${userId}: ${res.status} ${errText.slice(0, 200)}`);
        } else {
          console.log(`[weekly-optimization] ${step.name} completed for ${userId}`);
        }
      } catch (e) {
        console.warn(`[weekly-optimization] ${step.name} error for ${userId}:`, e);
      }
    }
  } else {
    // Step 6b: Minor shift — content plan only
    console.log(`[weekly-optimization] Running content plan only for ${userId} (${shiftCount} shift)`);
    try {
      const planRes = await fetch(`${supabaseUrl}/functions/v1/generate-plans`, {
        method: "POST",
        headers: serviceHeaders,
        body: JSON.stringify({ plan_type: "content_plan", user_id: userId }),
      });
      if (!planRes.ok) {
        const errText = await planRes.text();
        console.warn(`[weekly-optimization] generate-plans failed for ${userId}: ${planRes.status} ${errText.slice(0, 200)}`);
      } else {
        console.log(`[weekly-optimization] Content plan regenerated for ${userId}`);
      }
    } catch (e) {
      console.warn(`[weekly-optimization] generate-plans error for ${userId}:`, e);
    }
  }

  // Step 7: Save notification
  const reason = fullCascade
    ? "Your full content strategy was updated based on last week's performance data — archetypes, pillars, and content plan refreshed."
    : "Your weekly content plan was refreshed based on recent performance data.";

  await adminClient.from("user_notifications").insert({
    user_id: userId,
    type: "plan_updated",
    message: reason,
    link: "/playbook",
    read: false,
  });

  console.log(`[weekly-optimization] Notification saved for ${userId}`);
  return { user_id: userId, status: "ok", plan_updated: true, reason: fullCascade ? "full_cascade" : "content_plan_only" };
}

function countSignificantShifts(newInsights: any, prevInsights: any): number {
  const newTop = (newInsights.views_insights?.top_positive_predictors ?? newInsights.top_positive_predictors ?? []).slice(0, 3);
  const prevTop = (prevInsights.views_insights?.top_positive_predictors ?? prevInsights.top_positive_predictors ?? []).slice(0, 3);

  if (newTop.length === 0 || prevTop.length === 0) return 0;

  const prevMap: Record<string, number> = {};
  for (const p of prevTop) {
    prevMap[p.feature] = p.correlation;
  }

  let shifts = 0;
  for (const n of newTop) {
    const prev = prevMap[n.feature];
    if (prev === undefined) {
      shifts++;
    } else if (Math.abs(n.correlation - prev) > 0.1) {
      shifts++;
    }
  }

  return shifts;
}

async function backfillPostResults(adminClient: any, userId: string) {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get published posts from last 7 days that are older than 48h
  const { data: recentPosts } = await adminClient
    .from("scheduled_posts")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "published")
    .gte("published_at", sevenDaysAgo)
    .lte("published_at", fortyEightHoursAgo);

  if (!recentPosts || recentPosts.length === 0) return;

  // Get existing post_results for these posts
  const postIds = recentPosts.map((p: any) => p.id);
  const { data: existingResults } = await adminClient
    .from("post_results")
    .select("post_id")
    .in("post_id", postIds);

  const coveredIds = new Set((existingResults || []).map((r: any) => r.post_id));
  const missingIds = postIds.filter((id: string) => !coveredIds.has(id));

  if (missingIds.length === 0) return;

  // Calculate medians from user's history
  const { data: history } = await adminClient
    .from("post_results")
    .select("comments_received, link_clicks, dm_replies")
    .eq("user_id", userId)
    .eq("is_estimated", false);

  let medianComments = 2, medianClicks = 5, medianDm = 1;

  if (history && history.length > 0) {
    const median = (arr: number[]) => {
      const sorted = arr.filter((v) => v != null).sort((a, b) => a - b);
      if (sorted.length === 0) return 0;
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    };
    medianComments = median(history.map((h: any) => h.comments_received)) || 2;
    medianClicks = median(history.map((h: any) => h.link_clicks)) || 5;
    medianDm = median(history.map((h: any) => h.dm_replies)) || 1;
  }

  // Insert estimated results
  const rows = missingIds.map((postId: string) => ({
    user_id: userId,
    post_id: postId,
    comments_received: medianComments,
    link_clicks: medianClicks,
    dm_replies: medianDm,
    is_estimated: true,
  }));

  const { error } = await adminClient.from("post_results").insert(rows);
  if (error) {
    console.warn(`[weekly-optimization] backfill error for ${userId}:`, error);
  } else {
    console.log(`[weekly-optimization] Backfilled ${rows.length} post_results for ${userId}`);
  }
}
