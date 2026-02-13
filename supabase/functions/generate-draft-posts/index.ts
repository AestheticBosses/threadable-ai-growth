import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserContext } from "../_shared/getUserContext.ts";

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

    // Auth
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

    // Fetch full user context using shared utility
    const userContext = await getUserContext(admin, user.id);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
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
          const systemPrompt = `You are Threadable AI — a Threads content writer. Write a single Threads post based on the specifications below.

${userContext}

=== POST SPECIFICATIONS ===
Archetype: ${post.archetype || "General"}
Funnel Stage: ${post.funnel_stage || "TOF"}
Topic: ${post.topic || ""}
Hook Idea: ${post.hook_idea || ""}

=== RULES ===
- Write ONE complete Threads post ready to publish
- Stay under 500 characters unless the content requires more (max 2200)
- Follow all content preferences exactly
- Use the specified archetype's writing pattern
- Match the funnel stage intent (TOF = reach/awareness, MOF = trust/credibility, BOF = conversion/action)
- Use REAL facts, numbers, and stories from the user's Identity — never make anything up
- Start with a strong hook based on the hook idea provided
- Format for mobile readability — short paragraphs, line breaks between thoughts
- Do NOT include hashtags unless the user's content preferences say to
- Sound like the user, not like AI

Respond with ONLY the post text. No explanations, no labels, no quotes around it.`;

          try {
            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: `Write a ${post.funnel_stage || "TOF"} ${post.archetype || ""} post about: ${post.topic || "content relevant to my brand"}. Hook idea: ${post.hook_idea || "use a strong opening"}` },
                ],
                max_tokens: 1000,
              }),
            });

            if (!aiResp.ok) {
              console.error("AI error:", aiResp.status);
              return { error: "AI generation failed", post };
            }

            const aiData = await aiResp.json();
            const text = aiData.choices?.[0]?.message?.content?.trim() || "";

            if (!text) return { error: "Empty response", post };

            // Insert into scheduled_posts
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
