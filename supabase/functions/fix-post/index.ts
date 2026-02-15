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

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
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

    const { post_id, feedback } = await req.json();
    if (!post_id || !feedback) {
      return new Response(JSON.stringify({ error: "post_id and feedback are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: post, error: postError } = await adminClient
      .from("scheduled_posts")
      .select("text_content, content_category, funnel_stage")
      .eq("id", post_id)
      .eq("user_id", userId)
      .single();

    if (postError || !post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("voice_profile")
      .eq("id", userId)
      .single();

    const voiceProfile = profile?.voice_profile as any;
    const voiceText = voiceProfile
      ? `Voice: Tone: ${(voiceProfile.tone || []).join(", ")}. Style: ${voiceProfile.sentence_style || "natural"}. Quirks: ${(voiceProfile.unique_quirks || []).join(", ")}.`
      : "Write in a natural, conversational tone.";

    const { data: vaultRows } = await adminClient
      .from("user_story_vault")
      .select("section, data")
      .eq("user_id", userId);

    const vault: Record<string, any> = {};
    (vaultRows || []).forEach((r: any) => { vault[r.section] = r.data; });

    let vaultContext = "";
    if (vault.numbers?.length) {
      vaultContext += `Real numbers: ${vault.numbers.map((n: any) => `${n.label}: ${n.value} (${n.context})`).join("; ")}\n`;
    }
    if (vault.stories?.length) {
      vaultContext += `Real stories: ${vault.stories.map((s: any) => `"${s.title}": ${s.story.slice(0, 200)}`).join("; ")}\n`;
    }

    const systemPrompt = `CRITICAL RULES — FOLLOW THESE ABSOLUTELY:
1. NEVER use placeholder brackets like [Name], [Number], [Topic], [Year], [Strategy], etc. ALWAYS fill in with the user's REAL data from the context below.
2. NEVER return fill-in-the-blank templates. Every post must be complete and ready to publish.
3. Write as if you ARE this person — use their specific stories, dollar amounts, client names, and experiences.
4. If you don't have specific data for something, make a reasonable inference from what you know. Never leave blanks.

You are a content editor. Rewrite the post incorporating the user's feedback while keeping the same archetype, funnel stage (${post.funnel_stage}), and emotional tone. Stay under 500 characters. Match the user's voice: ${voiceText}

${vaultContext ? `Context from their vault:\n${vaultContext}` : ""}

Return ONLY the corrected post text, nothing else. No quotes, no explanation.`;

    const userPrompt = `Original post: "${post.text_content}"

User feedback: "${feedback}"

Character limit: 500. Return ONLY the rewritten post.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Anthropic API error:", aiResponse.status, errText);
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    let fixedText = (aiData.content?.[0]?.text || "").trim();
    
    if ((fixedText.startsWith('"') && fixedText.endsWith('"')) || (fixedText.startsWith("'") && fixedText.endsWith("'"))) {
      fixedText = fixedText.slice(1, -1);
    }

    if (!fixedText) {
      throw new Error("Empty response from AI");
    }

    const scoreRes = await fetch(`${SUPABASE_URL}/functions/v1/score-post`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: fixedText }),
    });

    let newScore: number | null = null;
    let newBreakdown: any = null;
    if (scoreRes.ok) {
      const scoreData = await scoreRes.json();
      newScore = scoreData.score;
      newBreakdown = scoreData.breakdown;
    }

    const { data: updated, error: updateError } = await adminClient
      .from("scheduled_posts")
      .update({
        text_content: fixedText,
        user_edited: true,
        pre_post_score: newScore,
        score_breakdown: newBreakdown,
      })
      .eq("id", post_id)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      throw new Error("Failed to update post");
    }

    return new Response(JSON.stringify({ post: updated }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("fix-post error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
