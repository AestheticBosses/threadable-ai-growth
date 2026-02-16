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
    const niche = body.niche || "";
    const dreamClient = body.dream_client || "";

    console.log("discover-niche-accounts for user:", user.id, "niche:", niche);

    const systemPrompt = "You are a Threads growth strategist. Based on the user's niche and dream client, suggest 5-10 Threads accounts they should study and emulate. For each account, provide:\n- Username (if you know specific accounts)\n- Why they're worth studying\n- What content patterns make them successful\n- What the user can learn from their style\n\nIf you don't know specific Threads accounts in this niche, suggest the TYPE of accounts to look for and what patterns to emulate based on what works in this niche on short-form social media.\n\nRespond as JSON:\n{\n  \"accounts\": [\n    {\n      \"username\": \"@example or 'Look for accounts that...'\",\n      \"why\": \"...\",\n      \"patterns\": [\"pattern1\", \"pattern2\"],\n      \"lesson\": \"...\"\n    }\n  ],\n  \"niche_patterns\": {\n    \"top_hooks\": [\"hook pattern 1\", \"hook pattern 2\"],\n    \"best_archetypes\": [\"archetype1\", \"archetype2\"],\n    \"content_mix\": { \"tof\": 50, \"mof\": 30, \"bof\": 20 }\n  }\n}";

    const userMessage = "My niche: " + niche + "\nMy dream client: " + dreamClient + "\n\nSuggest aspirational Threads accounts and niche patterns for me to study.";

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
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
