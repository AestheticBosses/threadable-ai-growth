import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function recoverTruncatedJSON(raw: string): any {
  let cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  // Fix unquoted keys
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  cleaned = cleaned.replace(/'/g, '"');
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  // Try to recover truncated JSON
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > 0) {
    let attempt = cleaned.substring(0, lastBrace + 1);
    // Close any open arrays/objects
    const opens = (attempt.match(/\[/g) || []).length;
    const closes = (attempt.match(/\]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) attempt += "]";
    const openBraces = (attempt.match(/\{/g) || []).length;
    const closeBraces = (attempt.match(/\}/g) || []).length;
    for (let i = 0; i < openBraces - closeBraces; i++) attempt += "}";
    try { return JSON.parse(attempt); } catch { /* continue */ }
  }
  // Extract JSON object
  const match = cleaned.match(/(\{[\s\S]*\})/);
  if (match) { try { return JSON.parse(match[1]); } catch { /* continue */ } }
  throw new Error("Could not parse JSON: " + cleaned.substring(0, 200));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");
    const userId = user.id;

    console.log(`[extract-vault] Starting for user ${userId}`);

    // 1. Query posts — top 25 by views + most recent 25, dedup, truncate to 200 chars
    const [topRes, recentRes] = await Promise.all([
      supabase.from("posts_analyzed").select("id, text_content").eq("user_id", userId).order("views", { ascending: false }).limit(25),
      supabase.from("posts_analyzed").select("id, text_content").eq("user_id", userId).order("posted_at", { ascending: false }).limit(25),
    ]);

    const postsMap = new Map<string, string>();
    for (const p of [...(topRes.data || []), ...(recentRes.data || [])]) {
      if (p.text_content && !postsMap.has(p.id)) postsMap.set(p.id, p.text_content.substring(0, 200));
    }
    const allPosts = Array.from(postsMap.values());
    if (allPosts.length === 0) throw new Error("No posts found to analyze");
    console.log(`[extract-vault] ${allPosts.length} unique posts to analyze`);

    // 2. Query existing entries to avoid dupes
    const [storiesRes, kbRes, numbersRes] = await Promise.all([
      supabase.from("user_story_vault").select("data").eq("user_id", userId).eq("section", "stories").maybeSingle(),
      supabase.from("knowledge_base").select("title").eq("user_id", userId),
      supabase.from("user_story_vault").select("data").eq("user_id", userId).eq("section", "numbers").maybeSingle(),
    ]);

    const existingStoryTitles: string[] = ((storiesRes.data as any)?.data || []).map((s: any) => s.title || "");
    const existingKBTitles: string[] = (kbRes.data || []).map((k: any) => k.title);
    const existingNumberLabels: string[] = ((numbersRes.data as any)?.data || []).map((n: any) => n.label || "");

    const existingList = [
      ...existingStoryTitles.filter(Boolean).map((t: string) => `Story: ${t}`),
      ...existingKBTitles.filter(Boolean).map((t: string) => `Knowledge: ${t}`),
      ...existingNumberLabels.filter(Boolean).map((t: string) => `Number: ${t}`),
    ].join("\n");

    // 3. Build prompt
    const systemPrompt = `You are analyzing a creator's post history to extract raw material for future content generation. Extract ONLY what is explicitly stated or clearly implied in the posts — never invent.

From these posts, extract:

A) STORIES — real experiences and anecdotes. For each:
- title: short descriptive title (max 10 words)
- section: one of 'origin', 'struggle', 'win', 'lesson', 'identity', 'family', 'business', 'hot_take'
- data: the full story in 2-3 sentences as the creator told it
- lesson: the takeaway in 1 sentence
- tags: array of 1-3 relevant tags

B) NUMBERS — specific metrics, dollar amounts, and data points the creator has cited. For each:
- label: what the number represents (e.g., 'Monthly Revenue', 'Views in 24 Hours')
- value: the exact figure as stated (e.g., '$350K/month', '45K+')
- context: where this number comes from in 1 short phrase (e.g., 'Natura Med Spa', 'Threads organic experiment')

C) KNOWLEDGE BASE — frameworks, insights, expertise, and opinions. For each:
- title: short descriptive title
- type: one of 'framework', 'data_point', 'opinion', 'case_study', 'industry_insight'
- summary: the insight in 1-2 sentences

D) UNTAPPED ANGLES — topics hinted at but never fully explored. For each:
- title: the angle in a few words
- why: why this could resonate, in 1 sentence

Rules:
- Extract at LEAST 20 stories, 15 numbers, 25 knowledge entries, and 10 untapped angles if the post history supports it
- Deduplicate — same story across multiple posts = one entry
- Look for throwaway details that could become full posts (a city, a client result, a tool, a habit, a specific moment)
- For numbers: only extract figures the creator actually stated. Never calculate or estimate.

ALREADY EXISTING (do not duplicate these):
${existingList || "(none)"}

Respond in JSON only, no markdown: { "stories": [...], "numbers": [...], "knowledge_base": [...], "untapped_angles": [...] }`;

    const userMessage = `Here are the creator's posts:\n\n${allPosts.map((p, i) => `--- Post ${i + 1} ---\n${p}`).join("\n\n")}`;

    // 4. Call Anthropic
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 115000);

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic error ${anthropicRes.status}: ${errText.substring(0, 300)}`);
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text || "";
    console.log(`[extract-vault] AI response length: ${rawText.length}`);

    // 5. Parse
    const parsed = recoverTruncatedJSON(rawText);
    const stories = parsed.stories || [];
    const numbers = parsed.numbers || [];
    const knowledgeEntries = parsed.knowledge_base || [];
    const untappedAngles = parsed.untapped_angles || [];

    console.log(`[extract-vault] Parsed: ${stories.length} stories, ${numbers.length} numbers, ${knowledgeEntries.length} KB, ${untappedAngles.length} angles`);

    // 6. Upsert results

    // Stories → user_story_vault (merge with existing)
    let storiesAdded = 0;
    if (stories.length > 0) {
      const existingStories: any[] = (storiesRes.data as any)?.data || [];
      const existingTitleSet = new Set(existingStories.map((s: any) => (s.title || "").toLowerCase()));
      const newStories = stories
        .filter((s: any) => s.title && !existingTitleSet.has(s.title.toLowerCase()))
        .map((s: any) => ({
          title: s.title,
          story: s.data || s.story || "",
          lesson: s.lesson || "",
          tags: s.tags || [],
        }));
      storiesAdded = newStories.length;
      if (newStories.length > 0) {
        const merged = [...existingStories, ...newStories];
        const existingRow = storiesRes.data;
        if (existingRow) {
          await supabase.from("user_story_vault").update({ data: merged }).eq("user_id", userId).eq("section", "stories");
        } else {
          await supabase.from("user_story_vault").insert({ user_id: userId, section: "stories", data: merged });
        }
      }
    }

    // Numbers → user_story_vault section=numbers
    let numbersAdded = 0;
    if (numbers.length > 0) {
      const existingNumbers: any[] = (numbersRes.data as any)?.data || [];
      const existingLabelSet = new Set(existingNumbers.map((n: any) => (n.label || "").toLowerCase()));
      const newNumbers = numbers
        .filter((n: any) => n.label && !existingLabelSet.has(n.label.toLowerCase()))
        .map((n: any) => ({
          label: n.label,
          value: n.value || "",
          context: n.context || "",
        }));
      numbersAdded = newNumbers.length;
      if (newNumbers.length > 0) {
        const merged = [...existingNumbers, ...newNumbers];
        const existingRow = numbersRes.data;
        if (existingRow) {
          await supabase.from("user_story_vault").update({ data: merged }).eq("user_id", userId).eq("section", "numbers");
        } else {
          await supabase.from("user_story_vault").insert({ user_id: userId, section: "numbers", data: merged });
        }
      }
    }

    // Knowledge base → knowledge_base table
    let kbAdded = 0;
    if (knowledgeEntries.length > 0) {
      const existingTitleSet = new Set(existingKBTitles.map((t: string) => t.toLowerCase()));
      const newKB = knowledgeEntries
        .filter((k: any) => k.title && !existingTitleSet.has(k.title.toLowerCase()))
        .map((k: any) => ({
          user_id: userId,
          title: k.title,
          type: "text",
          content: k.summary || "",
          tags: [k.type || "insight"],
          processed: true,
          summary: k.summary || "",
        }));
      kbAdded = newKB.length;
      if (newKB.length > 0) {
        // Insert in batches of 25
        for (let i = 0; i < newKB.length; i += 25) {
          const batch = newKB.slice(i, i + 25);
          const { error } = await supabase.from("knowledge_base").insert(batch);
          if (error) console.error("[extract-vault] KB insert error:", error.message);
        }
      }
    }

    // Untapped angles → content_strategies
    let anglesAdded = 0;
    if (untappedAngles.length > 0) {
      anglesAdded = untappedAngles.length;
      await supabase.from("content_strategies").upsert({
        user_id: userId,
        strategy_type: "untapped_angles",
        strategy_data: { angles: untappedAngles },
        status: "active",
      }, { onConflict: "user_id,strategy_type", ignoreDuplicates: false });
    }

    console.log(`[extract-vault] Done: ${storiesAdded} stories, ${numbersAdded} numbers, ${kbAdded} KB, ${anglesAdded} angles`);

    return new Response(
      JSON.stringify({
        stories: storiesAdded,
        numbers: numbersAdded,
        knowledge_base: kbAdded,
        untapped_angles: anglesAdded,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[extract-vault] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
