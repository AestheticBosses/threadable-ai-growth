import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CREDIBILITY_KEYWORDS = [
  "$", "k/mo", "revenue", "clients", "generated", "scaled",
  "million", "figure", "sold", "built", "grew", "growth",
];

function hasEmojiOrSpecial(text: string): boolean {
  for (const ch of text) {
    if (ch.codePointAt(0)! > 127) return true;
  }
  return false;
}

function enrichPost(post: any, insights: Record<string, number>) {
  const text: string = post.text || "";
  const lines = text.split("\n");
  const words = text.split(/\s+/).filter(Boolean);

  const views = insights.views || 0;
  const likes = insights.likes || 0;
  const replies = insights.replies || 0;
  const reposts = insights.reposts || 0;
  const quotes = insights.quotes || 0;
  const shares = insights.shares || 0;

  const totalEngagement = likes + replies + reposts + quotes + shares;
  const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;
  const viralityScore = views > 0 ? ((reposts + quotes + shares) / views) * 100 : 0;

  const postedAt = new Date(post.timestamp);
  const lowerText = text.toLowerCase();

  return {
    threads_media_id: post.id,
    text_content: text,
    media_type: post.media_type || "TEXT",
    posted_at: post.timestamp,
    views,
    likes,
    replies,
    reposts,
    quotes,
    shares,
    clicks: 0,
    word_count: words.length,
    char_count: text.length,
    line_count: lines.length,
    has_question: text.includes("?"),
    has_credibility_marker: CREDIBILITY_KEYWORDS.some((kw) => lowerText.includes(kw)),
    has_emoji: hasEmojiOrSpecial(text),
    has_hashtag: text.includes("#"),
    has_url: text.includes("http"),
    starts_with_number: /^\d/.test(text.trim()),
    engagement_rate: engagementRate,
    virality_score: viralityScore,
    hour_posted: postedAt.getUTCHours(),
    day_of_week: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][postedAt.getUTCDay()],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Parse body
    const body = await req.json();
    const usernames: string[] = body.usernames || [];

    if (!usernames.length || usernames.length > 5) {
      return new Response(
        JSON.stringify({ error: "Provide 1-5 usernames" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's Threads credentials for API access
    const { data: profile } = await adminClient
      .from("profiles")
      .select("threads_access_token")
      .eq("id", userId)
      .single();

    if (!profile?.threads_access_token) {
      return new Response(
        JSON.stringify({ error: "Threads account not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = profile.threads_access_token;
    const allEnrichedPosts: any[] = [];

    for (const username of usernames) {
      const trimmed = username.trim().replace(/^@/, "");
      if (!trimmed) continue;

      try {
        // Search for user's posts using keyword search
        const searchUrl = new URL("https://graph.threads.net/v1.0/threads/search");
        searchUrl.searchParams.set("q", `from:${trimmed}`);
        searchUrl.searchParams.set("fields", "id,text,timestamp,media_type,permalink");
        searchUrl.searchParams.set("limit", "25");
        searchUrl.searchParams.set("access_token", accessToken);

        const searchRes = await fetch(searchUrl.toString());

        if (!searchRes.ok) {
          console.error(`Search failed for @${trimmed}:`, await searchRes.text());
          continue;
        }

        const searchJson = await searchRes.json();
        const posts = searchJson.data || [];

        for (const post of posts.slice(0, 40)) {
          // Fetch insights for each post
          let insights: Record<string, number> = { views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0, shares: 0 };
          try {
            const insightsUrl = new URL(`https://graph.threads.net/v1.0/${post.id}/insights`);
            insightsUrl.searchParams.set("metric", "views,likes,replies,reposts,quotes,shares");
            insightsUrl.searchParams.set("access_token", accessToken);
            const insightsRes = await fetch(insightsUrl.toString());
            if (insightsRes.ok) {
              const insightsJson = await insightsRes.json();
              for (const entry of insightsJson.data || []) {
                insights[entry.name] = entry.values?.[0]?.value ?? 0;
              }
            }
          } catch (e) {
            console.error(`Insights failed for post ${post.id}:`, e);
          }

          const enriched = enrichPost(post, insights);
          allEnrichedPosts.push({
            ...enriched,
            user_id: userId,
            source: "competitor",
            source_username: trimmed,
          });

          await sleep(500);
        }
      } catch (e) {
        console.error(`Error processing @${trimmed}:`, e);
      }

      await sleep(500);
    }

    // Upsert into posts_analyzed
    if (allEnrichedPosts.length > 0) {
      for (let i = 0; i < allEnrichedPosts.length; i += 50) {
        const batch = allEnrichedPosts.slice(i, i + 50);
        const { error: upsertError } = await adminClient
          .from("posts_analyzed")
          .upsert(batch, { onConflict: "threads_media_id" });
        if (upsertError) {
          console.error("Upsert error:", upsertError);
        }
      }
    }

    // Compute summary insights from enriched posts
    const topPosts = [...allEnrichedPosts]
      .sort((a, b) => b.engagement_rate - a.engagement_rate)
      .slice(0, 10);

    const avgWordCount = allEnrichedPosts.length > 0
      ? Math.round(allEnrichedPosts.reduce((s, p) => s + p.word_count, 0) / allEnrichedPosts.length)
      : 0;

    // Best posting days/hours
    const dayViews: Record<string, { total: number; count: number }> = {};
    const hourViews: Record<number, { total: number; count: number }> = {};
    for (const p of allEnrichedPosts) {
      if (!dayViews[p.day_of_week]) dayViews[p.day_of_week] = { total: 0, count: 0 };
      dayViews[p.day_of_week].total += p.views;
      dayViews[p.day_of_week].count++;

      if (!hourViews[p.hour_posted]) hourViews[p.hour_posted] = { total: 0, count: 0 };
      hourViews[p.hour_posted].total += p.views;
      hourViews[p.hour_posted].count++;
    }

    const bestDay = Object.entries(dayViews).sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))[0]?.[0] || "N/A";
    const bestHour = Object.entries(hourViews).sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))[0]?.[0] || "N/A";

    // Common openers (first 5 words)
    const openers: Record<string, number> = {};
    for (const p of topPosts) {
      const opener = (p.text_content as string).split(/\s+/).slice(0, 5).join(" ");
      if (opener) openers[opener] = (openers[opener] || 0) + 1;
    }

    // Content patterns
    const withCredibility = allEnrichedPosts.filter((p) => p.has_credibility_marker);
    const withQuestions = allEnrichedPosts.filter((p) => p.has_question);

    const patterns = [];
    if (withCredibility.length > 0) {
      const avgEngCredibility = withCredibility.reduce((s, p) => s + p.engagement_rate, 0) / withCredibility.length;
      patterns.push(`Posts with credibility markers avg ${avgEngCredibility.toFixed(1)}% engagement`);
    }
    if (withQuestions.length > 0) {
      const avgEngQuestions = withQuestions.reduce((s, p) => s + p.engagement_rate, 0) / withQuestions.length;
      patterns.push(`Posts with questions avg ${avgEngQuestions.toFixed(1)}% engagement`);
    }

    return new Response(
      JSON.stringify({
        total_posts: allEnrichedPosts.length,
        avg_word_count: avgWordCount,
        best_day: bestDay,
        best_hour: bestHour,
        patterns,
        top_openers: Object.entries(openers).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([o]) => o),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
