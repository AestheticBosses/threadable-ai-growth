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

function fireStep(
  supabaseUrl: string,
  endpoint: string,
  authToken: string,
  body: Record<string, unknown> = {},
): void {
  fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  })
    .then(async (res) => {
      const text = await res.text().catch(() => "");
      console.log(`[cmo-loop] ${endpoint} → ${res.status} | ${text.slice(0, 300)}`);
    })
    .catch((e) => {
      console.error(`[cmo-loop] ${endpoint} → FIRE ERROR: ${e.message}`);
    });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    console.log(`[cmo-loop] Starting fire-and-forget pipeline for user ${user.id}`);

    // --- Pipeline steps with staggered delays ---
    const steps: PipelineStep[] = [
      { name: "run-analysis", endpoint: "run-analysis" },
      { name: "run-regression", endpoint: "run-regression" },
      { name: "discover-archetypes", endpoint: "discover-archetypes" },
      { name: "branding-plan", endpoint: "generate-plans", body: { plan_type: "branding_plan" } },
      { name: "funnel-strategy", endpoint: "generate-plans", body: { plan_type: "funnel_strategy" } },
      { name: "content-plan", endpoint: "generate-plans", body: { plan_type: "content_plan", include_plans: ["branding_plan", "funnel_strategy"] } },
    ];

    const DELAY_MS = 15_000;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const delay = i * DELAY_MS;
      setTimeout(() => {
        console.log(`[cmo-loop] Firing step: ${step.name} (delay=${delay}ms)`);
        fireStep(supabaseUrl, step.endpoint, jwt, step.body || {});
      }, delay);
    }

    // --- Mark refresh timestamp immediately ---
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ last_weekly_refresh_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateError) {
      console.error("[cmo-loop] Profile update error:", updateError);
    }

    console.log(`[cmo-loop] Pipeline triggered for user ${user.id} — returning immediately`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "CMO pipeline triggered — strategy will update in background",
        steps: steps.map((s, i) => ({ name: s.name, delay_seconds: i * 15 })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[cmo-loop] Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
