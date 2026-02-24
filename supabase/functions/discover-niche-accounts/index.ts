import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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

    const body = await req.json().catch(() => ({}));

    // Read profile from DB so context is always available regardless of caller
    const { data: profile } = await adminClient
      .from("profiles")
      .select("niche, dream_client, end_goal")
      .eq("id", user.id)
      .single();

    const niche = body.niche || profile?.niche || "";
    const dreamClient = body.dream_client || profile?.dream_client || "";
    const endGoal = profile?.end_goal || "";

    console.log("discover-niche-accounts for user:", user.id, "niche:", niche);

    const systemPrompt = `You are a Threads growth strategist helping a creator find accounts to study and learn from.

Your goal: find content creators who are ACHIEVING what this user wants to achieve, in their niche, creating content that resonates with their target audience.

PRIORITIZE:
- Mid-tier creators (5K-100K followers) with high engagement rates over celebrities or mega-influencers
- Creators who actively post content that attracts the user's dream client
- Creators whose content strategy aligns with the user's end goal (e.g., if the goal is selling coaching, find creators who successfully convert followers into clients)
- Creators with strong engagement (lots of replies and reposts, not just views)

DO NOT suggest:
- Celebrities, athletes, or entertainment accounts unless they're in the user's exact niche
- Generic motivational accounts
- Accounts with millions of followers but low engagement

For each account, provide:
- Username (real Threads usernames if you know them, otherwise describe the type of account to search for)
- Why they're worth studying specifically for this user's goals
- What content patterns make them successful with the target audience
- What the user can learn from their style

Respond as JSON:
{
  "accounts": [
    {
      "username": "@example or 'Look for accounts that...'",
      "why": "...",
      "patterns": ["pattern1", "pattern2"],
      "lesson": "..."
    }
  ],
  "niche_patterns": {
    "top_hooks": ["hook pattern 1", "hook pattern 2"],
    "best_archetypes": ["archetype1", "archetype2"],
    "content_mix": { "tof": 50, "mof": 30, "bof": 20 }
  }
}`;

    const userMessage = `My niche: ${niche}\nMy dream client: ${dreamClient}\nMy end goal: ${endGoal}\n\nFind Threads creators I should study — people who are creating content that attracts my dream client and achieving goals similar to mine.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("Anthropic error:", aiRes.status, errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const rawText = aiData.content?.[0]?.text || "";
    console.log("AI response length:", rawText.length);

    let parsed: any;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", rawText.slice(0, 500));
      // Still save raw as fallback
      parsed = { accounts: [], niche_patterns: {}, raw_response: rawText };
    }

    // Save accounts to competitor_accounts table
    if (parsed.accounts && Array.isArray(parsed.accounts)) {
      for (const account of parsed.accounts) {
        const username = (account.username || "").replace(/^@/, "").trim();
        if (username) {
          await adminClient.from("competitor_accounts").upsert(
            {
              user_id: user.id,
              threads_username: username,
              niche_relevance_score: 80,
            },
            { onConflict: "user_id,threads_username" }
          ).then(() => {});
        }
      }
    }

    // Save niche patterns to content_strategies
    await adminClient.from("content_strategies").upsert(
      {
        user_id: user.id,
        strategy_type: "niche_discovery",
        strategy_data: parsed,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,strategy_type" }
    );

    console.log("=== NICHE ACCOUNTS DISCOVERED ===");

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
