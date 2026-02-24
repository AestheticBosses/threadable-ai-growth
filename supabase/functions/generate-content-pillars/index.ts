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
    console.log("[generate-content-pillars] Auth OK, userId:", userId);

    // Get full user context + buckets (buckets needed as structured data for ID mapping after generation)
    const [userContext, { data: buckets }] = await Promise.all([
      getUserContext(adminClient, userId),
      adminClient
        .from("content_buckets")
        .select("id, name, description, audience_persona, business_connection, priority")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("priority"),
    ]);

    if (!buckets || buckets.length === 0) {
      return new Response(JSON.stringify({ error: "No content buckets found. Generate buckets first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bucketsContext = buckets.map((b: any) =>
      `Bucket "${b.name}" (Priority ${b.priority}): ${b.description}\n  Persona: ${b.audience_persona}\n  Business Connection: ${b.business_connection}`
    ).join("\n\n");

    const bucketNames = buckets.map((b: any) => `"${b.name}"`).join(", ");

    const systemPrompt = `You are a content strategist who designs content pillar systems for social media creators. You analyze a creator's audience buckets, niche, archetypes, and existing content to create a comprehensive pillar structure with specific, actionable topic angles.

Content pillars are the WHAT — the repeatable topic themes a creator posts about. Each pillar:
- Serves at least one audience bucket (the WHO)
- Has a clear purpose (inspire, educate, motivate, or entertain)
- Contains 5-8 specific connected topics — angles specific enough to write a post about TODAY

Good pillars are:
- Broad enough to generate 50+ posts but narrow enough to be distinct
- Tied to the creator's expertise and lived experience
- Balanced across the content funnel (awareness → trust → conversion)

Good connected topics are:
- Specific enough to write a single post about ("The 5am myth in my industry" not "Morning routines")
- Include a hook angle that suggests how to open the post
- Varied in emotional register (some vulnerable, some authoritative, some contrarian)`;

    const userMessage = `Here is everything you know about this creator:

${userContext}

Content buckets (audience segments):
${bucketsContext}

Generate 3-5 content pillars with 5-8 connected topics each. Each pillar must map to at least one of these buckets: ${bucketNames}.

Respond in this exact JSON format with no other text:
{
  "pillars": [
    {
      "name": "Short pillar name (2-5 words)",
      "description": "What this pillar covers and why it matters for the creator's audience",
      "purpose": "inspire|educate|motivate|entertain",
      "percentage": 25,
      "bucket_name": "Exact name of the bucket this pillar serves",
      "topics": [
        {
          "name": "Specific topic angle (enough detail to write a post)",
          "hook_angle": "Suggested hook approach — how to open a post on this topic"
        }
      ]
    }
  ]
}

Rules:
- Generate 3-5 pillars
- Each pillar has 5-8 connected topics
- Percentages across ALL pillars must sum to exactly 100
- bucket_name must exactly match one of: ${bucketNames}
- purpose must be one of: inspire, educate, motivate, entertain
- Topics should be specific and actionable — not vague theme descriptions
- hook_angle should suggest a concrete opening line style (e.g., "Contrarian take: challenge the common belief that...", "Confession opener: admit a time when...")
- Draw from the creator's existing top posts to identify what resonates, but create NEW topic angles they haven't covered yet
- If competitor data exists, use it to identify topic gaps and opportunities
- Respond with ONLY the JSON, no markdown fences or extra text`;

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
        model: "claude-opus-4-5",
        max_tokens: 4000,
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

    let parsed;
    try {
      const cleanJson = rawText.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      console.error("JSON parse failed, raw:", rawText);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pillars = parsed.pillars || parsed;
    if (!Array.isArray(pillars) || pillars.length === 0) {
      return new Response(JSON.stringify({ error: "AI returned invalid pillar data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a name→id map for buckets
    const bucketMap: Record<string, string> = {};
    for (const b of buckets) {
      bucketMap[b.name] = b.id;
    }

    // Clear existing pillars and topics for this user
    await Promise.all([
      adminClient.from("connected_topics").delete().eq("user_id", userId),
      adminClient.from("content_pillars").delete().eq("user_id", userId),
    ]);

    // Insert pillars and collect their IDs for topic insertion
    const pillarInserts = pillars.map((p: any) => ({
      user_id: userId,
      bucket_id: bucketMap[p.bucket_name] || null,
      name: p.name,
      description: p.description || null,
      purpose: p.purpose || null,
      percentage: p.percentage || 0,
      is_active: true,
    }));

    const { data: insertedPillars, error: pillarError } = await adminClient
      .from("content_pillars")
      .insert(pillarInserts)
      .select("id, name");

    if (pillarError || !insertedPillars) {
      console.error("Insert content_pillars failed:", pillarError);
      return new Response(JSON.stringify({ error: "Failed to save pillars" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build pillar name→id map
    const pillarMap: Record<string, string> = {};
    for (const ip of insertedPillars) {
      pillarMap[ip.name] = ip.id;
    }

    // Insert all connected topics
    const topicInserts: any[] = [];
    for (const pillar of pillars) {
      const pillarId = pillarMap[pillar.name];
      if (!pillarId || !Array.isArray(pillar.topics)) continue;
      for (const topic of pillar.topics) {
        topicInserts.push({
          user_id: userId,
          pillar_id: pillarId,
          name: topic.name,
          hook_angle: topic.hook_angle || null,
          is_active: true,
        });
      }
    }

    if (topicInserts.length > 0) {
      const { error: topicError } = await adminClient
        .from("connected_topics")
        .insert(topicInserts);

      if (topicError) {
        console.error("Insert connected_topics failed:", topicError);
        // Non-fatal: pillars were saved, topics failed
      }
    }

    console.log(`Generated ${pillars.length} pillars with ${topicInserts.length} topics for user: ${userId}`);

    return new Response(JSON.stringify({
      data: pillars,
      pillar_count: pillars.length,
      topic_count: topicInserts.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-content-pillars error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
