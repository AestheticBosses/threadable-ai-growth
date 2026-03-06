import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserContext } from "../_shared/getUserContext.ts";
import { CONTENT_GENERATION_RULES } from "../_shared/contentRules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMOTIONAL_TRIGGER_MAP: Record<string, string> = {
  // TOF
  curiosity: "EMOTIONAL TARGET: Curiosity. The reader should finish this post thinking 'I never thought about it that way.' Open a question in line 1, deepen it through the middle, and close with an insight that partially resolves it — leaving them wanting to follow for more. DO NOT explain everything. Leave one thread deliberately unresolved.",
  identity: "EMOTIONAL TARGET: Identity. The reader should finish this post thinking 'This person gets me — or this person IS me.' Write TO a specific type of person, not about a topic. Use 'you' language or mirror their internal monologue. The close should make them feel seen, not taught.",
  contrarian_shock: "EMOTIONAL TARGET: Contrarian Shock. The reader should finish this post thinking 'Wait — is that actually true?' State the unpopular position in line 1 with full confidence. No hedging. The body is the case for why the mainstream view is wrong. The close is the reframe that makes them question everything they thought before.",
  tribal_belonging: "EMOTIONAL TARGET: Tribal Belonging. The reader should finish this post feeling like they found their people. Write about a shared experience that only THIS specific type of person would recognize. The close is a call-in, not a call-to-action — 'if you know, you know.'",
  pattern_interrupt: "EMOTIONAL TARGET: Pattern Interrupt. This post should feel completely different from the posts around it. Use an unexpected structure — a single short line, a question with no answer, or a statement that breaks format. The close should be abrupt and memorable. Prioritize surprise over information.",
  // MOF
  trust: "EMOTIONAL TARGET: Trust. The reader should finish this post thinking 'I believe this person.' Lead with a specific proof point — a real number, a named client result, or a mechanism you can name. The body deepens the proof. The close positions you as the person who knows this better than anyone.",
  fomo: "EMOTIONAL TARGET: FOMO. The reader should finish this post feeling like something is passing them by. Describe what's working for people who know this — without being explicit about what they're missing. Let the gap create urgency. Close with a soft invitation, not a hard sell.",
  proof_of_mechanism: "EMOTIONAL TARGET: Proof of Mechanism. The reader should finish this post understanding WHY something works, not just THAT it works. Name the mechanism explicitly. Explain the cause-effect chain. The close should make the mechanism feel accessible — 'this is how it works and you can use it.'",
  credibility: "EMOTIONAL TARGET: Credibility. The reader should finish this post upgrading their mental model of who you are. Stack two or three specific proof points — roles, results, decisions. Never brag. Let the facts do it. The close is quiet confidence.",
  relatability: "EMOTIONAL TARGET: Relatability. The reader should finish this post thinking 'same.' Write about a real, specific moment of struggle, confusion, or imposter syndrome that the reader has felt but probably hasn't said out loud. The close normalizes the experience.",
  // BOF
  urgency: "EMOTIONAL TARGET: Urgency. The reader should finish this post feeling like waiting has a cost. Name what they're losing by not acting — time, money, competitive advantage, or clarity. The close is a direct invitation to act NOW, not someday.",
  social_proof: "EMOTIONAL TARGET: Social Proof. The reader should finish this post thinking 'other people like me are already doing this.' Lead with a specific result someone got. Name the mechanism. Close with a low-friction next step that feels like joining something, not buying something.",
  result_first: "EMOTIONAL TARGET: Result First. Open with the end state — what life looks like after. Make it specific and desirable. Work backward to show how you got there. The close presents the offer as the shortcut to that specific result.",
  offer_clarity: "EMOTIONAL TARGET: Offer Clarity. The reader should finish this post with zero confusion about what you offer, who it's for, and what it costs. Name the offer explicitly. State the outcome in one sentence. Remove all vagueness. Close with one clear CTA.",
  fear_of_staying_stuck: "EMOTIONAL TARGET: Fear of Staying Stuck. The reader should finish this post feeling the cost of staying where they are. Describe their current situation accurately and painfully. The middle shows what's possible. The close makes the gap between now and possible feel urgent and solvable.",
};

const STRUCTURE_SKELETONS: Record<string, string> = {
  MICRO: "STRUCTURE: Hook only. 1-3 lines maximum. No explanation. No lesson. The hook IS the post. Make it so sharp it doesn't need more.",
  SHORT: "STRUCTURE: Hook → One Beat → Close.\nHook: the opening line (already provided).\nOne Beat: one specific detail, fact, or moment that proves or deepens the hook. 2-4 lines max.\nClose: one line that lands the emotional target. No CTA unless BOF.",
  STANDARD: "STRUCTURE: Hook → Tension → Proof → Insight → Close.\nHook: the opening line (already provided).\nTension: the problem, contradiction, or gap that makes the hook real.\nProof: one specific story beat, data point, or named moment.\nInsight: the one thing the reader should walk away knowing.\nClose: delivers the emotional target. For BOF: close with a direct CTA.",
};

