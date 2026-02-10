import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── PART 1: Rule-Based Scoring (3 points max) ──

function scoreHookStrength(text: string): { score: number; reason: string } {
  const firstLine = text.split("\n")[0]?.trim() || "";
  const words = firstLine.split(/\s+/).filter(Boolean);
  if (words.length > 15) {
    return { score: 0, reason: `First line is ${words.length} words (over 15)` };
  }
  const fillerOpeners = [
    "i think", "so", "just", "hey guys", "in today's", "let me", "i want to",
  ];
  const lowerFirst = firstLine.toLowerCase();
  for (const filler of fillerOpeners) {
    if (lowerFirst.startsWith(filler)) {
      return { score: 0, reason: `First line starts with filler opener "${filler}"` };
    }
  }
  // Check for bold statement, number, question, or pattern interrupt
  const hasNumber = /\d/.test(firstLine);
  const hasQuestion = firstLine.includes("?");
  const isBold = firstLine.length > 5 && !lowerFirst.startsWith("i ") && !lowerFirst.startsWith("my ");
  if (hasNumber || hasQuestion || isBold) {
    return { score: 1, reason: `First line is ${words.length} words, ${hasQuestion ? "question" : hasNumber ? "contains number" : "bold statement"}` };
  }
  return { score: 1, reason: `First line is ${words.length} words, concise hook` };
}

function scoreEmotionalTriggers(text: string): { score: number; emotions_found: string[]; reason: string } {
  const lower = text.toLowerCase();
  const emotions: string[] = [];

  // FOMO
  const fomoWords = ["most people", "nobody tells you", "secret", "don't miss", "before it's"];
  if (fomoWords.some(w => lower.includes(w))) emotions.push("FOMO");

  // Recognition
  const recogWords = ["you're not", "you know that feeling", "we've all", "ever notice"];
  if (recogWords.some(w => lower.includes(w))) emotions.push("Recognition");

  // Aspiration
  const aspirWords = ["went from", "imagine", "$", "k/mo", "revenue", "growth"];
  if (aspirWords.some(w => lower.includes(w))) emotions.push("Aspiration");

  // Curiosity
  const curiosWords = ["here's what happened", "the truth is", "turns out", "but here's the thing"];
  if (curiosWords.some(w => lower.includes(w))) emotions.push("Curiosity");

  // Defiance
  const defianceWords = ["stop doing", "is not a strategy", "is dead", "unpopular opinion"];
  if (defianceWords.some(w => lower.includes(w))) emotions.push("Defiance");

  // Humor
  const humorWords = ["cry for help", "fire emoji", "lol", "ngl", "😂", "💀"];
  if (humorWords.some(w => lower.includes(w))) emotions.push("Humor");

  // Belonging
  const belongWords = ["every creator", "we all", "if you've ever"];
  if (belongWords.some(w => lower.includes(w))) emotions.push("Belonging");

  const hit = emotions.length >= 2;
  return {
    score: hit ? 1 : 0,
    emotions_found: emotions,
    reason: emotions.length === 0
      ? "No emotional triggers detected"
      : `Hit ${emotions.length} emotion${emotions.length > 1 ? "s" : ""}: ${emotions.join(", ")}${hit ? "" : " (need 2+)"}`,
  };
}

function scoreVividScene(text: string): { score: number; elements_found: string[]; reason: string } {
  const lower = text.toLowerCase();
  const elements: string[] = [];

  // Specific numbers
  if (/\d{2,}/.test(text) || /\$\d/.test(text)) elements.push("specific number");

  // Named tools/platforms
  const platforms = ["twitter", "threads", "instagram", "linkedin", "notion", "figma", "slack", "stripe", "shopify", "canva", "chatgpt", "google"];
  if (platforms.some(p => lower.includes(p))) elements.push("named platform");

  // Physical actions
  const actions = ["scrolling", "refreshing", "deleting", "typing", "staring", "clicking", "sitting", "waking up"];
  if (actions.some(a => lower.includes(a))) elements.push("physical action");

  // Dialogue in quotes
  if (/"[^"]{3,}"/.test(text) || /"[^"]{3,}"/.test(text)) elements.push("dialogue");

  // Specific time references
  if (/\d+\s*(minutes?|hours?|days?|weeks?|months?|am|pm)\b/i.test(text) || /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(text)) {
    elements.push("time reference");
  }

  const hit = elements.length >= 2;
  return {
    score: hit ? 1 : 0,
    elements_found: elements,
    reason: elements.length === 0
      ? "No concrete/visual elements found"
      : `Found ${elements.length} element${elements.length > 1 ? "s" : ""}: ${elements.join(", ")}${hit ? "" : " (need 2+)"}`,
  };
}

// ── PART 2: AI-Powered Scoring (3 points max) ──

