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

    // Get all profiles with valid Threads tokens
    const { data: profiles, error: fetchError } = await supabase
      .from("profiles")
      .select("id, threads_user_id, threads_username, threads_access_token")
      .not("threads_access_token", "is", null)
      .not("threads_user_id", "is", null);

    if (fetchError) {
      console.error("Failed to fetch profiles:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch profiles" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profiles || profiles.length === 0) {
      console.log("No profiles with Threads tokens found");
      return new Response(JSON.stringify({ message: "No profiles to snapshot", snapshots: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Snapshotting followers for ${profiles.length} user(s)`);
    const results: { userId: string; username: string | null; success: boolean; followerCount?: number; error?: string }[] = [];

    for (const profile of profiles) {
      try {
        const url = new URL(`https://graph.threads.net/v1.0/${profile.threads_user_id}`);
        url.searchParams.set("fields", "followers_count");
        url.searchParams.set("access_token", profile.threads_access_token);

        const res = await fetch(url.toString());

        if (!res.ok) {
          const errBody = await res.text();
          console.error(`Follower fetch failed for @${profile.threads_username}:`, errBody);
          results.push({ userId: profile.id, username: profile.threads_username, success: false, error: errBody });
          continue;
        }

        const data = await res.json();
        const followerCount = data.followers_count ?? 0;

        const { error: insertError } = await supabase
          .from("follower_snapshots")
          .insert({
            user_id: profile.id,
            follower_count: followerCount,
          });

        if (insertError) {
          console.error(`Snapshot insert failed for @${profile.threads_username}:`, insertError);
          results.push({ userId: profile.id, username: profile.threads_username, success: false, error: insertError.message });
        } else {
          console.log(`✓ @${profile.threads_username}: ${followerCount} followers`);
          results.push({ userId: profile.id, username: profile.threads_username, success: true, followerCount });
        }
      } catch (e) {
        console.error(`Unexpected error for @${profile.threads_username}:`, e);
        results.push({ userId: profile.id, username: profile.threads_username, success: false, error: String(e) });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({ message: `Snapshotted ${succeeded}, failed ${failed}`, results }),
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
