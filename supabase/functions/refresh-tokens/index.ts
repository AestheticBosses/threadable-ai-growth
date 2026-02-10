const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find profiles with tokens expiring within 10 days
    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

    const { data: profiles, error: fetchError } = await supabase
      .from("profiles")
      .select("id, threads_username, threads_access_token, threads_token_expires_at")
      .not("threads_access_token", "is", null)
      .lte("threads_token_expires_at", tenDaysFromNow.toISOString());

    if (fetchError) {
      console.error("Failed to fetch profiles:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch profiles" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profiles || profiles.length === 0) {
      console.log("No tokens need refreshing");
      return new Response(JSON.stringify({ message: "No tokens need refreshing", refreshed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${profiles.length} token(s) to refresh`);
    const results: { userId: string; username: string | null; success: boolean; error?: string }[] = [];

    for (const profile of profiles) {
      try {
        const refreshUrl = new URL("https://graph.threads.net/refresh_access_token");
        refreshUrl.searchParams.set("grant_type", "th_refresh_token");
        refreshUrl.searchParams.set("access_token", profile.threads_access_token);

        const res = await fetch(refreshUrl.toString());

        if (!res.ok) {
          const errBody = await res.text();
          console.error(`Token refresh failed for @${profile.threads_username}:`, errBody);
          results.push({ userId: profile.id, username: profile.threads_username, success: false, error: errBody });
          continue;
        }

        const { access_token: newToken } = await res.json();

        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 60);

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            threads_access_token: newToken,
            threads_token_expires_at: newExpiry.toISOString(),
          })
          .eq("id", profile.id);

        if (updateError) {
          console.error(`DB update failed for @${profile.threads_username}:`, updateError);
          results.push({ userId: profile.id, username: profile.threads_username, success: false, error: updateError.message });
        } else {
          console.log(`✓ Refreshed token for @${profile.threads_username}, expires ${newExpiry.toISOString()}`);
          results.push({ userId: profile.id, username: profile.threads_username, success: true });
        }
      } catch (e) {
        console.error(`Unexpected error for @${profile.threads_username}:`, e);
        results.push({ userId: profile.id, username: profile.threads_username, success: false, error: String(e) });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({ message: `Refreshed ${succeeded}, failed ${failed}`, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
