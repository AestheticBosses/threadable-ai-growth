const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("threads_user_id, threads_access_token")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.threads_access_token) {
      return new Response(
        JSON.stringify({ error: "Threads not connected", skipped: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch profile data from Threads API
    const profileUrl = `https://graph.threads.net/v1.0/${profile.threads_user_id}?fields=threads_profile_picture_url,username,name,threads_biography,followers_count&access_token=${profile.threads_access_token}`;
    const profileRes = await fetch(profileUrl);
    const profileJson = await profileRes.json();

    if (profileJson.error) {
      console.error("Threads API error:", JSON.stringify(profileJson.error));
      return new Response(
        JSON.stringify({
          error: profileJson.error.message,
          fallback: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build update payload
    const profileUpdate: Record<string, unknown> = {};
    if (profileJson.username)
      profileUpdate.threads_username = profileJson.username;
    if (profileJson.name) profileUpdate.full_name = profileJson.name;
    if (profileJson.name) profileUpdate.display_name = profileJson.name;
    if (profileJson.threads_profile_picture_url)
      profileUpdate.threads_profile_picture_url =
        profileJson.threads_profile_picture_url;
    if (typeof profileJson.followers_count === "number")
      profileUpdate.follower_count = profileJson.followers_count;
    if (profileJson.followers_count >= 500) profileUpdate.is_established = true;

    if (Object.keys(profileUpdate).length > 0) {
      await adminClient.from("profiles").update(profileUpdate).eq("id", userId);
    }

    // Save follower snapshot (deduplicate: only if last snapshot is different or > 1hr old)
    if (typeof profileJson.followers_count === "number") {
      const { data: lastSnapshot } = await adminClient
        .from("follower_snapshots")
        .select("follower_count, recorded_at")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const shouldInsert =
        !lastSnapshot ||
        lastSnapshot.follower_count !== profileJson.followers_count ||
        Date.now() - new Date(lastSnapshot.recorded_at).getTime() >
          60 * 60 * 1000;

      if (shouldInsert) {
        await adminClient.from("follower_snapshots").insert({
          user_id: userId,
          follower_count: profileJson.followers_count,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        username: profileJson.username,
        name: profileJson.name,
        profile_picture_url: profileJson.threads_profile_picture_url,
        follower_count: profileJson.followers_count,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("refresh-profile error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error", fallback: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
