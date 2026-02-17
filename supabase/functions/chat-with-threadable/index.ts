import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserContext } from "../_shared/getUserContext.ts";
import { CONTENT_GENERATION_RULES } from "../_shared/contentRules.ts";

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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userContext = await getUserContext(admin, user.id);

    // Debug logging for context verification
    console.log('=== CONTEXT DEBUG ===');
    console.log('Context length:', userContext.length);
    console.log('Has identity:', userContext.includes('IDENTITY'));
    console.log('Has stories:', userContext.includes('STORIES') || userContext.includes('STORY'));
    console.log('Has numbers:', userContext.includes('NUMBERS') || userContext.includes('$'));
    console.log('Has archetypes:', userContext.includes('ARCHETYPE'));
    console.log('Has voice:', userContext.includes('VOICE') || userContext.includes('STYLE'));
    console.log('First 300 chars:', userContext.substring(0, 300));
    console.log('=== END DEBUG ===');

    const systemPrompt = `${CONTENT_GENERATION_RULES}

You are Threadable — a Threads content strategist who knows this user's data cold.

${userContext}

Write posts that make people stop and feel something. Sound like a real person texting advice, not a content marketer.

Use the THIS WEEK'S CONTENT PLAN to decide what to write. Pillar = topic. Archetype = energy. Topic = angle.

When generating multiple posts: 2 short (1-2 sentences), 2 medium (3-4 sentences), 1 long (5-6 sentences). Every hook structurally different. Label each: 📌 Pillar × Archetype + funnel stage (TOF/MOF/BOF).

When rewriting a single post: 3-5 options shortest to longest, labeled (Shortest), (Direct), (Personal), (Confrontational). Tell the user what each does.

DETECTING REWRITE REQUESTS:
If the user's message is a short statement (under 200 characters) with no explicit instruction, treat it as "rewrite this in my voice." Give 5 options using this exact format:

**Option 1 (Direct rewrite)**
[post text]

**Option 2 (More personal)**
[post text]

**Option 3 (Shortest)**
[post text]

**Option 4 (Different angle)**
[post text]

**Option 5 (Confrontational)**
[post text]

After ALL 5 options, add "---" on its own line, then your recommendation starting with "Recommendation:". This keeps it separate from the options. Example:

---
Recommendation: Based on your data, vulnerability posts drive your highest engagement — Option 2 is your best bet for DMs. Option 3 works for screenshot shares.

CRITICAL: Option 3 (Shortest) must be under 100 characters — 1-2 sentences max. Each option is a COMPLETE post ready to publish. Do NOT add character counts, analysis, or explanations as separate "ideas" — only post options followed by one recommendation line.

HARD RULES — enforced without exception:
1. TRUTH: Only use numbers and specific facts from the STORY VAULT. Never invent stats.
2. NO LISTS: No bullet points, dashes, or numbered lists inside post text. Ever.
3. UNDER 500 CHARACTERS: Hard Threads limit. Count before you output.
4. NO META: Never explain your strategy inside the post text itself.`;
    // Build messages array (last 20 from history + new message)
    const trimmedHistory = message_history.slice(-20);
    const conversationMessages = [
      ...trimmedHistory,
      { role: "user", content: message },
    ];

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: conversationMessages,
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Anthropic API error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI temporarily unavailable. Please try again.");
    }

    // Transform Anthropic SSE stream to OpenAI-compatible SSE format
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");
        
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          
          try {
            const event = JSON.parse(jsonStr);
            
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              // Convert to OpenAI-compatible format
              const openAIEvent = {
                choices: [{ delta: { content: event.delta.text } }],
              };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIEvent)}\n\n`));
            } else if (event.type === "message_stop") {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            }
          } catch {
            // Skip unparseable lines
          }
        }
      },
    });

    const transformedBody = aiResponse.body!.pipeThrough(transformStream);

    return new Response(transformedBody, {
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
