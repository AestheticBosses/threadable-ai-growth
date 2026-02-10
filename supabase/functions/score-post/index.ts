import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default checklist if no playbook exists
const DEFAULT_CHECKLIST = [
  { points: 2, question: "Does it include a specific number, dollar amount, or authority name?", data_backing: "Posts with specifics get higher engagement" },
  { points: 2, question: "Does it create a curiosity gap or promise insider knowledge?", data_backing: "Curiosity-driven hooks increase views" },
  { points: 1, question: "Does it speak to entrepreneurial struggle/reality?", data_backing: "Relatability drives engagement" },
  { points: 1, question: "Does it reference millennial/parent experiences?", data_backing: "Niche-specific content performs better" },
  { points: 1, question: "Does it take a contrarian or controversial stance?", data_backing: "Controversial posts get more shares" },
  { points: -1, question: "Does it avoid generic business advice (has specific details)?", data_backing: "Generic content underperforms" },
];

// Regex patterns mapped to common checklist themes
const PATTERN_MAP: Record<string, RegExp> = {
  "specific number": /\$\d|\d+[kKmM]\b|\d{2,}%|\d+x\b/i,
  "dollar amount": /\$\d/i,
  "authority name": /hormozi|cardone|gary\s*vee|elon|bezos|buffett|cuban|rogan|iman|naval/i,
  "curiosity gap": /find out|here's|secret|most people don't|I'll give|the exact|what happened|turns out|nobody|truth is/i,
  "insider knowledge": /insider|behind the scenes|what they don't|the real reason/i,
  "entrepreneurial struggle": /struggle|hard|lonely|scared|real talk|honest|nobody warns|truth|failed|broke|quit|fired|rejected/i,
  "reality": /reality|real world|in practice|actually|the truth/i,
  "millennial": /millennial|30s|grew up|90s|generation|remember when/i,
  "parent": /kids|dad|mom|parent|family|school|bedtime|daughter|son|wife|husband/i,
  "contrarian": /stop|run the fuck|bullshit|dead|overrated|wrong|don't|scam|unpopular opinion|hot take|controversial/i,
  "controversial": /disagree|fight me|hear me out|nobody wants to hear|uncomfortable truth/i,
  "generic": /^(success|hustle|grind|mindset|believe|dream|journey|passion|motivated)\b/i,
  "specific details": /\$\d|\d+[kKmM]\b|[A-Z][a-z]+\s+(said|told|asked)|"[^"]+"|at \d|in \d{4}|last (week|month|year)/i,
};

function scoreAgainstChecklist(
  text: string,
  checklist: { points: number; question: string; data_backing: string }[]
): { total: number; max_possible: number; items: { question: string; points: number; passed: boolean; data_backing: string }[] } {
  const items = checklist.map((item) => {
    const q = item.question.toLowerCase();
    let passed = false;

    // Match question text to patterns
    if (q.includes("specific number") || q.includes("dollar amount") || q.includes("authority name")) {
      passed = PATTERN_MAP["specific number"].test(text) ||
               PATTERN_MAP["dollar amount"].test(text) ||
               PATTERN_MAP["authority name"].test(text);
    } else if (q.includes("curiosity gap") || q.includes("insider knowledge")) {
      passed = PATTERN_MAP["curiosity gap"].test(text) ||
               PATTERN_MAP["insider knowledge"].test(text);
    } else if (q.includes("entrepreneurial") || q.includes("struggle") || q.includes("reality")) {
      passed = PATTERN_MAP["entrepreneurial struggle"].test(text) ||
               PATTERN_MAP["reality"].test(text);
    } else if (q.includes("millennial") || q.includes("parent") || q.includes("dad") || q.includes("family")) {
      passed = PATTERN_MAP["millennial"].test(text) ||
               PATTERN_MAP["parent"].test(text);
    } else if (q.includes("contrarian") || q.includes("controversial")) {
      passed = PATTERN_MAP["contrarian"].test(text) ||
               PATTERN_MAP["controversial"].test(text);
    } else if (q.includes("generic") || q.includes("avoid")) {
      // "Avoid generic" = pass if post has specific details
      passed = PATTERN_MAP["specific details"].test(text) &&
               !PATTERN_MAP["generic"].test(text.split("\n")[0] || "");
    } else {
      // Fallback: try to match any keywords from the question
      const keywords = q.match(/\b[a-z]{4,}\b/g) || [];
      const lower = text.toLowerCase();
      const matches = keywords.filter(kw => lower.includes(kw));
      passed = matches.length >= 2;
    }

    return {
      question: item.question,
      points: item.points,
      passed,
      data_backing: item.data_backing,
    };
  });

  const maxPossible = checklist.reduce((sum, i) => sum + Math.max(0, i.points), 0);
  const total = items.reduce((sum, i) => {
    if (i.passed && i.points > 0) return sum + i.points;
    if (!i.passed && i.points < 0) return sum + Math.abs(i.points); // penalty avoided = no change
    if (i.passed && i.points < 0) return sum; // "avoid" criterion passed = no penalty
    return sum;
  }, 0);

  // Normalize to 6-point scale
  const normalized = maxPossible > 0 ? Math.round((total / maxPossible) * 6) : 0;

  return { total: Math.min(6, normalized), max_possible: 6, items };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Fetch playbook checklist
    const { data: playbookRow } = await adminClient
      .from("content_strategies")
      .select("strategy_data")
      .eq("user_id", userId)
      .eq("strategy_type", "playbook")
      .limit(1)
      .maybeSingle();

    const playbookData = playbookRow?.strategy_data as any;
    const checklist = playbookData?.checklist && playbookData.checklist.length > 0
      ? playbookData.checklist
      : DEFAULT_CHECKLIST;

    const result = scoreAgainstChecklist(text, checklist);

    const breakdown: Record<string, any> = {};
    result.items.forEach((item, i) => {
      breakdown[`criterion_${i}`] = {
        question: item.question,
        points: item.points,
        score: item.passed ? 1 : 0,
        passed: item.passed,
        reason: item.passed
          ? `✅ Met: ${item.question} (+${item.points}pt)`
          : `❌ Not met: ${item.question}`,
        data_backing: item.data_backing,
      };
    });
    breakdown.total = result.total;

    return new Response(JSON.stringify({ score: result.total, breakdown }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("score-post error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