async function scoreDraft(
  apiKey: string,
  text: string,
  emotionalTrigger: string,
  funnelStage: string,
): Promise<{ total: number; weakest_criterion: string; improvement_note: string } | null> {
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: `You are a content quality scorer. Score this Threads post on 5 criteria (0-2 each). Return ONLY valid JSON:
{
  "hook_strength": 0-2,
  "emotional_delivery": 0-2,
  "one_thing_rule": 0-2,
  "specificity": 0-2,
  "close_strength": 0-2,
  "total": 0-10,
  "weakest_criterion": "name of the lowest scoring criterion",
  "improvement_note": "one sentence on what to fix"
}`,
        messages: [{
          role: "user",
          content: `Emotional target for this post: ${emotionalTrigger}
Funnel stage: ${funnelStage}
Character count: ${text.length} of 500 max

Post to score:
${text}`,
        }],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const raw = (data.content?.[0]?.text || "").trim();
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

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

          // Emotional trigger instruction
          const emotionalTriggerBlock = EMOTIONAL_TRIGGER_MAP[post.emotional_trigger || ""]
            || "EMOTIONAL TARGET: Curiosity. Open a question, deepen it, close with a partial insight.";

          // Structure skeleton based on length signal
          const structureBlock = STRUCTURE_SKELETONS[resolvedSignal] || STRUCTURE_SKELETONS.STANDARD;

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

=== ${emotionalTriggerBlock} ===

=== ${structureBlock} ===

ONE THING RULE: This post makes exactly ONE point. Not two. Not a lesson with sub-lessons. One claim, proven one way, closed once. If you find yourself writing a second point, delete it.

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

CHARACTER RULE: 500 characters is the hard ceiling — never exceed it. But shorter is usually stronger. Your most viral posts were tweet-length. Write the minimum characters needed to land the emotional target. Never pad. If it's done in 80 characters, stop at 80.

=== POST LENGTH VARIETY IS CRITICAL ===
Not every post should be an essay. Follow these rules:
- If the hook_idea is under 15 words, the FULL POST should be just 1-3 lines. The hook IS the post. Do not expand it into paragraphs. Short and punchy wins.
- If the hook_idea is 15-30 words, the post should be 3-6 lines max. Add one supporting point, then stop.
- If the hook_idea is 30+ words or contains a story/narrative, the post can be longer (8-15 lines). But still keep paragraphs to 1-3 lines with line breaks between them.
- At least 30% of posts in any batch should be under 5 lines total.
- A 6-word post that stops the scroll is better than a 150-word post that gets skipped.
The creator's voice data and content preferences already specify short paragraphs and line breaks. Follow those rules AND vary the total post length.

Respond with ONLY the post text. No explanations, no labels, no quotes around it.`;

          const postKey = `${post.day || "?"}-${postIndex}`;
          try {
            // Generate first draft
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

            // === Quality Gate: Score + Retry ===
            try {
              let needsRetry = false;
              let retryInstruction = "";
              let firstScore: number | null = null;

              if (text.length > 500) {
                // Over character limit — force retry without scoring
                console.log(`[draft-score] post ${postKey}: ${text.length} chars — OVER LIMIT, forcing retry`);
                needsRetry = true;
                retryInstruction = `The previous draft was ${text.length} characters. 500 is the hard ceiling but shorter is stronger. Rewrite to under 500 characters — cut the middle first, never cut the hook or close.`;
              } else {
                // Score with haiku
                const scoreResult = await scoreDraft(
                  ANTHROPIC_API_KEY,
                  text,
                  post.emotional_trigger || "curiosity",
                  post.funnel_stage || "TOF",
                );
                if (scoreResult) {
                  firstScore = scoreResult.total;
                  console.log(`[draft-score] post ${postKey}: ${text.length} chars, score ${scoreResult.total}/10 (weakest: ${scoreResult.weakest_criterion})`);
                  if (scoreResult.total < 7) {
                    needsRetry = true;
                    retryInstruction = `RETRY ATTEMPT — The previous draft scored ${scoreResult.total}/10 and was ${text.length} characters.\nWeakest area: ${scoreResult.weakest_criterion}.\nSpecific feedback: ${scoreResult.improvement_note}\nRewrite the post to fix this specific weakness. Keep what worked.\nRemember: shorter is usually stronger — don't pad to fill space.\nDo not start with the same opening word as the previous draft.`;
                  }
                }
              }

              if (needsRetry) {
                const retryResp = await fetch("https://api.anthropic.com/v1/messages", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                  },
                  body: JSON.stringify({
                    model: "claude-opus-4-6",
                    max_tokens: 1000,
                    system: systemPrompt + "\n\n" + retryInstruction,
                    messages: [
                      { role: "user", content: buildUserMessage(post, target, postIndex, shuffledVaultTitles) },
                    ],
                  }),
                });

                if (retryResp.ok) {
                  const retryData = await retryResp.json();
                  const retryText = (retryData.content?.[0]?.text || "").trim();

                  if (retryText) {
                    const retryScoreResult = await scoreDraft(
                      ANTHROPIC_API_KEY,
                      retryText,
                      post.emotional_trigger || "curiosity",
                      post.funnel_stage || "TOF",
                    );
                    const retryScoreVal = retryScoreResult?.total ?? 0;
                    console.log(`[draft-score] retry: ${retryText.length} chars, score ${retryScoreVal}/10`);

                    // Return whichever scored higher; ties go to retry
                    if (retryScoreVal >= (firstScore ?? 0)) {
                      text = retryText;
                      console.log(`[draft-score] returning retry draft`);
                    } else {
                      console.log(`[draft-score] returning original draft`);
                    }
                  }
                }
              }
            } catch (scoreErr) {
              console.warn("[draft-score] Scoring/retry failed (non-fatal):", scoreErr);
            }

            // Hard enforce 500 character limit (final safety net)
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
                  system: "You are a Threads post editor. Trim the post to under 500 characters while preserving the hook, core message, and voice. Never cut mid-sentence. Return ONLY the trimmed post text.\n\nCHARACTER RULE: 500 characters is the hard ceiling — never exceed it. But shorter is usually stronger. Your most viral posts were tweet-length. Write the minimum characters needed to land the emotional target. Never pad. If it's done in 80 characters, stop at 80.",
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
