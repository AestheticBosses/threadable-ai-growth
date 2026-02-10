import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find approved posts that are due
    const now = new Date().toISOString();
    const { data: duePosts, error: fetchErr } = await adminClient
      .from("scheduled_posts")
      .select("id, user_id, text_content")
      .eq("status", "approved")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(5);

    if (fetchErr) {
      console.error("Fetch error:", fetchErr);
      return new Response(JSON.stringify({ error: "Failed to fetch posts" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!duePosts || duePosts.length === 0) {
      return new Response(JSON.stringify({ published: 0, failed: 0, errors: [], message: "No posts due" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by user to check daily limits and tokens
    const userIds = [...new Set(duePosts.map((p) => p.user_id))];

    // Fetch profiles for all relevant users
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, threads_access_token, threads_user_id, threads_token_expires_at")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    // Check today's published count per user
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { data: todayCounts } = await adminClient
      .from("scheduled_posts")
      .select("user_id")
      .eq("status", "published")
      .gte("published_at", todayStart.toISOString())
      .in("user_id", userIds);

    const publishedToday = new Map<string, number>();
    for (const row of todayCounts || []) {
      publishedToday.set(row.user_id, (publishedToday.get(row.user_id) || 0) + 1);
    }

    let published = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < duePosts.length; i++) {
      const post = duePosts[i];
      const profile = profileMap.get(post.user_id);

      // Check profile exists
      if (!profile) {
        await adminClient.from("scheduled_posts").update({
          status: "failed", error_message: "User profile not found",
        }).eq("id", post.id);
        failed++;
        errors.push(`${post.id}: Profile not found`);
        continue;
      }

      // Check token exists
      if (!profile.threads_access_token || !profile.threads_user_id) {
        await adminClient.from("scheduled_posts").update({
          status: "failed", error_message: "Threads not connected — connect your account first",
        }).eq("id", post.id);
        failed++;
        errors.push(`${post.id}: Threads not connected`);
        continue;
      }

      // Check token expiry
      if (profile.threads_token_expires_at) {
        const expiresAt = new Date(profile.threads_token_expires_at);
        if (expiresAt <= new Date()) {
          await adminClient.from("scheduled_posts").update({
            status: "failed", error_message: "Token expired — reconnect Threads",
          }).eq("id", post.id);
          failed++;
          errors.push(`${post.id}: Token expired`);
          continue;
        }
      }

      // Check daily limit (30 per user per day)
      const userCount = publishedToday.get(post.user_id) || 0;
      if (userCount >= 30) {
        await adminClient.from("scheduled_posts").update({
          status: "failed", error_message: "Daily publishing limit reached (30 posts/day)",
        }).eq("id", post.id);
        failed++;
        errors.push(`${post.id}: Daily limit reached`);
        continue;
      }

      try {
        // Step 1: Create media container
        const createParams = new URLSearchParams({
          media_type: "TEXT",
          text: post.text_content || "",
          access_token: profile.threads_access_token,
        });

        const createRes = await fetch(
          `https://graph.threads.net/v1.0/${profile.threads_user_id}/threads`,
          { method: "POST", body: createParams }
        );
        const createData = await createRes.json();

        if (!createRes.ok || !createData.id) {
          const errMsg = createData.error?.message || JSON.stringify(createData);
          await adminClient.from("scheduled_posts").update({
            status: "failed", error_message: `Container creation failed: ${errMsg}`,
          }).eq("id", post.id);
          failed++;
          errors.push(`${post.id}: ${errMsg}`);
          if (i < duePosts.length - 1) await sleep(3000);
          continue;
        }

        // Step 2: Wait for container processing
        await sleep(2000);

        // Step 3: Publish
        const publishParams = new URLSearchParams({
          creation_id: createData.id,
          access_token: profile.threads_access_token,
        });

        const publishRes = await fetch(
          `https://graph.threads.net/v1.0/${profile.threads_user_id}/threads_publish`,
          { method: "POST", body: publishParams }
        );
        const publishData = await publishRes.json();

        if (!publishRes.ok || !publishData.id) {
          const errMsg = publishData.error?.message || JSON.stringify(publishData);
          await adminClient.from("scheduled_posts").update({
            status: "failed", error_message: `Publishing failed: ${errMsg}`,
          }).eq("id", post.id);
          failed++;
          errors.push(`${post.id}: ${errMsg}`);
        } else {
          await adminClient.from("scheduled_posts").update({
            status: "published",
            threads_media_id: publishData.id,
            published_at: new Date().toISOString(),
            error_message: null,
          }).eq("id", post.id);
          published++;
          publishedToday.set(post.user_id, userCount + 1);
        }
      } catch (e: any) {
        await adminClient.from("scheduled_posts").update({
          status: "failed", error_message: `Unexpected error: ${e.message}`,
        }).eq("id", post.id);
        failed++;
        errors.push(`${post.id}: ${e.message}`);
      }

      // Delay between posts
      if (i < duePosts.length - 1) await sleep(3000);
    }

    return new Response(JSON.stringify({ published, failed, errors }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("publish-post error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
