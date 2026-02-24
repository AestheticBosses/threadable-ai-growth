import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch profile for niche context alongside posts and samples
    const [{ data: profile }, { data: posts }, { data: samples }] = await Promise.all([
      adminClient
        .from("profiles")
        .select("niche, dream_client, end_goal")
        .eq("id", userId)
        .single(),
      adminClient
        .from("posts_analyzed")
        .select("text_content")
        .eq("user_id", userId)
        .order("engagement_rate", { ascending: false })
        .limit(20),
      adminClient
        .from("voice_samples")
        .select("sample_text")
        .eq("user_id", userId),
    ]);

    const allSamples: string[] = [];
    for (const p of posts || []) {
      if (p.text_content) allSamples.push(p.text_content);
    }
    for (const s of samples || []) {
      if (s.sample_text) allSamples.push(s.sample_text);
    }

    if (allSamples.length < 3) {
      return new Response(
        JSON.stringify({ error: "Need at least 3 writing samples to analyze voice" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const samplesText = allSamples.map((s, i) => `--- Sample ${i + 1} ---\n${s}`).join("\n\n");

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 4096,
        system: `You are an expert writing style analyst. Analyze the writing samples provided and extract a detailed voice profile.${profile?.niche ? `\n\nCREATOR CONTEXT:\n- Niche: ${profile.niche}\n- Dream Client: ${profile.dream_client || "Not specified"}\n- End Goal: ${profile.end_goal || "Not specified"}\n\nUse this context to identify niche-specific language patterns, industry terminology, and how the creator's voice is tailored to resonate with their target audience.` : ""}`,
        messages: [
          {
            role: "user",
            content: `Analyze the writing style of these ${allSamples.length} samples:\n\n${samplesText}`,
          },
        ],
        tools: [
          {
            name: "output_voice_profile",
            description: "Output the analyzed voice profile",
            input_schema: {
              type: "object",
              properties: {
                tone: { type: "array", items: { type: "string" }, description: "3-5 tone descriptors" },
                sentence_style: { type: "string", description: "Typical sentence length and structure" },
                vocabulary_level: { type: "string", enum: ["casual", "moderate", "advanced"] },
                common_phrases: { type: "array", items: { type: "string" }, description: "Phrases used repeatedly" },
                emoji_usage: { type: "string", enum: ["none", "minimal", "moderate", "heavy"] },
                formatting_patterns: { type: "string", description: "How they use line breaks, caps, etc." },
                opening_style: { type: "string", description: "How they typically start posts" },
                closing_style: { type: "string", description: "How they typically end posts" },
                unique_quirks: { type: "array", items: { type: "string" }, description: "Distinctive writing habits" },
                overall_summary: { type: "string", description: "2-3 sentence description of writing voice" },
              },
              required: ["tone", "sentence_style", "vocabulary_level", "common_phrases", "emoji_usage", "formatting_patterns", "opening_style", "closing_style", "unique_quirks", "overall_summary"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "output_voice_profile" },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("Anthropic API error:", status, await aiResponse.text());
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let voiceProfile: any;

    const toolUse = aiData.content?.find((block: any) => block.type === "tool_use");
    if (toolUse?.input) {
      voiceProfile = toolUse.input;
    } else {
      const textBlock = aiData.content?.find((block: any) => block.type === "text");
      const content = textBlock?.text || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        voiceProfile = JSON.parse(jsonMatch[0]);
      } else {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    voiceProfile.include_credibility_markers = true;

    const { error: updateErr } = await adminClient
      .from("profiles")
      .update({ voice_profile: voiceProfile })
      .eq("id", userId);

    if (updateErr) {
      console.error("Failed to save voice profile:", updateErr);
    }

    // Upsert voice summary to user_writing_style so getUserContext includes it
    if (voiceProfile.overall_summary) {
      const { error: styleErr } = await adminClient
        .from("user_writing_style")
        .upsert(
          { user_id: userId, custom_style_description: voiceProfile.overall_summary },
          { onConflict: "user_id" }
        );
      if (styleErr) console.error("Failed to upsert user_writing_style:", styleErr);
      else console.log("user_writing_style upserted for user:", userId);
    }

    return new Response(JSON.stringify(voiceProfile), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
