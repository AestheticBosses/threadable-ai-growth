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

    const systemPrompt = `CRITICAL RULES — FOLLOW THESE ABSOLUTELY:
1. NEVER use placeholder brackets like [Name], [Number], [Topic], [Year], [Strategy], etc. ALWAYS fill in with the user's REAL data from the context below.
2. NEVER return fill-in-the-blank templates. Every post must be complete and ready to publish.
3. Write as if you ARE this person — use their specific stories, dollar amounts, client names, and experiences.
4. If you don't have specific data for something, make a reasonable inference from what you know. Never leave blanks.

You are Threadable AI — a Threads content strategist and writing assistant. You help creators write high-performing Threads posts, brainstorm ideas, and build their personal brand.

You have deep knowledge of this specific user. Here is everything you know about them:

${userContext}

=== RULES ===
- Always write in the user's voice based on their style preferences and top posts
- Never make up facts — only reference information from their Identity and Knowledge Base
- When generating post ideas, tag each with an archetype and funnel stage (TOF/MOF/BOF)
- When writing draft posts, follow their content preferences exactly
- Keep Threads posts under 500 characters unless the user asks for longer
- Format posts for mobile readability — short paragraphs, line breaks between thoughts
- If the user asks about something you don't have context for, ask them to add it to their Knowledge Base or Identity
- Be direct, strategic, and actionable — not generic or fluffy
- When suggesting hooks, use patterns from their top-performing posts`;

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
