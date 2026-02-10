import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Scoring Engine ──
function scorePost(
  text: string,
  insights: any
): { score: number; breakdown: Record<string, boolean> } {
  const breakdown: Record<string, boolean> = {};

  // 1. Under 500 chars
  breakdown.under_500_chars = text.length <= 500;

  // 2. Strong hook (first line under 60 chars and attention-grabbing)
  const firstLine = text.split("\n")[0]?.trim() || "";
  breakdown.strong_hook = firstLine.length > 0 && firstLine.length <= 80;

  // 3. Has line breaks for readability
  breakdown.has_formatting = text.includes("\n") && text.split("\n").length >= 3;

  // 4. Contains credibility marker (if data says it helps)
  const credKeywords = ["$", "k/mo", "revenue", "clients", "generated", "scaled", "million", "figure", "sold", "built", "grew", "growth"];
  const lower = text.toLowerCase();
  const hasCred = credKeywords.some((kw) => lower.includes(kw));
  const credLift = insights?.credibility_marker_lift ?? 0;
  breakdown.credibility_marker = credLift > 0 ? hasCred : true; // pass if data says it doesn't matter

  // 5. Word count in optimal range
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const optRange = insights?.optimal_word_count_range;
  if (optRange?.min && optRange?.max) {
    breakdown.optimal_length = wordCount >= optRange.min * 0.7 && wordCount <= optRange.max * 1.3;
  } else {
    breakdown.optimal_length = wordCount >= 15 && wordCount <= 120;
  }

  // 6. No generic filler
  const genericPhrases = ["in today's world", "let me tell you", "here's the thing", "at the end of the day", "it is what it is"];
  breakdown.no_generic_filler = !genericPhrases.some((p) => lower.includes(p));

  const score = Object.values(breakdown).filter(Boolean).length;
  return { score, breakdown };
}

