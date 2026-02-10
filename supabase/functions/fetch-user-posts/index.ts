import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_POSTS = 200;
const API_DELAY_MS = 500;

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
    source: "own",
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

async function fetchInsights(mediaId: string, accessToken: string): Promise<Record<string, number>> {
  const url = new URL(`https://graph.threads.net/v1.0/${mediaId}/insights`);
  url.searchParams.set("metric", "views,likes,replies,reposts,quotes,shares");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const result: Record<string, number> = { views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0, shares: 0 };

  if (!res.ok) {
    console.error(`Insights fetch failed for ${mediaId}:`, await res.text());
    return result;
  }

  const json = await res.json();
  for (const entry of json.data || []) {
    result[entry.name] = entry.values?.[0]?.value ?? 0;
  }
  return result;
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

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Get user's Threads credentials using service role
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("threads_access_token, threads_user_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.threads_access_token || !profile?.threads_user_id) {
      return new Response(
        JSON.stringify({ error: "Threads account not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = profile.threads_access_token;
    const threadsUserId = profile.threads_user_id;

    // Fetch posts with pagination
    const allPosts: any[] = [];
    let nextUrl: string | null = (() => {
      const u = new URL(`https://graph.threads.net/v1.0/${threadsUserId}/threads`);
      u.searchParams.set("fields", "id,text,timestamp,media_type,permalink,is_quote_post");
      u.searchParams.set("limit", "25");
      u.searchParams.set("access_token", accessToken);
      return u.toString();
    })();

    while (nextUrl && allPosts.length < MAX_POSTS) {
      const res = await fetch(nextUrl);
      if (!res.ok) {
        console.error("Posts fetch failed:", await res.text());
        break;
      }
      const json = await res.json();
      const posts = json.data || [];
      allPosts.push(...posts);
      nextUrl = json.paging?.cursors?.after
        ? (() => {
            const u = new URL(`https://graph.threads.net/v1.0/${threadsUserId}/threads`);
            u.searchParams.set("fields", "id,text,timestamp,media_type,permalink,is_quote_post");
            u.searchParams.set("limit", "25");
            u.searchParams.set("access_token", accessToken);
            u.searchParams.set("after", json.paging.cursors.after);
            return u.toString();
          })()
        : null;
      await sleep(API_DELAY_MS);
    }

    // Trim to MAX_POSTS
    const postsToProcess = allPosts.slice(0, MAX_POSTS);

    // Fetch insights and enrich each post
    const enrichedPosts = [];
    for (const post of postsToProcess) {
      const insights = await fetchInsights(post.id, accessToken);
      const enriched = enrichPost(post, insights);
      enrichedPosts.push({ ...enriched, user_id: userId });
      await sleep(API_DELAY_MS);
    }

    // Upsert into posts_analyzed
    if (enrichedPosts.length > 0) {
      // Upsert in batches of 50
      for (let i = 0; i < enrichedPosts.length; i += 50) {
        const batch = enrichedPosts.slice(i, i + 50);
        const { error: upsertError } = await adminClient
          .from("posts_analyzed")
          .upsert(batch, { onConflict: "threads_media_id" });
        if (upsertError) {
          console.error("Upsert error:", upsertError);
        }
      }
    }

    // Check follower count and update is_established
    let isEstablished = false;
    try {
      const profileUrl = new URL(`https://graph.threads.net/v1.0/${threadsUserId}`);
      profileUrl.searchParams.set("fields", "follower_count");
      profileUrl.searchParams.set("access_token", accessToken);
      const profileRes = await fetch(profileUrl.toString());
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.follower_count >= 500) {
          isEstablished = true;
          await adminClient
            .from("profiles")
            .update({ is_established: true })
            .eq("id", userId);
        }
      }
    } catch (e) {
      console.error("Follower count check failed:", e);
    }

    return new Response(
      JSON.stringify({ total_posts: enrichedPosts.length, is_established: isEstablished }),
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
