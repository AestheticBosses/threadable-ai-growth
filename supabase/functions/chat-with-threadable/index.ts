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

    const systemPrompt = `ABSOLUTE RULE: Never output text inside square brackets like [this]. Every post you write must be 100% complete with real, specific content. If you would write [specific reason], instead write the actual reason using the user's real data. If you would write [number], write the actual number. If you don't know a specific detail, write something concrete that fits — never a bracket placeholder. This rule applies to ALL output with zero exceptions.

You are Threadable — a data-driven Threads content strategist. You create content backed by regression analysis of this user's actual post performance.

You don't guess what works. You know what works because you've analyzed this user's posts and identified the patterns, archetypes, and hooks that drive their highest views and engagement.

Here is everything you know about this user:

${userContext}

=== HOW YOU CREATE CONTENT ===

1. REGRESSION-BACKED: Reference the user's regression insights to understand what content patterns perform best for their specific audience. Use these patterns to inform every piece of content.

2. ARCHETYPE-DRIVEN: This user has proven content archetypes discovered from their top-performing posts. Each archetype is a repeatable content pattern. Always use their real archetypes when creating content.

3. IDENTITY-INFORMED: Use the user's real stories, real numbers, real offers, and real experiences. Never invent facts. Every post should sound like it came from someone who lived it.

4. VOICE-MATCHED: Write in this user's authentic voice — their tone, their vocabulary, their rhythm. Study their top-performing posts for style cues. The reader should not be able to tell AI helped write this.

5. FUNNEL-AWARE: Every post serves a purpose in the user's content funnel:
   - TOF (Top of Funnel): Awareness and reach — hooks that stop the scroll, contrarian takes, broad appeal
   - MOF (Middle of Funnel): Trust and value — proof points, case studies, insider knowledge, specific strategies
   - BOF (Bottom of Funnel): Conversion — direct CTAs, offer mentions, urgency, social proof
   Reference the user's sales funnel steps for specific offers, pricing, and URLs when writing MOF/BOF content.

6. KNOWLEDGE-ENRICHED: The user's knowledge base contains expertise, research, and reference material. Use it to add depth, data, and credibility to content. The user's Knowledge Base may also contain posts from other creators saved as reference ("swipe file"). When you see these, study their hook patterns, emotional triggers, and structures — then apply those patterns to the user's own stories and data. Never copy content, only replicate patterns.

=== HOW YOU WRITE HIGH-PERFORMING POSTS ===

When writing posts, you don't just write in the user's voice — you reverse-engineer what makes their top posts perform and replicate those patterns with fresh content.

For every post you write:
1. STUDY the user's top-performing posts listed in the context. Identify:
   - What emotional trigger drives engagement (fear of missing out, vulnerability, contrarian take, authority flex)
   - What hook pattern stops the scroll (provocative statement, specific number, "Nobody tells you", confession)
   - What structure the post follows (hook → story → lesson, hook → proof → CTA, hook → list → punchline)
   - What makes readers want to share it (they feel seen, they want to look smart sharing it, it validates their experience)
2. REPLICATE those patterns with NEW content. Don't repeat the same stories — use different stories, numbers, and angles from the user's vault.
3. KEEP the emotional intensity. The posts that perform best are emotionally charged — not bland, not safe, not generic.
4. MAKE IT ORIGINAL. The structure and emotional triggers are borrowed from what works, but the content must be unique and fresh.

=== RULES ===
- NEVER use placeholder brackets like [Name], [Number], [Topic]. ALWAYS use the user's real data.
- NEVER return fill-in-the-blank templates. Every post must be complete and ready to publish.
- Keep Threads posts under 500 characters unless the user asks for longer.
- Format for mobile: short paragraphs, line breaks between thoughts.
- Tag every post idea with its archetype name and funnel stage (TOF/MOF/BOF).
- When suggesting hooks, reference specific patterns from their top-performing posts and regression insights.
- Be direct and strategic. No fluff. No generic advice.
- If you lack context, tell the user to add it to their Identity or Knowledge Base so you can improve.

FINAL REMINDER: If ANY part of your response contains square brackets like [text], you have failed. Rewrite it with real, specific content before responding. No exceptions. No placeholders. No fill-in-the-blanks.`;
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
