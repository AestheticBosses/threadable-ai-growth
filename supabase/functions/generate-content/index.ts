import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

async function callScorePost(
  text: string,
  authHeader: string,
  supabaseUrl: string
): Promise<{ score: number; breakdown: any }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/score-post`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.error("score-post error:", res.status);
    return { score: 0, breakdown: {} };
  }
  return await res.json();
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

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
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
    const regeneratePostId = body.regenerate_post_id;
    const regenerateCategory = body.regenerate_category;
    const rescoreText = body.rescore_text;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Re-score edited text via score-post
    if (rescoreText) {
      const result = await callScorePost(rescoreText, authHeader, SUPABASE_URL);
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profile + strategy + top posts
    const [profileRes, strategyRes, postsRes] = await Promise.all([
      adminClient.from("profiles").select("niche, dream_client, end_goal, voice_profile").eq("id", userId).single(),
      adminClient.from("content_strategies").select("id, strategy_json, regression_insights").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).single(),
      adminClient.from("posts_analyzed").select("text_content, engagement_rate, views").eq("user_id", userId).order("engagement_rate", { ascending: false }).limit(5),
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
    const topPostsRef = topPosts.map((p: any, i: number) => `${i + 1}. "${(p.text_content || "").slice(0, 300)}"`).join("\n");

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

    const generatePosts = async (count: number): Promise<any[]> => {
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
            { role: "user", content: `Generate exactly ${count} posts. Return as a JSON array of objects with: text, content_category, suggested_day, suggested_time (HH:MM format).` },
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
        if (status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
        if (status === 402) throw new Error("AI credits exhausted. Please add funds.");
        throw new Error("AI generation failed");
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
        return parsed.posts || parsed;
      }
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error("Failed to parse AI response");
    };

    const now = new Date();
    const savedPosts: any[] = [];

    // Generate posts
    let generatedPosts = await generatePosts(actualCount);

    // Score each post, retry low-scoring ones
    for (const post of generatedPosts) {
      let bestText = post.text;
      let bestResult = await callScorePost(bestText, authHeader, SUPABASE_URL);
      let retries = 0;

      while (bestResult.score < 4 && retries < 2) {
        retries++;
        try {
          const retryPosts = await generatePosts(1);
          if (retryPosts[0]) {
            const retryResult = await callScorePost(retryPosts[0].text, authHeader, SUPABASE_URL);
            if (retryResult.score > bestResult.score) {
              bestText = retryPosts[0].text;
              bestResult = retryResult;
            }
          }
        } catch {
          break;
        }
      }

      const dayDate = getNextDayDate(post.suggested_day, now);
      const [hours, minutes] = (post.suggested_time || "09:00").split(":").map(Number);
      dayDate.setHours(hours || 9, minutes || 0, 0, 0);

      const postRow: any = {
        user_id: userId,
        text_content: bestText,
        content_category: post.content_category,
        scheduled_for: dayDate.toISOString(),
        status: "draft",
        ai_generated: true,
        pre_post_score: bestResult.score,
        score_breakdown: bestResult.breakdown,
        strategy_id: strategy.id,
      };

      if (regeneratePostId) {
        const { data: updated, error: updateErr } = await adminClient
          .from("scheduled_posts")
          .update({
            text_content: bestText,
            pre_post_score: bestResult.score,
            score_breakdown: bestResult.breakdown,
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
  } catch (e: any) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