function getNextDayDate(dayName: string, baseDate: Date): Date {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const targetIdx = days.indexOf(dayName.toLowerCase());
  if (targetIdx === -1) return baseDate;
  const currentIdx = baseDate.getDay();
  let diff = targetIdx - currentIdx;
  if (diff <= 0) diff += 7;
  const result = new Date(baseDate);
  result.setDate(result.getDate() + diff);
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const postsCount = body.posts_count || 21;
    // Optional: regenerate a single post
    const regeneratePostId = body.regenerate_post_id;
    const regenerateCategory = body.regenerate_category;
    const rescoreText = body.rescore_text;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // If just re-scoring edited text
    if (rescoreText) {
      const { data: latestStrategy } = await adminClient
        .from("content_strategies")
        .select("regression_insights")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      const scoreResult = scorePost(rescoreText, latestStrategy?.regression_insights);
      return new Response(JSON.stringify(scoreResult), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profile + strategy + top posts
    const [profileRes, strategyRes, postsRes] = await Promise.all([
      adminClient.from("profiles").select("niche, dream_client, end_goal, voice_profile").eq("id", userId).single(),
      adminClient.from("content_strategies").select("id, strategy_json, regression_insights").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).single(),
      adminClient.from("posts_analyzed").select("text_content, engagement_rate, views").eq("user_id", userId).eq("source", "own").order("engagement_rate", { ascending: false }).limit(5),
    ]);

    const profile = profileRes.data;
    const strategy = strategyRes.data;
    const topPosts = postsRes.data || [];

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!strategy?.strategy_json) {
      return new Response(JSON.stringify({ error: "No strategy found. Generate a strategy first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const voiceProfile = profile.voice_profile as any;
    const insights = strategy.regression_insights as any;
    const strategyJson = strategy.strategy_json as any;

    const insightsBullets = (insights?.human_readable_insights || []).map((i: string) => `• ${i}`).join("\n");

    const topPostsRef = topPosts.map((p: any, i: number) =>
      `${i + 1}. "${(p.text_content || "").slice(0, 300)}"`
    ).join("\n");

    const voiceText = voiceProfile
      ? `Tone: ${(voiceProfile.tone || []).join(", ")}
Sentence style: ${voiceProfile.sentence_style || "N/A"}
Vocabulary: ${voiceProfile.vocabulary_level || "N/A"}
Emoji usage: ${voiceProfile.emoji_usage || "N/A"}
Formatting: ${voiceProfile.formatting_patterns || "N/A"}
Opening style: ${voiceProfile.opening_style || "N/A"}
Closing style: ${voiceProfile.closing_style || "N/A"}
Quirks: ${(voiceProfile.unique_quirks || []).join(", ")}
Summary: ${voiceProfile.overall_summary || "N/A"}`
      : "No voice profile available — write in a natural, conversational tone.";

    const actualCount = regeneratePostId ? 1 : postsCount;
    const categoryHint = regenerateCategory ? `\nContent category MUST be: ${regenerateCategory}` : "";

    const systemPrompt = `You are a Threads ghostwriter. You write in the user's EXACT voice — matching their tone, sentence structure, vocabulary, and quirks perfectly.

VOICE PROFILE:
${voiceText}

NICHE: ${profile.niche || "Not specified"}
DREAM CLIENT: ${profile.dream_client || "Not specified"}
END GOAL: ${profile.end_goal || "Not specified"}

WHAT PERFORMS BEST (from data analysis):
${insightsBullets || "No data available yet"}

CONTENT STRATEGY FOR THIS WEEK:
${JSON.stringify(strategyJson, null, 2)}

STYLE REFERENCE (their actual top posts):
${topPostsRef || "No posts available"}

RULES:
1. Match this person's EXACT voice. Read the style reference carefully.
2. Each post MUST be under 500 characters.
3. Include credibility markers naturally when relevant.
4. Front-load the hook. First line must stop the scroll.
5. Use line breaks for readability.
6. Maximum 1 hashtag per post.
7. Vary content types — mix authority, storytelling, engagement, and CTAs.
8. Every 5th post should have a soft CTA.
9. No generic motivational crap. Be specific and real.
10. Write like a real person, not a brand.${categoryHint}`;

    const userPrompt = `Generate exactly ${actualCount} posts. Return as a JSON array of objects with: text, content_category, suggested_day, suggested_time (HH:MM format).`;

    // Call AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "output_posts",
            description: "Output the generated posts",
            parameters: {
              type: "object",
              properties: {
                posts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      content_category: { type: "string" },
                      suggested_day: { type: "string" },
                      suggested_time: { type: "string" },
                    },
                    required: ["text", "content_category", "suggested_day", "suggested_time"],
                  },
                },
              },
              required: ["posts"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "output_posts" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", status, await aiResponse.text());
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let generatedPosts: any[];

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      generatedPosts = parsed.posts || parsed;
    } else {
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        generatedPosts = JSON.parse(jsonMatch[0]);
      } else {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Score and save posts
    const now = new Date();
    const savedPosts: any[] = [];

    for (const post of generatedPosts) {
      const { score, breakdown } = scorePost(post.text, insights);

      // Calculate scheduled_for date
      const dayDate = getNextDayDate(post.suggested_day, now);
      const [hours, minutes] = (post.suggested_time || "09:00").split(":").map(Number);
      dayDate.setHours(hours || 9, minutes || 0, 0, 0);

      const postRow: any = {
        user_id: userId,
        text_content: post.text,
        content_category: post.content_category,
        scheduled_for: dayDate.toISOString(),
        status: "draft",
        ai_generated: true,
        pre_post_score: score,
        score_breakdown: breakdown,
        strategy_id: strategy.id,
      };

      // If regenerating a specific post, update it
      if (regeneratePostId) {
        const { data: updated, error: updateErr } = await adminClient
          .from("scheduled_posts")
          .update({
            text_content: post.text,
            pre_post_score: score,
            score_breakdown: breakdown,
            user_edited: false,
          })
          .eq("id", regeneratePostId)
          .eq("user_id", userId)
          .select()
          .single();
        if (!updateErr && updated) savedPosts.push(updated);
      } else {
        const { data: inserted, error: insertErr } = await adminClient
          .from("scheduled_posts")
          .insert(postRow)
          .select()
          .single();
        if (!insertErr && inserted) savedPosts.push(inserted);
      }
    }

    return new Response(JSON.stringify({ posts: savedPosts, total: savedPosts.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
