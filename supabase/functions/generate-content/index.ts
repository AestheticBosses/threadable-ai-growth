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

    if (rescoreText) {
      const result = await callScorePost(rescoreText, authHeader, SUPABASE_URL);
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profile + strategy + top posts + playbook + vault data
    const [profileRes, strategyRes, postsRes, playbookRes, vaultRes] = await Promise.all([
      adminClient.from("profiles").select("niche, dream_client, end_goal, voice_profile, funnel_goal, funnel_tof_pct, funnel_mof_pct, funnel_bof_pct").eq("id", userId).single(),
      adminClient.from("content_strategies").select("id, strategy_json, regression_insights").eq("user_id", userId).eq("strategy_type", "weekly").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      adminClient.from("posts_analyzed").select("text_content, engagement_rate, views").eq("user_id", userId).order("engagement_rate", { ascending: false }).limit(5),
      adminClient.from("content_strategies").select("strategy_data").eq("user_id", userId).eq("strategy_type", "playbook").limit(1).maybeSingle(),
      adminClient.from("user_story_vault").select("section, data").eq("user_id", userId),
    ]);

    const profile = profileRes.data as any;
    const strategy = strategyRes.data;
    const topPosts = postsRes.data || [];
    const playbookData = (playbookRes.data?.strategy_data as any) || null;

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse vault data
    const vaultSections: Record<string, any> = {};
    (vaultRes.data || []).forEach((row: any) => {
      vaultSections[row.section] = row.data;
    });

    const numbers = vaultSections.numbers || [];
    const stories = vaultSections.stories || [];
    const offers = vaultSections.offers || [];
    const audience = vaultSections.audience || null;

    // Build vault context
    let vaultContext = "";
    if (numbers.length > 0) {
      const numbersText = numbers.map((n: any) => `- ${n.label}: ${n.value} (${n.context})`).join("\n");
      vaultContext += `\nTHEIR REAL NUMBERS (use ONLY these facts, never make up numbers):\n${numbersText}\n`;
    }
    if (stories.length > 0) {
      const storiesText = stories.map((s: any) => `- "${s.title}": ${s.story}\n  Lesson: ${s.lesson}\n  Tags: ${(s.tags || []).join(", ")}`).join("\n");
      vaultContext += `\nTHEIR REAL STORIES (reference these, don't invent stories):\n${storiesText}\n`;
    }
    if (offers.length > 0) {
      const offersText = offers.map((o: any) => `- ${o.offer_name} (${o.price}): ${o.description}\n  Target: ${o.target_audience}\n  CTA: "${o.cta_phrase}" | Link: ${o.link}`).join("\n");
      vaultContext += `\nTHEIR OFFERS (for BOF posts):\n${offersText}\n`;
    }
    if (audience) {
      vaultContext += `\nTHEIR TARGET AUDIENCE:\nDescription: ${audience.description || "N/A"}\nPain points: ${(audience.pain_points || []).join(", ") || "N/A"}\nDesires: ${(audience.desires || []).join(", ") || "N/A"}\nLanguage they use: ${(audience.language_they_use || []).join(", ") || "N/A"}\n`;
    }

    // Funnel mix
    const tofPct = profile.funnel_tof_pct ?? 70;
    const mofPct = profile.funnel_mof_pct ?? 20;
    const bofPct = profile.funnel_bof_pct ?? 10;
    const tofCount = Math.round((tofPct / 100) * postsCount);
    const bofCount = Math.round((bofPct / 100) * postsCount);
    const mofCount = postsCount - tofCount - bofCount;

    const ctaPhrases = offers.map((o: any) => o.cta_phrase).filter(Boolean).join(" or ");

    const funnelContext = `
FUNNEL MIX for this batch:
- TOF posts (reach/viral): ${tofCount} posts — NO CTA, maximize shareability, universal truths, hot takes
- MOF posts (trust/authority): ${mofCount} posts — soft CTA ("DM me", "check my bio"), show expertise + proof
- BOF posts (convert/sell): ${bofCount} posts — direct CTA${ctaPhrases ? ` (use: "${ctaPhrases}")` : ""}, reference specific offer, client results

RULES FOR FUNNEL STAGES:
1. NEVER make up numbers, revenue, client counts, or stories. Only use data from the vault above.
2. TOF posts should be universally relatable. MOF posts should showcase expertise. BOF posts should drive action.
3. For BOF posts, always include a specific CTA from the offers.
4. Each post MUST include a funnel_stage field: "TOF", "MOF", or "BOF".`;

    const strategyId = strategy?.id || null;
    const voiceProfile = profile.voice_profile as any;
    const insights = strategy?.regression_insights as any;
    const strategyJson = strategy?.strategy_json as any;

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

    let playbookContext = "";
    let checklistContext = "";
    if (playbookData) {
      const scheduleText = (playbookData.weekly_schedule || [])
        .map((s: any) => `${s.day}: ${s.archetype} (${s.notes})`)
        .join("\n");
      const templateText = (playbookData.templates || [])
        .map((t: any) => `${t.archetype}: ${t.template}`)
        .join("\n\n");
      const rulesText = (playbookData.rules || [])
        .map((r: any, i: number) => `${i + 1}. ${r.rule}`)
        .join("\n");
      const guidelines = playbookData.generation_guidelines || {};

      playbookContext = `
PLAYBOOK WEEKLY SCHEDULE:
${scheduleText}

PLAYBOOK TEMPLATES:
${templateText}

PLAYBOOK RULES:
${rulesText}

GENERATION GUIDELINES:
- Tone: ${guidelines.tone || "N/A"}
- Avg length: ${guidelines.avg_length || "N/A"}
- Key vocabulary: ${(guidelines.vocabulary || []).join(", ") || "N/A"}
- Avoid: ${(guidelines.avoid || []).join(", ") || "N/A"}`;

      if (playbookData.checklist && playbookData.checklist.length > 0) {
        const checklistItems = playbookData.checklist
          .map((c: any, i: number) => `${i + 1}. ${c.question} (+${c.points}pt) — Evidence: ${c.data_backing}`)
          .join("\n");
        const maxPoints = playbookData.checklist.reduce((s: number, c: any) => s + Math.max(0, c.points), 0);
        checklistContext = `

QUALITY CHECKLIST (self-score each post before returning):
${checklistItems}

Max possible: ${maxPoints} points (normalized to 6-point scale, threshold = 4/6).
Before returning each post, mentally score it against this checklist.
Only include posts that would score 4+ out of 6. If a post scores below 4, rewrite it until it scores 4+.`;
      }
    }

    const actualCount = regeneratePostId ? 1 : postsCount;
    const categoryHint = regenerateCategory ? `\nContent category MUST be: ${regenerateCategory}` : "";

    const systemPrompt = `You are a Threads ghostwriter. You write in the user's EXACT voice — matching their tone, sentence structure, vocabulary, and quirks perfectly.

VOICE PROFILE:
${voiceText}

NICHE: ${profile.niche || "Not specified"}
DREAM CLIENT: ${profile.dream_client || "Not specified"}
END GOAL: ${profile.end_goal || "Not specified"}
${vaultContext}
WHAT PERFORMS BEST (from data analysis):
${insightsBullets || "No data available yet"}

CONTENT STRATEGY:
${strategyJson ? JSON.stringify(strategyJson, null, 2) : "No weekly strategy available."}
${playbookContext}
${funnelContext}

STYLE REFERENCE (their actual top posts):
${topPostsRef || "No posts available"}

RULES:
1. Match this person's EXACT voice. Read the style reference carefully.
2. Each post MUST be under 500 characters.
3. Include credibility markers naturally when relevant.
4. Front-load the hook. First line must stop the scroll.
5. Use line breaks for readability.
6. Maximum 1 hashtag per post.
7. Vary content types — mix archetypes across posts.
8. NEVER make up numbers, revenue, client counts, or stories. Only use data from the vault.
9. EVERY post must be unique — different hooks, different angles, different stories.
10. Vary post length: some one-liners, some 3-line, some multi-paragraph.
11. Follow the playbook weekly schedule if available — match archetype to day.
12. Use the playbook templates as structural guides.
13. Each post MUST have a funnel_stage: TOF, MOF, or BOF.${categoryHint}
${checklistContext}`;

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
            { role: "user", content: `Generate exactly ${count} posts. Return as a JSON array of objects with: text, content_category, funnel_stage (TOF/MOF/BOF), suggested_day, suggested_time (HH:MM format).` },
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
                        funnel_stage: { type: "string", enum: ["TOF", "MOF", "BOF"] },
                        suggested_day: { type: "string" },
                        suggested_time: { type: "string" },
                      },
                      required: ["text", "content_category", "funnel_stage", "suggested_day", "suggested_time"],
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

    let generatedPosts = await generatePosts(actualCount);

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
              post.funnel_stage = retryPosts[0].funnel_stage || post.funnel_stage;
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
        funnel_stage: post.funnel_stage || "TOF",
        scheduled_for: dayDate.toISOString(),
        status: "draft",
        ai_generated: true,
        pre_post_score: bestResult.score,
        score_breakdown: bestResult.breakdown,
        strategy_id: strategyId,
      };

      if (regeneratePostId) {
        const { data: updated, error: updateErr } = await adminClient
          .from("scheduled_posts")
          .update({
            text_content: bestText,
            pre_post_score: bestResult.score,
            score_breakdown: bestResult.breakdown,
            funnel_stage: post.funnel_stage || "TOF",
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
