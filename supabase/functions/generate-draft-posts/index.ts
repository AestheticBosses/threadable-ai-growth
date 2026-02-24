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
    const { posts } = await req.json();
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

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (post: any) => {
          const systemPrompt = `${CONTENT_GENERATION_RULES}

You are Threadable — a data-driven Threads content writer. You write posts that are backed by regression analysis of this user's actual performance data.

Here is everything you know about this user:

${userContext}

=== YOUR TASK ===
Write a single Threads post based on the specifications below.

This is not generic content. This post is built from:
- A proven ARCHETYPE (a content pattern discovered from analyzing this user's top-performing posts)
- A specific FUNNEL STAGE (the business purpose this post serves)
- The user's REAL stories, numbers, and experiences
- The user's AUTHENTIC voice

POST SPECIFICATIONS:
- Archetype: ${post.archetype || "General"}
- Funnel Stage: ${post.funnel_stage || "TOF"}
- Topic: ${post.topic || ""}
- Hook idea: ${post.hook_idea || ""}

=== HOW YOU WRITE HIGH-PERFORMING POSTS ===

BEFORE writing, study the user's top-performing posts in the context below. Identify the emotional triggers, hook patterns, and structures that drove their highest engagement. Then replicate those patterns with fresh content from the user's vault.

The goal: this post should feel as emotionally compelling as their best-performing posts, but with completely new content.

For every post you write:
1. Pick one of the user's top-performing posts and use its emotional trigger + structure as a blueprint
2. Replace the content with a different story, number, or angle from the user's data
3. Keep the same emotional intensity — don't water it down
4. Make the hook just as scroll-stopping as the original

=== RULES ===
- NEVER use placeholder brackets. Use the user's real data from their Identity, Stories, and Numbers.
- Write as this person — their words, their rhythm, their personality. Not AI voice.
- Keep under 500 characters unless specified otherwise.
- Format for mobile: short paragraphs, line breaks between thoughts.
- Start with a hook that matches patterns from their top-performing posts.
- If the funnel stage is BOF, reference specific offers and CTAs from their sales funnel.
- Use regression insights to inform the structure and angle.

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
                model: "claude-opus-4-5",
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
            const text = (aiData.content?.[0]?.text || "").trim();

            if (!text) return { error: "Empty response", post };

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
              insertData.scheduled_for = post.scheduled_time;
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
