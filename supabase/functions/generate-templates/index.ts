import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CONTENT_GENERATION_RULES } from "../_shared/contentRules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch archetypes
    const { data: strategyRow } = await adminClient
      .from("content_strategies")
      .select("strategy_data")
      .eq("user_id", user.id)
      .eq("strategy_type", "archetype_discovery")
      .single();

    const archetypes = (strategyRow?.strategy_data as any)?.archetypes;
    if (!archetypes || !Array.isArray(archetypes) || archetypes.length === 0) {
      return new Response(JSON.stringify({ error: "No archetypes found. Run archetype discovery first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user profile for niche context
    const { data: profile } = await adminClient
      .from("profiles")
      .select("niche, end_goal, dream_client, voice_profile")
      .eq("id", user.id)
      .single();

    // Fetch identity for voice context
    const { data: identity } = await adminClient
      .from("user_identity")
      .select("about_you")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fetch stories and personal info so templates reference real experiences
    const [{ data: storyVault }, { data: personalInfo }] = await Promise.all([
      adminClient
        .from("user_story_vault")
        .select("data")
        .eq("user_id", user.id)
        .eq("section", "stories")
        .maybeSingle(),
      adminClient
        .from("user_personal_info")
        .select("content")
        .eq("user_id", user.id),
    ]);

    // Build the archetype descriptions for the prompt
    const archetypeDescriptions = archetypes
      .map((a: any, i: number) => `${i + 1}. ${a.emoji} ${a.name}
   - Description: ${a.description}
   - Drives: ${a.drives}
   - Key ingredients: ${a.key_ingredients?.join(", ") || "N/A"}
   - Existing template: ${a.template || "N/A"}`)
      .join("\n\n");

    const profileContext = profile
      ? `Niche: ${profile.niche || "general"}\nGoal: ${profile.end_goal || "grow audience"}\nDream client: ${profile.dream_client || "not specified"}`
      : "";

    const identityContext = identity?.about_you
      ? `About the creator: ${identity.about_you}`
      : "";

    // Build voice context from profile
    const voiceContext = profile?.voice_profile
      ? `\nVOICE PROFILE:\n- Tone: ${(profile.voice_profile as any).tone?.join(", ") || "N/A"}\n- Sentence style: ${(profile.voice_profile as any).sentence_style || "N/A"}\n- Vocabulary: ${(profile.voice_profile as any).vocabulary_level || "N/A"}\n- Common phrases: ${(profile.voice_profile as any).common_phrases?.join(", ") || "N/A"}\n- Opening style: ${(profile.voice_profile as any).opening_style || "N/A"}\n- Unique quirks: ${(profile.voice_profile as any).unique_quirks?.join(", ") || "N/A"}\n`
      : "";

    // Build stories context
    const stories = (storyVault?.data as any[]) || [];
    const storiesContext = stories.length > 0
      ? `\nSTORIES & EXPERIENCES (use these in example fills):\n${stories.slice(0, 5).map((s: any) => `- ${s.title}: ${s.story?.slice(0, 150) || ""}${s.lesson ? ` (Lesson: ${s.lesson})` : ""}`).join("\n")}\n`
      : "";

    // Build personal info context
    const personalFacts = (personalInfo || []).map((p: any) => p.content).filter(Boolean);
    const personalContext = personalFacts.length > 0
      ? `\nPERSONAL FACTS (reference in examples):\n${personalFacts.slice(0, 10).map((f: string) => `- ${f}`).join("\n")}\n`
      : "";

    const systemPrompt = `${CONTENT_GENERATION_RULES}

EXCEPTION FOR THIS TASK: Brackets ARE allowed in template_text fields since these are fill-in-the-blank templates. But example_text fields must have NO brackets — fill everything in with real data.

You are a content strategist creating fill-in-the-blank post templates for a Threads creator.

${profileContext}
${identityContext}
${voiceContext}${storiesContext}${personalContext}
Here are their discovered content archetypes:

${archetypeDescriptions}

For EACH archetype above, generate exactly 5 unique fill-in-the-blank templates. Each template should:
1. Follow the archetype's pattern and key ingredients
2. Use [brackets] for parts the creator fills in with their own data
3. Be structurally different from the other templates for the same archetype (different hooks, structures, angles)
4. Be formatted for Threads (short paragraphs, mobile-friendly)
5. Include an example of what the template looks like when filled in

Respond in this exact JSON format with no other text:
{
  "templates": [
    {
      "archetype": "Exact Archetype Name",
      "template_text": "The fill-in-the-blank template with [bracketed placeholders]",
      "example_text": "The same template but filled in with realistic example content"
    }
  ]
}

Rules:
- Generate exactly 5 templates per archetype (${archetypes.length} archetypes = ${archetypes.length * 5} total templates)
- Each template should use a different hook style (question, bold claim, story opener, number lead, confession, contrarian take)
- Templates should vary in structure (hook→story→lesson, hook→list→CTA, hook→proof→insight, etc.)
- Keep templates under 500 characters
- Make examples specific and compelling — use the creator's real stories, personal facts, and numbers where possible
- Match the creator's voice profile: their tone, vocabulary, sentence style, and quirks
- Respond with ONLY the JSON, no markdown fences`;

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [{ role: "user", content: systemPrompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", claudeResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI template generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeResponse.json();
    const rawText = claudeData.content?.[0]?.text || "";

    let parsed;
    try {
      const cleanJson = rawText.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      console.error("JSON parse failed, raw:", rawText);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const templates = parsed.templates;
    if (!Array.isArray(templates) || templates.length === 0) {
      return new Response(JSON.stringify({ error: "No templates in AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete existing default templates to avoid duplicates on re-runs
    await adminClient
      .from("content_templates")
      .delete()
      .eq("user_id", user.id)
      .eq("is_default", true);

    // Insert all templates
    const inserts = templates.map((t: any, i: number) => ({
      user_id: user.id,
      archetype: t.archetype,
      template_text: t.template_text,
      example_text: t.example_text || null,
      is_default: true,
      sort_order: i,
    }));

    const { error: insertError } = await adminClient
      .from("content_templates")
      .insert(inserts);

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save templates" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generated ${templates.length} templates for ${archetypes.length} archetypes`);

    return new Response(JSON.stringify({ success: true, count: templates.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-templates error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
