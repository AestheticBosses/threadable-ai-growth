import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserContext } from "../_shared/getUserContext.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;
    console.log("[generate-content-buckets] Auth OK, userId:", userId);

    // Get full user context
    const userContext = await getUserContext(adminClient, userId);

    // Fetch goal_type for directive injection
    const { data: profile } = await adminClient
      .from("profiles")
      .select("goal_type, dm_keyword, dm_offer")
      .eq("id", userId)
      .single();

    const goalType = profile?.goal_type || "grow_audience";
    const dmKeyword = profile?.dm_keyword || "";
    const dmOffer = profile?.dm_offer || "";

    const goalDirective = `
=== GOAL OPTIMIZATION DIRECTIVE ===
The user's primary goal is: ${goalType}
${dmKeyword ? `DM Keyword: ${dmKeyword}` : ""}
${dmOffer ? `DM Offer: ${dmOffer}` : ""}

Apply this goal to every audience segment you generate:

${goalType === "get_comments" ? `- Audience segments should be defined by who is most likely to ENGAGE and COMMENT, not just consume.
- Every segment should have "drives replies/comments" as a primary success metric.
- Prioritize audiences who feel compelled to share opinions, ask questions, or respond to vulnerable stories.` : ""}
${goalType === "drive_traffic" ? `- Audience segments should be defined by who has the highest intent to click through to an offer.
- Every segment should connect to a natural CTA pathway to the traffic URL.
- Prioritize audiences actively seeking solutions the creator offers.` : ""}
${goalType === "grow_audience" ? `- Audience segments should focus on who is most likely to follow and bring others.
- Prioritize audiences who share content and attract similar followers.` : ""}

Read goal_type, dm_keyword, and dm_offer from the CREATOR PROFILE section above and apply this directive to every segment you generate.
=== END GOAL DIRECTIVE ===`;

    const systemPrompt = `You are a content strategist who identifies audience segments for social media creators. You analyze a creator's niche, goals, identity, and top-performing content to determine the 2-3 distinct audience segments they should create content for.

Each audience segment (called a "content bucket") represents a WHO — a specific group of people the creator is talking to. Good buckets are:
- Distinct from each other (not overlapping)
- Tied to the creator's business goal
- Large enough to generate consistent content
- Specific enough that the creator can speak directly to their pain points

Examples of good bucket structures:
- A fitness coach might have: "Busy professionals wanting to get fit", "New moms rebuilding strength", "Athletes optimizing performance"
- A SaaS marketer might have: "Startup founders doing their own marketing", "Marketing managers at mid-size companies", "Agency owners scaling client work"
- A career coach might have: "Mid-career professionals feeling stuck", "New graduates entering the workforce", "Executives transitioning industries"`;

    const userMessage = `Here is everything you know about this creator:

${userContext}

${goalDirective}

Based on this creator's niche, goals, identity, and content performance, generate 2-3 content buckets (audience segments).

Respond in this exact JSON format with no other text:
[
  {
    "name": "Short bucket name (2-5 words)",
    "description": "One sentence describing this audience segment",
    "audience_persona": "Detailed persona: who they are, what stage they're at, what they struggle with, what they want, what keeps them up at night",
    "business_connection": "How serving this audience directly drives the creator's business goal and end goal",
    "priority": 1
  }
]

Rules:
- Generate exactly 2-3 buckets
- Priority 1 = most important audience, 2 = second, 3 = third
- Each bucket must be distinct — no overlapping audiences
- audience_persona should be 2-3 sentences, specific and vivid
- business_connection should explain the revenue/growth path from this audience
- Respond with ONLY the JSON array, no markdown fences or extra text`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Anthropic API error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: `AI generation failed (${aiResponse.status}): ${errText.slice(0, 300)}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.content?.[0]?.text || "";

    let buckets;
    try {
      const cleanJson = rawText.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
      buckets = JSON.parse(cleanJson);
    } catch {
      console.error("JSON parse failed, raw:", rawText);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(buckets) || buckets.length === 0) {
      return new Response(JSON.stringify({ error: "AI returned invalid bucket data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clear existing buckets and insert new ones
    await adminClient.from("content_buckets").delete().eq("user_id", userId);

    const { error: insertError } = await adminClient.from("content_buckets").insert(
      buckets.map((b: any) => ({
        user_id: userId,
        name: b.name,
        description: b.description || null,
        audience_persona: b.audience_persona || null,
        business_connection: b.business_connection || null,
        priority: b.priority || null,
        is_active: true,
      }))
    );

    if (insertError) {
      console.error("Insert content_buckets failed:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save buckets" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generated ${buckets.length} content buckets for user: ${userId}`);

    return new Response(JSON.stringify({ data: buckets, count: buckets.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-content-buckets error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
