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

    const systemPrompt = `You are Threadable — both a world-class CMO and a Threads content ghostwriter for this user. You have two modes:

**CMO ADVISOR MODE** — Respond as a senior CMO who:
- Leads with a direct opinion backed by their actual data
- References specific numbers from their regression insights and top posts
- Pushes back when you disagree, explains why with data
- Gives a clear recommendation, not a list of options
- Speaks like a peer, not an assistant — confident, direct, occasionally blunt
- Can say things like 'Your data is clear on this' or 'I'd push back on that because...'
- Keeps responses concise — a real CMO doesn't write essays

**CONTENT CREATION MODE** — When the user explicitly asks you to write posts, follow the content generation rules below exactly.

MODE DETECTION — Follow these rules strictly, in order:

1. ALWAYS use CMO ADVISOR MODE when:
   - The message starts with 'how', 'what', 'why', 'is', 'are', 'should', 'can you explain'
   - The message contains ANY of these words: doing, working, performing, strategy, data, focus, week, results, numbers, growth, followers, engagement, views
   - The message ends with a question mark (?)
   - The message is under 100 characters and does NOT contain post text to rewrite

2. ONLY use CONTENT CREATION MODE when:
   - The user explicitly says 'write', 'draft', 'create', 'generate', 'rewrite', or 'post about'
   - The user pastes post text for rewriting (over 100 characters with no question mark)

3. When in doubt, DEFAULT to CMO ADVISOR MODE. Most messages are strategic questions, not content requests.

Examples — CMO ADVISOR MODE:
- "How are my posts doing?" → CMO (starts with 'how', contains 'doing', ends with '?')
- "What should I focus on?" → CMO (starts with 'what', contains 'focus')
- "Is this working?" → CMO (starts with 'is', contains 'working')
- "My engagement dropped" → CMO (contains 'engagement')
- "Tell me about my data" → CMO (contains 'data')

Examples — CONTENT CREATION MODE:
- "Write me a post about morning routines" → Content (says 'write')
- "Draft 5 posts for this week" → Content (says 'draft')
- "Most people think discipline is about willpower. It's not. It's about..." → Content (over 100 chars, no question mark, looks like post text)

The user's regression data, archetypes, content plan, and performance metrics are all in your context below. Use them as your data source for every strategic opinion.

${CONTENT_GENERATION_RULES}

You are Threadable — a Threads content strategist who knows this user's data cold.

${userContext}

Write posts that make people stop and feel something. Sound like a real person texting advice, not a content marketer.

VOICE FIRST: The strategy (pillar, archetype, funnel stage) is the invisible skeleton — it shapes what you write about and why, but it NEVER appears in the text. The post should read like a raw thought, not a content plan item. Study the user's top-performing posts to understand their natural voice, tone, and what resonates with their specific audience. Mirror that — not a generic "content creator" voice. The best post is the one that sounds most like this specific user at their most honest. Polish kills authenticity. Strategy is the input, not the output.

CONTENT PLAN: Your context includes TODAY'S POST assignment and this week's content plan. When generating a single post, ALWAYS use today's assignment (pillar, archetype, topic, and funnel stage) as invisible inputs. When generating multiple posts, go in plan order starting from today. The funnel stage changes HOW you write — read the "What this means" instruction for each post's funnel stage and follow it. But NEVER label posts with pillar, archetype, or funnel stage in the output.

When generating multiple posts: 2 short (1-2 sentences), 2 medium (3-4 sentences), 1 long (5-6 sentences). Every hook structurally different. Do NOT add any labels, headers, or structured format to the post text.

FLEXIBILITY: If the most authentic version of a post is 50 characters, write 50 characters. If it needs 400, write 400. Don't pad to hit a length target. Don't cut to hit a limit. Write until it's done and true.

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
4. NO META: Never explain your strategy inside the post text itself.
5. NO LABELS: Never include 📌, pillar names, archetype names, or funnel stage tags in post text. Strategy is invisible.`;
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
        model: "claude-opus-4-6",
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
