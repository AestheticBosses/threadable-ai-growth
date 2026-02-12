import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseAnon.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch user context
    const [identityRes, storiesRes, offersRes, audiencesRes, personalRes, styleRes, prefsRes, postsRes, kbRes] = await Promise.all([
      admin.from("user_identity").select("about_you, desired_perception, main_goal").eq("user_id", userId).maybeSingle(),
      admin.from("user_story_vault").select("data").eq("user_id", userId),
      admin.from("user_offers").select("name, description").eq("user_id", userId),
      admin.from("user_audiences").select("name").eq("user_id", userId),
      admin.from("user_personal_info").select("content").eq("user_id", userId),
      admin.from("user_writing_style").select("selected_style, custom_style_description").eq("user_id", userId).maybeSingle(),
      admin.from("content_preferences").select("content").eq("user_id", userId).order("sort_order"),
      admin.from("posts_analyzed").select("text_content, engagement_rate, likes, views").eq("user_id", userId).eq("source", "own").order("engagement_rate", { ascending: false }).limit(5),
      admin.from("knowledge_base").select("title, content, summary, type").eq("user_id", userId).eq("processed", true).limit(20),
    ]);

    const identity = identityRes.data;
    const stories = (storiesRes.data || []).flatMap((s: any) => {
      const d = s.data;
      if (Array.isArray(d)) return d;
      if (d && typeof d === "object") return Object.values(d).flat();
      return [];
    });
    const offers = offersRes.data || [];
    const audiences = audiencesRes.data || [];
    const personal = personalRes.data || [];
    const style = styleRes.data;
    const prefs = prefsRes.data || [];
    const topPosts = postsRes.data || [];
    const kb = kbRes.data || [];

    // Build identity context
    const identitySection = identity
      ? `About: ${identity.about_you || "Not set"}\nDesired Perception: ${identity.desired_perception || "Not set"}\nMain Goal: ${identity.main_goal || "Not set"}`
      : "No identity data available.";

    const storiesSection = stories.length > 0
      ? stories.map((s: any) => `- ${s.title || ""}: ${s.body || s.description || ""}`).join("\n")
      : "No stories yet.";

    const offersSection = offers.length > 0
      ? offers.map((o: any) => `- ${o.name}: ${o.description || ""}`).join("\n")
      : "No offers yet.";

    const audiencesSection = audiences.map((a: any) => `- ${a.name}`).join("\n") || "Not defined.";
    const personalSection = personal.map((p: any) => `- ${p.content}`).join("\n") || "Not set.";

    const styleSection = style ? `Selected style: ${style.selected_style}${style.custom_style_description ? `\nCustom: ${style.custom_style_description}` : ""}` : "Default style.";
    const prefsSection = prefs.map((p: any) => `- ${p.content}`).join("\n") || "No specific preferences.";

    const topPostsSection = topPosts.map((p: any) =>
      `"${(p.text_content || "").slice(0, 300)}" (${p.likes || 0} likes, ${p.views || 0} views)`
    ).join("\n\n") || "No posts yet.";

    const kbSection = kb.map((k: any) => {
      const content = k.summary || k.content || "";
      return `- [${k.type}] ${k.title}: ${content.slice(0, 200)}`;
    }).join("\n") || "Empty.";

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

=== USER IDENTITY ===
${identitySection}

Stories:
${storiesSection}

Offers:
${offersSection}

Target Audiences:
${audiencesSection}

Personal Information:
${personalSection}

=== WRITING STYLE ===
${styleSection}

Content Preferences:
${prefsSection}

=== TOP PERFORMING POST EXAMPLES ===
${topPostsSection}

=== KNOWLEDGE BASE ===
${kbSection}

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
              user_id: userId,
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
