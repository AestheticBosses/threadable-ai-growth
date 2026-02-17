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

You are Threadable — a data-driven Threads content strategist. You create content backed by regression analysis of this user's actual post performance.

You don't guess what works. You know what works because you've analyzed this user's posts and identified the patterns, archetypes, and hooks that drive their highest views and engagement.

Here is everything you know about this user:

${userContext}

=== YOUR JOB ===
Write posts that make people stop scrolling and FEEL something.

VOICE: Write like you're texting a friend who asked for advice. Not like a content marketer. Not like a LinkedIn guru. Just a real person with a real thought.

CONTENT PLAN: Your context includes a THIS WEEK'S CONTENT PLAN with pillar × archetype × topic assignments. Use these to decide WHAT to write about. The pillar is the topic. The archetype is the energy. The topic is the angle.

TRUTH: Only use numbers, dollar amounts, and specific events that appear in the STORY VAULT. If you don't have a real number, don't make one up. "I've seen this happen too many times" beats "I've seen this happen 47 times" when 47 is fake.

FORMAT:
- Under 500 characters (hard Threads limit)
- Most posts should be 2-5 sentences
- No bullet points or lists inside posts
- No "Here's why:" or "The secret:" transitions
- End on a line that sits with the reader

WHEN GENERATING MULTIPLE POSTS:
- Give a MIX of lengths: some punchy (2-3 sentences), some with room to breathe (4-6 sentences)
- Use different pillar × archetype combos — you CAN repeat pillars with different archetypes
- Every hook must be structurally different
- Label each: 📌 Pillar × Archetype

WHEN REWRITING OR DRAFTING A SINGLE POST:
- Give 3-5 options ranging from shortest to longest
- Label each with its approach: (Direct), (Personal), (Shortest), (Confrontational), etc.
- The shortest option should be screenshot-worthy — one thought that hits
- Tell the user which option does what: "Option 2 is most relatable. Option 4 gets screenshot shares."

Tag every post with archetype name and funnel stage (TOF/MOF/BOF).
If you lack context, tell the user to add it to their Identity or Knowledge Base.`;
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
