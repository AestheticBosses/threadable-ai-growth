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
    const { data: { user }, error: userError } = await anonClient.auth.getUser();

    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
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

    // Fetch profile data from Threads API (without followers_count which requires separate call)
    const profileUrl = `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url,threads_biography&access_token=${profile.threads_access_token}`;
    const profileRes = await fetch(profileUrl);
    const profileJson = await profileRes.json();

    if (profileJson.error) {
      console.error("Threads API profile error:", JSON.stringify(profileJson.error));
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

    console.log("Threads profile fetched:", JSON.stringify({ username: profileJson.username, name: profileJson.name, has_pic: !!profileJson.threads_profile_picture_url }));

    // Fetch follower count via Threads Insights API (separate endpoint)
    let followerCount: number | null = null;
    try {
      const insightsUrl = `https://graph.threads.net/v1.0/me/threads_insights?metric=followers_count&access_token=${profile.threads_access_token}`;
      const insightsRes = await fetch(insightsUrl);
      const insightsJson = await insightsRes.json();
      if (insightsJson.data) {
        const fcMetric = insightsJson.data.find((m: any) => m.name === "followers_count");
        if (fcMetric?.total_value?.value != null) {
          followerCount = fcMetric.total_value.value;
        }
      }
      if (insightsJson.error) {
        console.error("Insights API error:", JSON.stringify(insightsJson.error));
      }
    } catch (e) {
      console.error("Follower count fetch failed:", e);
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
    if (followerCount !== null) {
      profileUpdate.follower_count = followerCount;
      if (followerCount >= 500) profileUpdate.is_established = true;
    }

    if (Object.keys(profileUpdate).length > 0) {
      await adminClient.from("profiles").update(profileUpdate).eq("id", userId);
    }

    // Save follower snapshot (deduplicate: only if last snapshot is different or > 1hr old)
    if (followerCount !== null) {
      const { data: lastSnapshot } = await adminClient
        .from("follower_snapshots")
        .select("follower_count, recorded_at")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const shouldInsert =
        !lastSnapshot ||
        lastSnapshot.follower_count !== followerCount ||
        Date.now() - new Date(lastSnapshot.recorded_at).getTime() >
          60 * 60 * 1000;

      if (shouldInsert) {
        await adminClient.from("follower_snapshots").insert({
          user_id: userId,
          follower_count: followerCount,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        username: profileJson.username,
        name: profileJson.name,
        profile_picture_url: profileJson.threads_profile_picture_url,
        follower_count: followerCount,
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
