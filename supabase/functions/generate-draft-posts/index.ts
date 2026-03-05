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

    // Extract vault story titles from context for cross-call story assignment
    const vaultTitleMatches = userContext.match(/^- ([^\n]+)\n  /gm) || [];
    const vaultTitles = vaultTitleMatches
      .map((m: string) => m.replace(/^- /, "").split("\n")[0].trim())
      .filter((t: string) => t.length > 2 && t.length < 120 && !t.startsWith("Number:"));
    // Shuffle for variety, then assign round-robin
    const shuffledVaultTitles = [...vaultTitles].sort(() => Math.random() - 0.5);

    // Generate posts with concurrency limit of 3
    const results: any[] = [];
    const chunks: any[][] = [];
    for (let i = 0; i < posts.length; i += 3) {
      chunks.push(posts.slice(i, i + 3));
    }

    // Signal-based length targets: MICRO / SHORT / STANDARD
    const signalTargets: Record<string, { label: string; charMax: number; instruction: string }> = {
      MICRO: {
        label: "MICRO",
        charMax: 100,
        instruction: "This is a MICRO post. Write ONE punchy line under 100 characters. No explanation, no paragraph, no expansion. The hook IS the entire post.",
      },
      SHORT: {
        label: "SHORT",
        charMax: 250,
        instruction: "This is a SHORT post. Keep it to 2-4 lines, under 250 characters. One observation + one supporting beat, then stop.",
      },
      STANDARD: {
        label: "STANDARD",
        charMax: 450,
        instruction: "This is a STANDARD post. Write 250-450 characters. Full thought with hook, body, and close. Still concise — no essays.",
      },
    };

    // Build user message with story constraint for cross-call dedup
    function buildUserMessage(
      post: any,
      target: { label: string; charMax: number },
      postIndex: number,
      titles: string[],
    ): string {
      let msg = `Write a ${post.funnel_stage || "TOF"} ${post.archetype || ""} post about: ${post.topic || "content relevant to my brand"}. Hook idea: ${post.hook_idea || "use a strong opening"}. [LENGTH SIGNAL: ${target.label} — max ${target.charMax} chars]`;

      if (titles.length > 0) {
        // Round-robin assign one story; exclude others used in this batch
        const assigned = titles[postIndex % titles.length];
        const excluded = titles
          .filter((_, i) => i !== postIndex % titles.length)
          .slice(0, 5) // Cap exclusion list to keep prompt concise
          .join(", ");
        msg += `\n[STORY CONSTRAINT: If this post needs a vault story, draw from "${assigned}". Do NOT use these stories: ${excluded}]`;
      }
      return msg;
    }

    let globalPostIndex = 0;
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (post: any, chunkIdx: number) => {
          const postIndex = globalPostIndex + chunkIdx;
          const archetype = post.archetype || "General";

          // Resolve length signal: explicit signal > hook word count fallback
          let resolvedSignal = "STANDARD";
          if (post.draft_length_signal && signalTargets[post.draft_length_signal]) {
            resolvedSignal = post.draft_length_signal;
          } else {
            // Fallback: infer from hook_idea word count
            const hookWords = (post.hook_idea || "").trim().split(/\s+/).filter(Boolean).length;
            if (hookWords > 0 && hookWords < 10) resolvedSignal = "MICRO";
            else if (hookWords >= 10 && hookWords < 20) resolvedSignal = "SHORT";
            else resolvedSignal = "STANDARD";
          }
          const target = signalTargets[resolvedSignal];
          const lengthInstruction = target.instruction;

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

=== CRITICAL LENGTH RULE ===
${lengthInstruction}
Hard character limit for this post: ${target.charMax} characters. Count every character including spaces and line breaks. Do NOT exceed this limit.

=== FLEXIBILITY ===
Write until the thought is complete and true — but respect the length signal above. A ${target.label} post that exceeds its limit is a failure. Trim ruthlessly.

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

=== POST LENGTH VARIETY IS CRITICAL ===
Not every post should be an essay. Follow these rules:
- If the hook_idea is under 15 words, the FULL POST should be just 1-3 lines. The hook IS the post. Do not expand it into paragraphs. Short and punchy wins.
- If the hook_idea is 15-30 words, the post should be 3-6 lines max. Add one supporting point, then stop.
- If the hook_idea is 30+ words or contains a story/narrative, the post can be longer (8-15 lines). But still keep paragraphs to 1-3 lines with line breaks between them.
- At least 30% of posts in any batch should be under 5 lines total.
- A 6-word post that stops the scroll is better than a 150-word post that gets skipped.
The creator's voice data and content preferences already specify short paragraphs and line breaks. Follow those rules AND vary the total post length.

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
                  { role: "user", content: buildUserMessage(post, target, postIndex, shuffledVaultTitles) },
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
      globalPostIndex += chunk.length;
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
