import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { message, message_history = [] } = await req.json();
    if (!message) throw new Error("No message provided");

    // Fetch all user context in parallel
    const [
      identityRes,
      storiesRes,
      offersRes,
      audiencesRes,
      personalInfoRes,
      writingStyleRes,
      contentPrefsRes,
      knowledgeRes,
      topPostsRes,
      plansRes,
      strategyRes,
    ] = await Promise.all([
      supabase.from("user_identity").select("about_you, desired_perception, main_goal").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_story_vault").select("section, data").eq("user_id", user.id),
      supabase.from("user_offers").select("name, description").eq("user_id", user.id),
      supabase.from("user_audiences").select("name").eq("user_id", user.id),
      supabase.from("user_personal_info").select("content").eq("user_id", user.id),
      supabase.from("user_writing_style").select("selected_style, custom_style_description").eq("user_id", user.id).maybeSingle(),
      supabase.from("content_preferences").select("content").eq("user_id", user.id).order("sort_order"),
      supabase.from("knowledge_base").select("title, type, content").eq("user_id", user.id),
      supabase.from("posts_analyzed").select("text_content, likes, views, replies, reposts, engagement_rate, archetype, posted_at").eq("user_id", user.id).eq("source", "own").order("engagement_rate", { ascending: false }).limit(10),
      supabase.from("user_plans").select("plan_type, plan_data").eq("user_id", user.id),
      supabase.from("content_strategies").select("strategy_json").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const identity = identityRes.data;
    const stories = storiesRes.data || [];
    const offers = offersRes.data || [];
    const audiences = audiencesRes.data || [];
    const personalInfo = personalInfoRes.data || [];
    const writingStyle = writingStyleRes.data;
    const contentPrefs = contentPrefsRes.data || [];
    const knowledge = knowledgeRes.data || [];
    const topPosts = topPostsRes.data || [];
    const plans = plansRes.data || [];
    const strategy = strategyRes.data;

    // Build context sections
    let identitySection = "No identity data provided yet.";
    if (identity?.about_you) {
      identitySection = `About: ${identity.about_you}\nDesired Perception: ${identity.desired_perception || "Not set"}\nMain Goal: ${identity.main_goal || "Not set"}`;
    }

    const storiesSection = stories.length > 0
      ? stories.map((s: any) => {
          const items = Array.isArray(s.data) ? s.data : (s.data?.items || []);
          return items.map((item: any) => `- ${item.title || item.name || ""}: ${item.body || item.description || JSON.stringify(item)}`).join("\n");
        }).join("\n")
      : "No stories added yet.";

    const offersSection = offers.length > 0
      ? offers.map((o: any) => `- ${o.name}: ${o.description || ""}`).join("\n")
      : "No offers added yet.";

    const audiencesSection = audiences.length > 0
      ? audiences.map((a: any) => `- ${a.name}`).join("\n")
      : "No target audiences defined.";

    const personalSection = personalInfo.length > 0
      ? personalInfo.map((p: any) => `- ${p.content}`).join("\n")
      : "No personal info added.";

    const styleSection = writingStyle
      ? `Selected Style: ${writingStyle.selected_style}${writingStyle.custom_style_description ? `\nCustom Description: ${writingStyle.custom_style_description}` : ""}`
      : "Default style";

    const prefsSection = contentPrefs.length > 0
      ? contentPrefs.map((p: any) => `- ${p.content}`).join("\n")
      : "No content preferences set.";

    // Extract archetypes from strategy
    let archetypesSection = "No archetypes data available.";
    if (strategy?.strategy_json) {
      const sj = strategy.strategy_json as any;
      const archetypes = sj.archetypes || sj.content_archetypes || [];
      if (Array.isArray(archetypes) && archetypes.length > 0) {
        archetypesSection = archetypes.map((a: any) =>
          `- ${a.name || a.archetype}: ${a.description || ""} (${a.percentage || ""}% of content, avg engagement: ${a.avg_engagement || a.avg_engagement_rate || "N/A"})`
        ).join("\n");
      }
    }

    const knowledgeSection = knowledge.length > 0
      ? knowledge.map((k: any) => {
          if (k.type === "text") return `- ${k.title}: ${(k.content || "").slice(0, 300)}`;
          if (k.type === "url" || k.type === "video") return `- ${k.title}: ${k.content || ""}`;
          return `- ${k.title} (${k.type})`;
        }).join("\n")
      : "No knowledge base items.";

    const postsSection = topPosts.length > 0
      ? topPosts.map((p: any, i: number) =>
          `${i + 1}. [${p.archetype || "unknown"}] ${(p.text_content || "").slice(0, 200)} | Views: ${p.views || 0}, Likes: ${p.likes || 0}, Replies: ${p.replies || 0}, ER: ${p.engagement_rate ? (p.engagement_rate * 100).toFixed(1) + "%" : "N/A"}`
        ).join("\n")
      : "No posts analyzed yet.";

    // Plans
    const contentPlan = plans.find((p: any) => p.plan_type === "content_plan");
    const brandingPlan = plans.find((p: any) => p.plan_type === "branding_plan");
    const funnelPlan = plans.find((p: any) => p.plan_type === "funnel_strategy");

    const plansSection = [
      contentPlan ? `Content Plan: ${JSON.stringify(contentPlan.plan_data).slice(0, 500)}` : "Content Plan: Not generated yet",
      brandingPlan ? `Branding Plan: Positioning: ${(brandingPlan.plan_data as any)?.positioning_statement || "N/A"}` : "Branding Plan: Not generated yet",
      funnelPlan ? `Funnel Strategy: ${JSON.stringify(funnelPlan.plan_data).slice(0, 500)}` : "Funnel Strategy: Not generated yet",
    ].join("\n");

    const systemPrompt = `You are Threadable AI — a Threads content strategist and writing assistant. You help creators write high-performing Threads posts, brainstorm ideas, and build their personal brand.

You have deep knowledge of this specific user. Here is everything you know about them:

=== IDENTITY ===
${identitySection}

Stories:
${storiesSection}

Offers:
${offersSection}

Target Audiences:
${audiencesSection}

Personal Information:
${personalSection}

=== VOICE & STYLE ===
${styleSection}
Content Preferences:
${prefsSection}

=== CONTENT ARCHETYPES ===
${archetypesSection}

=== KNOWLEDGE BASE ===
${knowledgeSection}

=== TOP PERFORMING POSTS ===
${postsSection}

=== PLANS ===
${plansSection}

=== RULES ===
- Always write in the user's voice based on their style preferences and top posts
- Never make up facts — only reference information from their Identity and Knowledge Base
- When generating post ideas, tag each with an archetype and funnel stage (TOF/MOF/BOF)
- When writing draft posts, follow their content preferences exactly
- Keep Threads posts under 500 characters unless the user asks for longer
- Format posts for mobile readability — short paragraphs, line breaks between thoughts
- If the user asks about something you don't have context for, ask them to add it to their Knowledge Base or Identity
- Be direct, strategic, and actionable — not generic or fluffy
- When suggesting hooks, use patterns from their top-performing posts`;

    // Build messages array (last 20 from history + new message)
    const trimmedHistory = message_history.slice(-20);
    const messages = [
      { role: "system", content: systemPrompt },
      ...trimmedHistory,
      { role: "user", content: message },
    ];

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 2000,
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI temporarily unavailable. Please try again.");
    }

    // Stream the response back
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("chat-with-threadable error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
