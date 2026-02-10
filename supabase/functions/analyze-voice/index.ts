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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
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

    // Fetch top 20 posts
    const { data: posts } = await adminClient
      .from("posts_analyzed")
      .select("text_content")
      .eq("user_id", userId)
      .eq("source", "own")
      .order("engagement_rate", { ascending: false })
      .limit(20);

    // Fetch manual voice samples
    const { data: samples } = await adminClient
      .from("voice_samples")
      .select("sample_text")
      .eq("user_id", userId);

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

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert writing style analyst. Analyze the writing samples provided and extract a detailed voice profile.",
          },
          {
            role: "user",
            content: `Analyze the writing style of these ${allSamples.length} samples:\n\n${samplesText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "output_voice_profile",
              description: "Output the analyzed voice profile",
              parameters: {
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
          },
        ],
        tool_choice: { type: "function", function: { name: "output_voice_profile" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", status, await aiResponse.text());
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let voiceProfile: any;

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      voiceProfile = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        voiceProfile = JSON.parse(jsonMatch[0]);
      } else {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Add default credibility toggle
    voiceProfile.include_credibility_markers = true;

    // Save to profiles
    const { error: updateErr } = await adminClient
      .from("profiles")
      .update({ voice_profile: voiceProfile })
      .eq("id", userId);

    if (updateErr) {
      console.error("Failed to save voice profile:", updateErr);
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
