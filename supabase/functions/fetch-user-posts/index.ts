import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  console.log("=== FETCH USER POSTS CALLED ===");
  console.log("Method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header exists:", !!authHeader);

    if (!authHeader) {
      console.error("No auth header");
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }).auth.getUser();

    if (userError || !user) {
      console.error("User error:", userError);
      return new Response(JSON.stringify({ error: "Invalid user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("User ID:", user.id);

    // Get profile with Threads token
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("threads_user_id, threads_access_token")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Threads User ID:", profile.threads_user_id);
    console.log("Token exists:", !!profile.threads_access_token);
    console.log("Token length:", profile.threads_access_token?.length);

    if (!profile.threads_user_id || !profile.threads_access_token) {
      return new Response(JSON.stringify({ error: "Threads not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch posts from Threads API
    const threadsUrl = `https://graph.threads.net/v1.0/${profile.threads_user_id}/threads?fields=id,text,timestamp,media_type,shortcode,is_quote_status&access_token=${profile.threads_access_token}&limit=30`;
    console.log("Fetching from Threads API...");

    const threadsResponse = await fetch(threadsUrl);
    const threadsData = await threadsResponse.json();
    console.log("Threads API status:", threadsResponse.status);
    console.log("Threads API response keys:", Object.keys(threadsData));

    if (threadsData.error) {
      console.error("Threads API error:", JSON.stringify(threadsData.error));
      return new Response(
        JSON.stringify({ error: "Threads API error", details: threadsData.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const posts = threadsData.data || [];
    console.log("Posts fetched:", posts.length);

    // Fetch insights for each post and save
    let savedCount = 0;
    for (const post of posts) {
      try {
        console.log("Fetching insights for post:", post.id);
        const insightsUrl = `https://graph.threads.net/v1.0/${post.id}/insights?metric=views,likes,replies,reposts,quotes&access_token=${profile.threads_access_token}`;
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();

        let views = 0,
          likes = 0,
          replies = 0,
          reposts = 0,
          quotes = 0;
        if (insightsData.data) {
          for (const metric of insightsData.data) {
            if (metric.name === "views") views = metric.values?.[0]?.value || 0;
            if (metric.name === "likes") likes = metric.values?.[0]?.value || 0;
            if (metric.name === "replies") replies = metric.values?.[0]?.value || 0;
            if (metric.name === "reposts") reposts = metric.values?.[0]?.value || 0;
            if (metric.name === "quotes") quotes = metric.values?.[0]?.value || 0;
          }
        }

        const engagementRate = views > 0 ? ((likes + replies + reposts + quotes) / views) * 100 : 0;
        const text = post.text || "";
        const lines = text.split("\n");
        const words = text.split(/\s+/).filter(Boolean);
        const lowerText = text.toLowerCase();

        const hasEmoji = (() => {
          for (const ch of text) {
            if (ch.codePointAt(0)! > 127) return true;
          }
          return false;
        })();

        const CREDIBILITY_KEYWORDS = [
          "$", "k/mo", "revenue", "clients", "generated", "scaled",
          "million", "figure", "sold", "built", "grew", "growth",
        ];

        const postedAt = new Date(post.timestamp);

        const { error: upsertError } = await supabase
          .from("posts_analyzed")
          .upsert(
            {
              user_id: user.id,
              threads_media_id: post.id,
              text_content: text,
              media_type: post.media_type || "TEXT",
              posted_at: post.timestamp,
              source: "own",
              views,
              likes,
              replies,
              reposts,
              quotes,
              engagement_rate: parseFloat(engagementRate.toFixed(4)),
              virality_score: views > 0 ? parseFloat((((reposts + quotes) / views) * 100).toFixed(4)) : 0,
              word_count: words.length,
              char_count: text.length,
              line_count: lines.length,
              has_question: text.includes("?"),
              has_credibility_marker: CREDIBILITY_KEYWORDS.some((kw) => lowerText.includes(kw)),
              has_emoji: hasEmoji,
              has_hashtag: text.includes("#"),
              has_url: text.includes("http"),
              starts_with_number: /^\d/.test(text.trim()),
              hour_posted: postedAt.getUTCHours(),
              day_of_week: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][postedAt.getUTCDay()],
            },
            { onConflict: "threads_media_id" }
          );

        if (upsertError) {
          console.error("Upsert error for post", post.id, upsertError);
        } else {
          savedCount++;
        }
      } catch (postError) {
        console.error("Error processing post", post.id, postError);
      }
    }

    console.log("=== DONE. Saved:", savedCount, "posts ===");
    return new Response(
      JSON.stringify({ success: true, total_posts: savedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("=== FATAL ERROR ===", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
