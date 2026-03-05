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

async function runStep(
  supabaseUrl: string,
  endpoint: string,
  authToken: string,
  body: Record<string, unknown> = {},
): Promise<{ ok: boolean; status: number; message: string }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, message: text.slice(0, 300) };
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

    // --- Mark refresh timestamp FIRST so frontend knows pipeline is running ---
    const { data: profileData, error: updateError } = await adminClient
      .from("profiles")
      .update({ last_weekly_refresh_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("timezone")
      .single();

    if (updateError) {
      console.error("[cmo-loop] Profile update error:", updateError);
    }

    const userTimezone = (profileData as any)?.timezone || null;
    console.log(`[cmo-loop] User timezone: ${userTimezone}`);

    console.log(`[cmo-loop] Pipeline triggered for user ${user.id} — running in background via waitUntil`);

    // --- Build timezone-aware time info for generate-plans ---
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let clientDay: string;
    let clientNowMinutes: number;
    if (userTimezone) {
      try {
        const userNow = new Date(new Date().toLocaleString("en-US", { timeZone: userTimezone }));
        clientDay = dayNames[userNow.getDay()];
        clientNowMinutes = userNow.getHours() * 60 + userNow.getMinutes();
      } catch {
        clientDay = dayNames[new Date().getDay()];
        clientNowMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
      }
    } else {
      clientDay = dayNames[new Date().getDay()];
      clientNowMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
    }

    // --- Run all steps sequentially in the background ---
    const steps: PipelineStep[] = [
      { name: "run-analysis", endpoint: "run-analysis" },
      { name: "run-regression", endpoint: "run-regression" },
      { name: "discover-archetypes", endpoint: "discover-archetypes" },
      { name: "branding-plan", endpoint: "generate-plans", body: { plan_type: "branding_plan", client_day: clientDay, client_now_minutes: clientNowMinutes, client_timezone: userTimezone } },
      { name: "funnel-strategy", endpoint: "generate-plans", body: { plan_type: "funnel_strategy", client_day: clientDay, client_now_minutes: clientNowMinutes, client_timezone: userTimezone } },
      { name: "content-plan", endpoint: "generate-plans", body: { plan_type: "content_plan", include_plans: ["branding_plan", "funnel_strategy"], client_day: clientDay, client_now_minutes: clientNowMinutes, client_timezone: userTimezone } },
      { name: "generate-cmo-summary", endpoint: "generate-cmo-summary" },
    ];

    // EdgeRuntime.waitUntil keeps the function alive after the response is sent.
    // The sequential pipeline runs in the background (up to 400s on paid plan).
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime.waitUntil((async () => {
      const pipelineStart = Date.now();
      console.log(`[cmo-loop] Background pipeline starting for user ${user.id}`);

      for (const step of steps) {
        const stepStart = Date.now();
        console.log(`[cmo-loop] >>> Starting step: ${step.name}`);

        try {
          const result = await runStep(supabaseUrl, step.endpoint, jwt, step.body || {});
          const durationMs = Date.now() - stepStart;
          console.log(`[cmo-loop] <<< ${step.name} → ${result.status} (${durationMs}ms) | ${result.message}`);
        } catch (err: any) {
          const durationMs = Date.now() - stepStart;
          console.error(`[cmo-loop] <<< ${step.name} → ERROR (${durationMs}ms): ${err.message}`);
        }
      }

      const totalMs = Date.now() - pipelineStart;
      console.log(`[cmo-loop] Background pipeline complete for user ${user.id} — ${totalMs}ms total`);
    })());

    // Return immediately — pipeline runs in background
    return new Response(
      JSON.stringify({
        success: true,
        message: "CMO pipeline triggered — strategy will update in background",
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
