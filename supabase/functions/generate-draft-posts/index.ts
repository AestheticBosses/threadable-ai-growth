import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserContext } from "../_shared/getUserContext.ts";
import { CONTENT_GENERATION_RULES } from "../_shared/contentRules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { posts, current_timestamp } = await req.json();
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return new Response(JSON.stringify({ error: "posts array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userContext = await getUserContext(admin, user.id);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate posts with concurrency limit of 3
    const results: any[] = [];
    const chunks: any[][] = [];
    for (let i = 0; i < posts.length; i += 3) {
      chunks.push(posts.slice(i, i + 3));
    }

    const lengthGuide: Record<string, string> = {
      "Brutal Truth": "Keep under 150 characters. One punchy observation. No explanation needed.",
      "Hot Take": "Keep under 200 characters. Bold claim, no softening.",
      "One-Liner Philosophy": "Keep under 100 characters. Single quotable sentence.",
      "Millennial Operator": "150-300 characters max. Relatable, punchy.",
      "Authority Flex": "200-400 characters. Lead with credential, end with insight.",
      "Data Drop": "200-400 characters. Stat first, implication second.",
      "Vulnerable Founder": "300-500 characters. Story arc: struggle → lesson.",
      "Builder Updates": "200-400 characters. Progress + what it means.",
    };

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (post: any) => {
          const archetype = post.archetype || "General";
          const archetypeLengthInstruction = lengthGuide[archetype] ||
            `Keep under 400 characters. Your regression data shows optimal post length is 3-91 words.`;

          const systemPrompt = `${CONTENT_GENERATION_RULES}

You are Threadable — a data-driven Threads content writer. You write posts that are backed by regression analysis of this user's actual performance data.

Here is everything you know about this user:

${userContext}

=== YOUR TASK ===
Write a single Threads post based on the invisible specifications below. These inputs shape WHAT you write — but they NEVER appear in the post text.

Invisible inputs (DO NOT include any of these as labels, headers, or structure in the post):
- Archetype: ${archetype}
- Funnel Stage: ${post.funnel_stage || "TOF"}
- Topic: ${post.topic || ""}
- Hook idea: ${post.hook_idea || ""}

=== VOICE FIRST ===
Study the user's top-performing posts in the context below. Understand their natural voice, tone, rhythm, and what resonates with their specific audience. Mirror THAT — not a generic "content creator" voice. The best post sounds like this specific user at their most honest. Polish kills authenticity. Strategy is the input, not the output.

The post should read like a raw thought, not a content plan item. No labels. No structure. No 📌 headers. Just the post.

=== FLEXIBILITY ===
If the most authentic version of this post is 50 characters, write 50 characters. If it needs 400, write 400. Don't pad to hit a length target. Don't cut to hit a limit. Write until it's done and true.

General guidance: ${archetypeLengthInstruction} Your regression data shows the optimal word count is 3-91 words. But authenticity beats length targets — if the truest version breaks the guide, write the truest version.

=== HOW YOU WRITE HIGH-PERFORMING POSTS ===

BEFORE writing, study the user's top-performing posts. Identify the emotional triggers, hook patterns, and structures that drove their highest engagement. Then replicate those patterns with fresh content from the user's vault.

For every post you write:
1. Pick one of the user's top-performing posts and use its emotional trigger + structure as a blueprint
2. Replace the content with a different story, number, or angle from the user's data
3. Keep the same emotional intensity — don't water it down
4. Make the hook just as scroll-stopping as the original

=== RULES ===
- NEVER use placeholder brackets. Use the user's real data from their Identity, Stories, and Numbers.
- Write as this person — their words, their rhythm, their personality. Not AI voice.
- Format for mobile: short paragraphs, line breaks between thoughts.
- Start with a hook that matches patterns from their top-performing posts.
- If the funnel stage is BOF, reference specific offers and CTAs from their sales funnel.
- Use regression insights to inform the structure and angle.
- NEVER include 📌, pillar names, archetype names, funnel stage labels, or any structured headers in the post text. Strategy is invisible.
- ABSOLUTE HARD LIMIT: 500 characters maximum. This is a Threads platform limit — posts over 500 characters will be rejected. Count every character including spaces and line breaks. If your draft is over 500 characters, cut it. The post in this response must be 500 characters or fewer, no exceptions.

Respond with ONLY the post text. No explanations, no labels, no quotes around it.`;

          try {
            const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-opus-4-6",
                max_tokens: 1000,
                system: systemPrompt,
                messages: [
                  { role: "user", content: `Write a ${post.funnel_stage || "TOF"} ${post.archetype || ""} post about: ${post.topic || "content relevant to my brand"}. Hook idea: ${post.hook_idea || "use a strong opening"}` },
                ],
              }),
            });

            if (!aiResp.ok) {
              console.error("Anthropic API error:", aiResp.status);
              return { error: "AI generation failed", post };
            }

            const aiData = await aiResp.json();
            let text = (aiData.content?.[0]?.text || "").trim();

            if (!text) return { error: "Empty response", post };

            // Hard enforce 500 character limit
            if (text.length > 500) {
              const trimResp = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": ANTHROPIC_API_KEY,
                  "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                  model: "claude-opus-4-6",
                  max_tokens: 300,
                  system: "You are a Threads post editor. Trim the post to under 500 characters while preserving the hook, core message, and voice. Never cut mid-sentence. Return ONLY the trimmed post text.",
                  messages: [{ role: "user", content: `Trim this to under 500 characters:\n\n${text}` }],
                }),
              });
              if (trimResp.ok) {
                const trimData = await trimResp.json();
                text = (trimData.content?.[0]?.text || text).trim();
              }

              if (text.length > 500) {
                // Hard truncate as fallback — find last complete sentence under 500 chars
                let trimmed = text.slice(0, 500);
                const lastPeriod = trimmed.lastIndexOf('.');
                const lastNewline = trimmed.lastIndexOf('\n');
                const cutPoint = Math.max(lastPeriod, lastNewline);
                if (cutPoint > 300) {
                  text = trimmed.slice(0, cutPoint + 1).trim();
                } else {
                  text = trimmed.trim();
                }
              }
            }

            const insertData: Record<string, any> = {
              user_id: user.id,
              text_content: text,
              content_category: post.archetype || null,
              funnel_stage: post.funnel_stage || "TOF",
              status: "draft",
              ai_generated: true,
              source: "content_plan",
            };

            if (post.scheduled_time) {
              // Time-aware scheduling: skip slots that have already passed
              const scheduledDate = new Date(post.scheduled_time);
              const now = current_timestamp ? new Date(current_timestamp) : new Date();
              
              if (scheduledDate > now) {
                // Future slot — use as-is
                insertData.scheduled_for = post.scheduled_time;
              } else {
                // Slot has passed — push to the same time next week
                scheduledDate.setDate(scheduledDate.getDate() + 7);
                insertData.scheduled_for = scheduledDate.toISOString();
              }
            }

            const { data: inserted, error: insertErr } = await admin
              .from("scheduled_posts")
              .insert(insertData)
              .select("id")
              .single();

            if (insertErr) {
              console.error("Insert error:", insertErr);
              return { error: "Failed to save post", post };
            }

            return { success: true, id: inserted.id, text };
          } catch (e) {
            console.error("Generation error:", e);
            return { error: e instanceof Error ? e.message : "Unknown error", post };
          }
        })
      );
      results.push(...chunkResults);
    }

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => r.error);

    return new Response(
      JSON.stringify({
        total: successful.length,
        failed: failed.length,
        posts: successful,
        errors: failed.map((f) => f.error),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-draft-posts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