async function scoreWithAI(
  text: string,
  voiceProfile: any,
  regressionInsights: any,
  dreamClient: string,
  apiKey: string
): Promise<{
  niche_specificity: { score: number; reason: string };
  voice_match: { score: number; reason: string };
  data_aligned: { score: number; reason: string };
}> {
  const insightsBullets = (regressionInsights?.human_readable_insights || [])
    .map((i: string) => `• ${i}`)
    .join("\n");

  const voiceText = voiceProfile
    ? `Tone: ${(voiceProfile.tone || []).join(", ")}
Sentence style: ${voiceProfile.sentence_style || "N/A"}
Vocabulary: ${voiceProfile.vocabulary_level || "N/A"}
Emoji usage: ${voiceProfile.emoji_usage || "N/A"}
Formatting: ${voiceProfile.formatting_patterns || "N/A"}
Opening style: ${voiceProfile.opening_style || "N/A"}
Closing style: ${voiceProfile.closing_style || "N/A"}
Quirks: ${(voiceProfile.unique_quirks || []).join(", ")}
Summary: ${voiceProfile.overall_summary || "N/A"}`
    : "No voice profile available";

  const prompt = `You are a Threads content scoring engine. Score this post on 3 criteria, 1 point each.

USER'S TOP PERFORMING POST PATTERNS (from their data):
${insightsBullets || "No data available yet"}

USER'S VOICE PROFILE:
${voiceText}

POST TO SCORE:
${text}

Score 1 point each for:

4. NICHE SPECIFICITY — Is this post specific to the user's niche? Would their dream client (${dreamClient || "not specified"}) read this and think 'this is for me'? Generic motivational content = 0. Industry-specific insight = 1.

5. VOICE MATCH — Does this sound like the user wrote it? Compare sentence length, tone, vocabulary, and quirks against their voice profile. If it reads like a different person or generic AI, score 0. If it's a natural match, score 1.

6. DATA-ALIGNED — Based on the regression insights, does this post use the patterns that correlate with high performance for THIS user? Score 0 if it ignores what works, 1 if it aligns.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a scoring engine. Return only the requested JSON." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "output_scores",
            description: "Return the AI scoring results",
            parameters: {
              type: "object",
              properties: {
                niche_score: { type: "number", enum: [0, 1] },
                niche_reason: { type: "string" },
                voice_score: { type: "number", enum: [0, 1] },
                voice_reason: { type: "string" },
                data_score: { type: "number", enum: [0, 1] },
                data_reason: { type: "string" },
              },
              required: ["niche_score", "niche_reason", "voice_score", "voice_reason", "data_score", "data_reason"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "output_scores" } },
      }),
    });

    if (!response.ok) {
      console.error("AI scoring error:", response.status);
      // Return neutral scores on AI failure
      return {
        niche_specificity: { score: 0, reason: "AI scoring unavailable" },
        voice_match: { score: 0, reason: "AI scoring unavailable" },
        data_aligned: { score: 0, reason: "AI scoring unavailable" },
      };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let scores: any;
    if (toolCall?.function?.arguments) {
      scores = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      const content = data.choices?.[0]?.message?.content || "";
      const match = content.match(/\{[\s\S]*\}/);
      scores = match ? JSON.parse(match[0]) : {};
    }

    return {
      niche_specificity: { score: scores.niche_score ?? 0, reason: scores.niche_reason || "No reason provided" },
      voice_match: { score: scores.voice_score ?? 0, reason: scores.voice_reason || "No reason provided" },
      data_aligned: { score: scores.data_score ?? 0, reason: scores.data_reason || "No reason provided" },
    };
  } catch (e) {
    console.error("AI scoring exception:", e);
    return {
      niche_specificity: { score: 0, reason: "AI scoring failed" },
      voice_match: { score: 0, reason: "AI scoring failed" },
      data_aligned: { score: 0, reason: "AI scoring failed" },
    };
  }
}

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

    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch user data for AI scoring
    const [profileRes, strategyRes] = await Promise.all([
      adminClient.from("profiles").select("voice_profile, dream_client, niche").eq("id", userId).single(),
      adminClient.from("content_strategies").select("regression_insights").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).single(),
    ]);

    const profile = profileRes.data;
    const insights = strategyRes.data?.regression_insights;

    // PART 1: Rule-based scoring
    const hook = scoreHookStrength(text);
    const emotions = scoreEmotionalTriggers(text);
    const vivid = scoreVividScene(text);
    const ruleScore = hook.score + emotions.score + vivid.score;

    // PART 2: AI-powered scoring
    const aiScores = await scoreWithAI(
      text,
      profile?.voice_profile,
      insights,
      profile?.dream_client || "",
      LOVABLE_API_KEY
    );
    const aiScore = aiScores.niche_specificity.score + aiScores.voice_match.score + aiScores.data_aligned.score;

    const total = ruleScore + aiScore;

    const breakdown = {
      hook_strength: { score: hook.score, reason: hook.reason },
      emotional_triggers: { score: emotions.score, emotions_found: emotions.emotions_found, reason: emotions.reason },
      vivid_scene: { score: vivid.score, elements_found: vivid.elements_found, reason: vivid.reason },
      niche_specificity: aiScores.niche_specificity,
      voice_match: aiScores.voice_match,
      data_aligned: aiScores.data_aligned,
      total,
    };

    return new Response(JSON.stringify({ score: total, breakdown }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("score-post error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
