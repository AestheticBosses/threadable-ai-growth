import { getStageConfig } from "./journeyStage.ts";

/**
 * Classify hook type from the opening words of a post.
 */
function classifyHook(text: string): string {
  const lower = text.toLowerCase().trim();
  if (lower.startsWith("i ") || lower.startsWith("i'm ") || lower.startsWith("i've ") || lower.startsWith("i was ")) return "confession/story opener";
  if (lower.match(/^\d/) || lower.match(/^\$\d/)) return "stat/number";
  if (lower.endsWith("?") || lower.startsWith("what ") || lower.startsWith("why ") || lower.startsWith("how ") || lower.startsWith("have you ") || lower.startsWith("do you ")) return "question";
  if (lower.startsWith("nobody ") || lower.startsWith("no one ") || lower.startsWith("stop ") || lower.startsWith("don't ") || lower.startsWith("the truth ") || lower.startsWith("hot take")) return "controversy/contrarian";
  if (lower.startsWith("here's ") || lower.startsWith("here are ") || lower.match(/^\d+ (things|ways|tips|steps|reasons)/)) return "list/framework";
  if (lower.startsWith("imagine ") || lower.startsWith("picture this") || lower.startsWith("last ") || lower.startsWith("yesterday ") || lower.startsWith("3 years ago")) return "story opener";
  return "statement";
}

/**
 * Classify emotional trigger from post text.
 */
function classifyEmotion(text: string): string {
  const lower = text.toLowerCase();
  if (lower.match(/confess|honest|truth is|admit|scared|afraid|failed|mistake|broke|struggle/)) return "vulnerability";
  if (lower.match(/million|revenue|\$\d|results|clients|data|proven|study|research/)) return "authority";
  if (lower.match(/wrong|myth|actually|stop|unpopular|nobody|overrated|underrated|hot take/)) return "contrarian";
  if (lower.match(/me too|same|you're not alone|we all|everyone|relatable|feel this/)) return "relatability";
  if (lower.match(/lol|funny|weird|crazy|hilarious|joke/)) return "humor";
  if (lower.match(/now|today|limited|hurry|before|deadline|last chance|don't miss/)) return "urgency";
  if (lower.match(/dream|imagine|freedom|lifestyle|goal|vision|one day/)) return "aspiration";
  return "inspiration";
}

/**
 * Build a raw regression data section from regression_insights for AI context.
 * Includes coefficients, r_squared, and optimal word count when available.
 */
function buildRawRegressionSection(regressionData: any): string {
  if (!regressionData) return "";

  const parts: string[] = ["=== RAW REGRESSION DATA ===", "Use these coefficients to calibrate post length, style, and format decisions.", ""];

  // Correlations / coefficients
  const correlations = regressionData.correlations || regressionData.coefficients;
  if (Array.isArray(correlations) && correlations.length > 0) {
    parts.push("Feature coefficients (correlation with views):");
    for (const c of correlations) {
      const name = c.feature || c.name || "unknown";
      const val = c.correlation ?? c.coefficient ?? c.value;
      if (val !== undefined) {
        parts.push(`  ${name}: ${typeof val === "number" ? val.toFixed(4) : val}`);
      }
    }
    parts.push("");
  }

  // Boolean feature lifts
  const lifts = regressionData.boolean_lifts;
  if (Array.isArray(lifts) && lifts.length > 0) {
    parts.push("Boolean feature lifts (% change in views when present):");
    for (const l of lifts) {
      const name = l.feature || l.name || "unknown";
      const lift = l.lift_pct ?? l.lift;
      if (lift !== undefined) {
        const sign = lift > 0 ? "+" : "";
        parts.push(`  ${name}: ${sign}${typeof lift === "number" ? lift.toFixed(1) : lift}%`);
      }
    }
    parts.push("");
  }

  // R-squared
  const rSquared = regressionData.r_squared ?? regressionData.rSquared;
  if (rSquared !== undefined) {
    parts.push(`R² (model fit): ${typeof rSquared === "number" ? rSquared.toFixed(4) : rSquared}`);
  }

  // Optimal word count
  const optRange = regressionData.optimal_word_count_range;
  if (optRange?.min !== undefined && optRange?.max !== undefined) {
    parts.push(`Optimal word count range: ${optRange.min}-${optRange.max} words`);
  }

  // Best posting times
  const bestDay = regressionData.best_posting_day;
  const bestHour = regressionData.best_posting_hour;
  if (bestDay?.day) parts.push(`Best posting day: ${bestDay.day} (avg ${bestDay.avg_views || 0} views)`);
  if (bestHour?.hour !== undefined) parts.push(`Best posting hour: ${bestHour.hour}:00 (avg ${bestHour.avg_views || 0} views)`);

  parts.push("", "Positive coefficients = this variable INCREASES views. Negative = DECREASES views.", "");

  // Only return if we had actual data
  if (parts.length <= 5) return ""; // Only header + footer, no real data
  return parts.join("\n") + "\n\n";
}

/**
 * Shared utility: fetches the COMPLETE user context for AI edge functions.
 * All AI-calling edge functions should use this to ensure consistent context.
 */
export async function getUserContext(supabase: any, userId: string): Promise<string> {
  const [
    identityRes,
    storiesRes,
    offersRes,
    audiencesRes,
    personalInfoRes,
    writingStyleRes,
    contentPrefsRes,
    knowledgeRes,
    topPostsByViewsRes,
    topPostsByEngagementRes,
    recentPostsRes,
    plansRes,
    archetypesRes,
    regressionRes,
    aiRegressionRes,
    profileRes,
    salesFunnelRes,
    templatesRes,
    competitorAccountsRes,
    competitorPostsRes,
    bucketsRes,
    pillarsRes,
    topicsRes,
    planItemsRes,
    untappedAnglesRes,
    scheduledPostsRes,
    cmoProfileRes,
    recentHooksRes,
    guardrailsRes,
    playbookRes,
    allPostsArchetypeRes,
  ] = await Promise.all([
    supabase.from("user_identity").select("about_you, desired_perception, main_goal").eq("user_id", userId).maybeSingle(),
    supabase.from("user_story_vault").select("section, data").eq("user_id", userId).limit(20),
    supabase.from("user_offers").select("name, description").eq("user_id", userId).limit(20),
    supabase.from("user_audiences").select("name").eq("user_id", userId).limit(20),
    supabase.from("user_personal_info").select("content").eq("user_id", userId).limit(20),
    supabase.from("user_writing_style").select("selected_style, custom_style_description").eq("user_id", userId).maybeSingle(),
    supabase.from("content_preferences").select("content").eq("user_id", userId).order("sort_order").limit(20),
    supabase.from("knowledge_base").select("title, type, summary").eq("user_id", userId).eq("processed", true).limit(50),
    // Top 10 by views (existing)
    supabase.from("posts_analyzed").select("text_content, views, engagement_rate, archetype").eq("user_id", userId).eq("source", "own").not("text_content", "is", null).order("views", { ascending: false }).limit(10),
    // Top 10 by engagement rate (NEW — may surface different posts)
    supabase.from("posts_analyzed").select("text_content, views, engagement_rate, archetype").eq("user_id", userId).eq("source", "own").not("text_content", "is", null).order("engagement_rate", { ascending: false }).limit(10),
    // 10 recent posts for variety
    supabase.from("posts_analyzed").select("text_content, archetype").eq("user_id", userId).eq("source", "own").not("text_content", "is", null).order("posted_at", { ascending: false }).limit(10),
    supabase.from("user_plans").select("plan_type, plan_data").eq("user_id", userId),
    supabase.from("content_strategies").select("strategy_data").eq("user_id", userId).eq("strategy_type", "archetype_discovery").limit(1).maybeSingle(),
    supabase.from("content_strategies").select("regression_insights").eq("user_id", userId).eq("strategy_type", "regression").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("content_strategies").select("strategy_data").eq("user_id", userId).eq("strategy_type", "regression_insights").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("journey_stage, niche, dream_client, end_goal, voice_profile, posting_cadence, traffic_url, mission, follower_count, goal_type, dm_keyword, dm_offer, posts_per_day, revenue_target, business_model, success_metric").eq("id", userId).single(),
    supabase.from("user_sales_funnel").select("step_number, step_name, what, url, price, goal").eq("user_id", userId).order("step_number").limit(20),
    supabase.from("content_templates").select("archetype").eq("user_id", userId).order("archetype").order("sort_order").limit(20),
    // Competitor accounts the user is studying
    supabase.from("competitor_accounts").select("threads_username").eq("user_id", userId).limit(20),
    // Top competitor posts by engagement for pattern learning
    supabase.from("posts_analyzed").select("text_content, views, engagement_rate, source_username").eq("user_id", userId).eq("source", "competitor").not("text_content", "is", null).order("engagement_rate", { ascending: false }).limit(25),
    // Content strategy v2
    supabase.from("content_buckets").select("name, description, audience_persona, priority").eq("user_id", userId).eq("is_active", true).order("priority"),
    supabase.from("content_pillars").select("id, name, description, purpose, percentage, bucket_id").eq("user_id", userId).eq("is_active", true),
    supabase.from("connected_topics").select("id, pillar_id, name").eq("user_id", userId).eq("is_active", true),
    supabase.from("content_plan_items").select("scheduled_date, archetype, funnel_stage, pillar_id, topic_id, is_test_slot, status").eq("user_id", userId).gte("scheduled_date", new Date().toISOString().split("T")[0]).order("scheduled_date").limit(14),
    supabase.from("content_strategies").select("strategy_data").eq("user_id", userId).eq("strategy_type", "untapped_angles").limit(1).maybeSingle(),
    supabase.from("scheduled_posts").select("content_category, funnel_stage, scheduled_for, status").eq("user_id", userId).in("status", ["draft", "approved", "scheduled"]).order("scheduled_for", { ascending: true }).limit(10),
    supabase.from("profiles").select("weekly_refresh_summary, last_weekly_refresh_at").eq("id", userId).single(),
    // Recent published/scheduled post hooks for dedup
    supabase.from("scheduled_posts").select("text_content").eq("user_id", userId).in("status", ["published", "scheduled"]).order("created_at", { ascending: false }).limit(20),
    // Content guardrails
    supabase.from("user_content_guardrails").select("guardrail_type, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    // Playbook generation guidelines
    supabase.from("content_strategies").select("strategy_data").eq("user_id", userId).eq("strategy_type", "playbook").maybeSingle(),
    // All own posts for archetype performance aggregation
    supabase.from("posts_analyzed").select("archetype, views, engagement_rate").eq("user_id", userId).eq("source", "own").not("archetype", "is", null),
  ]);

  // === JOURNEY STAGE (extracted from profiles query — no extra round-trip) ===
  const profile = profileRes.data;
  const journeyStage = profile?.journey_stage || "getting_started";
  const stageConfig = getStageConfig(journeyStage);
  const journeySection = `Stage: ${stageConfig.label}\nFunnel mix: ${stageConfig.funnelMix.tof}% TOF / ${stageConfig.funnelMix.mof}% MOF / ${stageConfig.funnelMix.bof}% BOF\nContent focus: ${stageConfig.contentFocus}`;

  // === IDENTITY (condensed — strip anecdotes the AI would copy) ===
  const identity = identityRes.data;
  let aboutYou = identity?.about_you || "";
  // Keep only first 300 chars to limit story seeding into every generation
  aboutYou = aboutYou.substring(0, 300);
  if (aboutYou.length === 300) aboutYou += "…";
  const identitySection = aboutYou
    ? `About: ${aboutYou}\nDesired Perception: ${identity.desired_perception || "Not set"}\nMain Goal: ${identity.main_goal || "Not set"}`
    : "No identity data provided yet.";
  console.log("[getUserContext] Identity section preview:", identitySection.substring(0, 300));

  // === STORIES (real facts for grounding — framed to prevent fabrication) ===
  const stories = storiesRes.data || [];
  let storiesSection = "No stories added yet.";
  const vaultTitles: string[] = []; // Collect titles for cross-call exclusion in generate-draft-posts
  if (stories.length > 0) {
    // Shuffle vault sections so AI doesn't always see the same stories first
    const shuffledSections = [...stories].sort(() => Math.random() - 0.5);
    const storyLines: string[] = [];
    for (const s of shuffledSections) {
      const rawItems = Array.isArray(s.data) ? s.data : (s.data?.items || []);
      // Shuffle items within each section to break positional bias
      const items = [...rawItems].sort(() => Math.random() - 0.5);
      for (const item of items as any[]) {
        const title = item.title || item.name || "Untitled";
        const lesson = item.lesson || item.key_lesson || "";
        const storyText = item.story || item.content || "";
        // For "numbers" section entries, show label + value + context
        if (item.label && item.value) {
          storyLines.push(`- Number: ${item.label} = ${item.value}${item.context ? ` (${item.context})` : ""}`);
        } else {
          vaultTitles.push(title);
          // Send first 150 chars of story text — gist + tone, not full narrative
          const factSnippet = storyText.length > 150 ? storyText.substring(0, 150) + "…" : storyText;
          const lessonSnippet = lesson.length > 80 ? lesson.substring(0, 80) + "…" : lesson;
          const parts = [`- ${title}`];
          if (factSnippet) parts.push(`  ${factSnippet}`);
          if (lessonSnippet) parts.push(`  Lesson: ${lessonSnippet}`);
          storyLines.push(parts.join("\n"));
        }
      }
    }
    storiesSection = storyLines.join("\n");
  }

  // === RECENTLY USED STORY HOOKS (dedup — avoid repeating openers) ===
  const recentHookPosts = recentHooksRes.data || [];
  let recentHooksSection = "";
  if (recentHookPosts.length > 0) {
    const hooks = recentHookPosts
      .map((p: any) => {
        const text = (p.text_content || "").trim();
        if (!text) return null;
        // Extract first sentence or first line as the hook
        const firstLine = text.split("\n")[0].trim();
        const firstSentence = firstLine.split(/(?<=[.!?])\s/)[0];
        return firstSentence.length > 120 ? firstSentence.substring(0, 120) + "…" : firstSentence;
      })
      .filter(Boolean);
    if (hooks.length > 0) {
      recentHooksSection = "\n=== RECENTLY USED STORY HOOKS (avoid repeating these openings) ===\n" +
        hooks.map((h: string) => `- "${h}"`).join("\n") +
        "\nDo NOT open a new post with a hook that closely resembles any of the above. Find a fresh angle.\n";
    }
  }

  // === CONTENT GUARDRAILS ===
  const guardrails = guardrailsRes.data || [];
  let guardrailsSection = "";
  if (guardrails.length > 0) {
    const grouped = {
      never_say: guardrails.filter((g: any) => g.guardrail_type === 'never_say').map((g: any) => g.content),
      never_reference: guardrails.filter((g: any) => g.guardrail_type === 'never_reference').map((g: any) => g.content),
      always_frame: guardrails.filter((g: any) => g.guardrail_type === 'always_frame').map((g: any) => g.content),
      voice_correction: guardrails.filter((g: any) => g.guardrail_type === 'voice_correction').map((g: any) => g.content),
      offer_guardrail: guardrails.filter((g: any) => g.guardrail_type === 'offer_guardrail').map((g: any) => g.content),
    };

    const parts: string[] = [];
    if (grouped.never_say.length) parts.push(`NEVER USE THESE PHRASES OR SENTENCES:\n${grouped.never_say.map((s: string) => `- "${s}"`).join('\n')}`);
    if (grouped.never_reference.length) parts.push(`NEVER REFERENCE THESE TOPICS OR STORIES:\n${grouped.never_reference.map((s: string) => `- ${s}`).join('\n')}`);
    if (grouped.always_frame.length) parts.push(`ALWAYS FRAME CONTENT THIS WAY:\n${grouped.always_frame.map((s: string) => `- ${s}`).join('\n')}`);
    if (grouped.voice_correction.length) parts.push(`VOICE CORRECTIONS — ADJUST TONE ACCORDINGLY:\n${grouped.voice_correction.map((s: string) => `- ${s}`).join('\n')}`);
    if (grouped.offer_guardrail.length) parts.push(`OFFER & POSITIONING RULES:\n${grouped.offer_guardrail.map((s: string) => `- ${s}`).join('\n')}`);

    guardrailsSection = `=== CONTENT GUARDRAILS — THESE ARE HARD RULES, NOT SUGGESTIONS ===\n${parts.join('\n')}\nViolating any of these guardrails is a generation failure.`;
  }

  // === PLAYBOOK GENERATION GUIDELINES ===
  const playbookStrategy = playbookRes?.data?.strategy_data as any;
  let playbookGuidelinesSection = "";
  if (playbookStrategy?.generation_guidelines) {
    const g = playbookStrategy.generation_guidelines;
    const gParts: string[] = [];
    if (g.tone) gParts.push(`TONE: ${g.tone}`);
    if (g.avg_length) gParts.push(`OPTIMAL LENGTH: ${g.avg_length}`);
    if (g.vocabulary?.length) gParts.push(`VOCABULARY THAT WORKS FOR THIS CREATOR:\n${g.vocabulary.map((v: string) => `- ${v}`).join('\n')}`);
    if (g.hooks_that_work?.length) gParts.push(`HOOK PATTERNS THAT DRIVE VIEWS:\n${g.hooks_that_work.map((h: string) => `- ${h}`).join('\n')}`);
    if (g.avoid?.length) gParts.push(`NEVER DO THESE (data-validated):\n${g.avoid.map((a: string) => `- ${a}`).join('\n')}`);
    if (gParts.length > 0) {
      playbookGuidelinesSection =
        `=== CONTENT GENERATION GUIDELINES (from regression analysis of this creator's actual posts) ===\n` +
        gParts.join('\n\n') +
        `\nThese are not generic writing tips — they are validated patterns from this creator's own performance data.`;
    }
  }

  // === ARCHETYPE PERFORMANCE STATS ===
  const allArchetypePosts = allPostsArchetypeRes.data || [];
  let archetypePerformanceSection = "";
  if (allArchetypePosts.length > 0) {
    const archetypeStats: Record<string, { count: number; totalViews: number; totalER: number }> = {};
    let globalTotalViews = 0;
    let globalCount = 0;
    for (const p of allArchetypePosts) {
      const arch = p.archetype || "unknown";
      if (!archetypeStats[arch]) archetypeStats[arch] = { count: 0, totalViews: 0, totalER: 0 };
      archetypeStats[arch].count++;
      archetypeStats[arch].totalViews += p.views || 0;
      archetypeStats[arch].totalER += p.engagement_rate || 0;
      globalTotalViews += p.views || 0;
      globalCount++;
    }
    const globalAvgViews = globalCount > 0 ? globalTotalViews / globalCount : 0;

    const archLines: string[] = [];
    let bestArch = { name: "", avgViews: 0, pctAbove: 0 };
    let worstArch = { name: "", avgViews: Infinity, pctBelow: 0 };
    for (const [arch, stats] of Object.entries(archetypeStats)) {
      if (arch === "unknown") continue;
      const avgViews = stats.count > 0 ? Math.round(stats.totalViews / stats.count) : 0;
      const avgER = stats.count > 0 ? (stats.totalER / stats.count * 100).toFixed(1) : "0.0";
      archLines.push(`${arch}: ${stats.count} posts, avg ${avgViews.toLocaleString()} views, avg ${avgER}% ER`);
      if (avgViews > bestArch.avgViews) {
        bestArch = { name: arch, avgViews, pctAbove: globalAvgViews > 0 ? Math.round(((avgViews - globalAvgViews) / globalAvgViews) * 100) : 0 };
      }
      if (avgViews < worstArch.avgViews) {
        worstArch = { name: arch, avgViews, pctBelow: globalAvgViews > 0 ? Math.round(((globalAvgViews - avgViews) / globalAvgViews) * 100) : 0 };
      }
    }
    if (archLines.length > 0) {
      archetypePerformanceSection = "=== ARCHETYPE PERFORMANCE (data-driven, this user only) ===\n" +
        archLines.join("\n") + "\n" +
        (bestArch.name ? `Best performing archetype: ${bestArch.name} (+${bestArch.pctAbove}% above average)\n` : "") +
        (worstArch.name && worstArch.name !== bestArch.name ? `Underperforming archetype: ${worstArch.name} (-${worstArch.pctBelow}% below average)\n` : "") +
        "Use this data to weight archetype distribution — favor what works, limit what doesn't.";
    }
  }

  // === UNTAPPED ANGLES ===
  const untappedData = untappedAnglesRes.data?.strategy_data as any;
  let untappedSection = "";
  if (untappedData) {
    const angles = Array.isArray(untappedData) ? untappedData : (untappedData.angles || untappedData.items || []);
    if (angles.length > 0) {
      const lines = angles.map((a: any) => {
        const title = a.title || a.name || a.angle || "";
        const why = a.why || a.reason || a.description || "";
        return title ? `- ${title}${why ? `: ${why}` : ""}` : null;
      }).filter(Boolean);
      if (lines.length > 0) {
        untappedSection = "=== UNTAPPED ANGLES (use these for fresh content) ===\n" +
          "These are topics and angles the creator has hinted at but never fully explored. Use at least 2-3 of these per day to keep content fresh and prevent repeating the same stories.\n" +
          lines.join("\n");
      }
    }
  }

  // === OFFERS ===
  const offers = offersRes.data || [];
  const offersSection = offers.length > 0
    ? offers.map((o: any) => `- ${o.name}: ${o.description || ""}`).join("\n")
    : "No offers added yet.";

  // === AUDIENCES ===
  const audiences = audiencesRes.data || [];
  const audiencesSection = audiences.length > 0
    ? audiences.map((a: any) => `- ${a.name}`).join("\n")
    : "No target audiences defined.";

  // === PERSONAL INFO ===
  const personalInfo = personalInfoRes.data || [];
  const personalSection = personalInfo.length > 0
    ? personalInfo.map((p: any) => `- ${p.content}`).join("\n")
    : "No personal info added.";

  // === WRITING STYLE ===
  const writingStyle = writingStyleRes.data;
  const styleSection = writingStyle
    ? `Selected Style: ${writingStyle.selected_style}${writingStyle.custom_style_description ? `\nCustom Description: ${writingStyle.custom_style_description}` : ""}`
    : "Default style";

  // === CONTENT PREFERENCES ===
  const contentPrefs = contentPrefsRes.data || [];
  const prefsSection = contentPrefs.length > 0
    ? contentPrefs.map((p: any) => `- ${p.content}`).join("\n")
    : "No content preferences set.";

  // === ARCHETYPES ===
  const archetypeData = archetypesRes.data?.strategy_data as any;
  let archetypesSection = "No archetypes data available.";
  if (archetypeData?.archetypes && Array.isArray(archetypeData.archetypes)) {
    archetypesSection = archetypeData.archetypes.map((a: any) => {
      // Derive emotional register from drives/name — don't send copyable description text
      const drives = a.drives || "engagement";
      const pct = a.recommended_percentage || 0;
      // Derive hook style from archetype name pattern
      const hookStyle = drives.match(/trust|authority/i) ? "Bold claim backed by specific result"
        : drives.match(/engage|relat/i) ? "Vulnerable opener or shared experience"
        : drives.match(/reach|aware/i) ? "Contrarian take or surprising observation"
        : drives.match(/convert|sale/i) ? "Problem → solution with proof"
        : "Pattern-breaking statement";
      const emotionalRegister = drives.match(/trust|authority/i) ? "Confident, data-driven"
        : drives.match(/engage|relat/i) ? "Vulnerable, authentic"
        : drives.match(/reach|aware/i) ? "Bold, contrarian"
        : drives.match(/convert|sale/i) ? "Urgent, proof-driven"
        : "Varied";
      return `${a.emoji || ""} ${a.name} (${pct}% of content)\n  - Purpose: ${drives}\n  - Emotional register: ${emotionalRegister}\n  - Hook style: ${hookStyle}\n  - Drives: ${drives}`;
    }).join("\n\n");
  }

  // === KNOWLEDGE BASE (compact — 150 char summaries, top 20) ===
  const knowledge = knowledgeRes.data || [];
  const knowledgeSection = knowledge.length > 0
    ? knowledge.slice(0, 20).map((k: any) => {
        const summary = (k.summary || "").substring(0, 150);
        return `- [${k.type}] ${k.title}: ${summary}`;
      }).join("\n")
    : "No knowledge base items.";

  // === TOP POSTS BY VIEWS (full text for pattern replication) ===
  const topByViews = topPostsByViewsRes.data || [];
  let viewsSection = "No posts analyzed yet.";
  if (topByViews.length > 0) {
    viewsSection = topByViews.map((p: any, i: number) => {
      const text = p.text_content || "";
      const hook = classifyHook(text);
      const emotion = classifyEmotion(text);
      // Full text for top 5, truncated to 500 chars for 6-10
      const displayText = i < 5 ? text : (text.length > 500 ? text.slice(0, 497) + "..." : text);
      return `[${i + 1}] Views: ${(p.views || 0).toLocaleString()} | Archetype: ${p.archetype || "unknown"} | Hook: ${hook} | Trigger: ${emotion} | ER: ${p.engagement_rate ? (p.engagement_rate * 100).toFixed(1) + "%" : "N/A"}\nFull post: "${displayText}"`;
    }).join("\n\n");
  }

  // === TOP POSTS BY ENGAGEMENT RATE (patterns only) ===
  const topByEngagement = topPostsByEngagementRes.data || [];
  const engagementSection = topByEngagement.length > 0
    ? topByEngagement.map((p: any, i: number) => {
        const text = p.text_content || "";
        const firstWords = text.split(/\s+/).slice(0, 20).join(" ");
        const hook = classifyHook(text);
        const emotion = classifyEmotion(text);
        return `${i + 1}. Hook: ${hook} | Trigger: ${emotion} | Archetype: ${p.archetype || "unknown"} | ER: ${p.engagement_rate ? (p.engagement_rate * 100).toFixed(1) + "%" : "N/A"}, ${p.views || 0} views | Length: ${text.length} chars | Opens with: "${firstWords}…"`;
      }).join("\n")
    : "";

  // === RECENT POSTS (last 10, patterns only) ===
  const recentPosts = recentPostsRes.data || [];
  const recentSection = recentPosts.length > 0
    ? recentPosts.map((p: any, i: number) => {
        const text = p.text_content || "";
        const firstWords = text.split(/\s+/).slice(0, 20).join(" ");
        const hook = classifyHook(text);
        return `${i + 1}. Hook: ${hook} | Archetype: ${p.archetype || "unknown"} | Opens with: "${firstWords}…"`;
      }).join("\n")
    : "";

  // === REGRESSION INSIGHTS (from run-regression: strategy_type='regression') ===
  const regressionData = regressionRes.data?.regression_insights as any;
  let statInsights = "No statistical regression data available yet.";
  if (regressionData?.human_readable_insights && Array.isArray(regressionData.human_readable_insights)) {
    statInsights = regressionData.human_readable_insights.map((i: string) => `- ${i}`).join("\n");
  }

  let linkClickInsights = "";
  if (regressionData?.link_clicks_insights) {
    const lci = regressionData.link_clicks_insights;
    const parts: string[] = [];
    if (lci.human_readable_insights && Array.isArray(lci.human_readable_insights)) {
      parts.push(...lci.human_readable_insights.map((i: string) => `- ${i}`));
    } else if (Array.isArray(lci)) {
      parts.push(...lci.map((i: any) => `- ${typeof i === "string" ? i : JSON.stringify(i)}`));
    }
    if (parts.length > 0) linkClickInsights = parts.join("\n");
  }

  // === AI ANALYSIS INSIGHTS (from run-analysis: strategy_type='regression_insights') ===
  const aiRegressionData = aiRegressionRes.data?.strategy_data as any;
  let aiInsights = "";
  let regressionFindingsSection = "";
  if (aiRegressionData?.insights && Array.isArray(aiRegressionData.insights)) {
    aiInsights = aiRegressionData.insights.map((i: any) => {
      if (typeof i === "string") return `- ${i}`;
      const cat = i.category ? `[${i.category}] ` : "";
      const insight = i.insight || "";
      const rec = i.recommendation ? `: ${i.recommendation}` : "";
      return `- ${cat}${insight}${rec}`;
    }).join("\n");

    // Extract top findings prioritizing views, filtered by strength
    const strongInsights = aiRegressionData.insights
      .filter((i: any) => typeof i === "object" && i.insight)
      .filter((i: any) => {
        const s = (i.strength || "").toLowerCase();
        return s === "strong" || s === "very strong" || s === "moderate";
      })
      .sort((a: any, b: any) => {
        // Prioritize views over other metrics
        const metricOrder = (m: string) => (m || "").toLowerCase().includes("views") ? 0 : 1;
        const strengthOrder = (s: string) => {
          const sl = (s || "").toLowerCase();
          return sl === "very strong" ? 0 : sl === "strong" ? 1 : 2;
        };
        return metricOrder(a.metric_impacted) - metricOrder(b.metric_impacted)
          || strengthOrder(a.strength) - strengthOrder(b.strength);
      })
      .slice(0, 5);

    if (strongInsights.length > 0) {
      regressionFindingsSection = "=== REGRESSION FINDINGS (what actually drives views for this creator) ===\n" +
        strongInsights.map((i: any) =>
          `[${i.category || "General"}]: ${i.insight} — ${i.metric_impacted || "views"} impact: ${i.strength || "moderate"}${i.recommendation ? `\n  → ${i.recommendation}` : ""}`
        ).join("\n") +
        "\nApply these findings when generating content — they are validated from this creator's actual data.";
    }
  }

  const insightsSection = [
    statInsights,
    linkClickInsights ? `\n=== LINK CLICK INSIGHTS ===\n${linkClickInsights}` : "",
    aiInsights ? `\n=== AI ANALYSIS INSIGHTS ===\n${aiInsights}` : "",
  ].filter(Boolean).join("\n");

  // === PLANS (plain text summaries — no raw JSON) ===
  const plans = plansRes.data || [];
  const contentPlan = plans.find((p: any) => p.plan_type === "content_plan");
  const brandingPlan = plans.find((p: any) => p.plan_type === "branding_plan");
  const funnelPlan = plans.find((p: any) => p.plan_type === "funnel_strategy");

  let contentPlanSummary = "Not generated yet";
  if (contentPlan?.plan_data) {
    const cp = contentPlan.plan_data as any;
    const parts: string[] = ["Active"];

    // Primary archetypes
    if (cp.primary_archetypes && Array.isArray(cp.primary_archetypes)) {
      const archs = cp.primary_archetypes.slice(0, 5).map((a: any) => `${a.name} (${a.percentage}%)`).join(", ");
      if (archs) parts.push(`Archetypes: ${archs}`);
    }

    // Weekly themes
    const themes = cp.themes || cp.weekly_themes || [];
    if (Array.isArray(themes) && themes.length > 0) {
      const themeNames = themes.slice(0, 5).map((t: any) => {
        if (typeof t === "string") return t;
        const name = t.name || t.theme || "";
        const angles = t.angles?.slice(0, 2).join(", ") || "";
        return angles ? `${name} (${angles})` : name;
      }).filter(Boolean).join("; ");
      if (themeNames) parts.push(`Themes: ${themeNames}`);
    }

    // Today's posts from daily_plan
    const cpDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const cpTodayName = cpDayNames[new Date().getDay()];
    const todayDay = cp.daily_plan?.find((d: any) => d.day === cpTodayName);
    if (todayDay?.posts && Array.isArray(todayDay.posts)) {
      const postLines = todayDay.posts.slice(0, 5).map((p: any) =>
        `${p.archetype || "General"} (${p.funnel_stage || "TOF"}): ${(p.hook_idea || p.topic || "").slice(0, 80)}`
      ).join(" | ");
      if (postLines) parts.push(`Today (${cpTodayName}): ${postLines}`);
    }

    contentPlanSummary = parts.join("\n");
    // Cap at 500 chars
    if (contentPlanSummary.length > 500) contentPlanSummary = contentPlanSummary.slice(0, 497) + "...";
  }

  let brandingSummary = "Not generated yet";
  if (brandingPlan?.plan_data) {
    const bp = brandingPlan.plan_data as any;
    brandingSummary = `Positioning: ${bp.positioning_statement || bp.positioning || "N/A"}`;
    if (bp.tone) brandingSummary += ` | Tone: ${bp.tone}`;
  }

  let funnelSummary = "Not generated yet";
  if (funnelPlan?.plan_data) {
    const fp = funnelPlan.plan_data as any;
    const stages = fp.stages || fp.steps || [];
    if (Array.isArray(stages) && stages.length > 0) {
      funnelSummary = stages.slice(0, 4).map((s: any) => typeof s === "string" ? s : s.name || s.stage || "").filter(Boolean).join(" → ");
    } else {
      funnelSummary = "Active";
    }
  }

  const plansSection = [
    `Content Plan: ${contentPlanSummary}`,
    `Branding: ${brandingSummary}`,
    `Funnel: ${funnelSummary}`,
  ].join("\n");

  // === CONTENT QUEUE ===
  const queuedPosts = scheduledPostsRes.data || [];
  let queueSection = "";
  if (queuedPosts.length > 0) {
    const entries = queuedPosts.map((p: any) => {
      const arch = p.content_category || "General";
      const time = p.scheduled_for ? new Date(p.scheduled_for).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) : "unscheduled";
      return `- ${arch} (${p.funnel_stage || "TOF"}) ${p.status} at ${time}`;
    }).join("\n");
    queueSection = `${queuedPosts.length} posts queued:\n${entries}`;
  }

  // === LATEST CMO INSIGHT ===
  const cmoProfile = cmoProfileRes.data;
  let cmoSection = "";
  if (cmoProfile?.weekly_refresh_summary && cmoProfile?.last_weekly_refresh_at) {
    const refreshAge = (Date.now() - new Date(cmoProfile.last_weekly_refresh_at).getTime()) / (1000 * 60 * 60 * 24);
    if (refreshAge <= 7) {
      const summary = cmoProfile.weekly_refresh_summary as any;
      const parts: string[] = [];
      if (summary.headline) parts.push(summary.headline);
      if (summary.recommendation) parts.push(`Recommendation: ${summary.recommendation}`);
      if (summary.top_insight) parts.push(`Insight: ${summary.top_insight}`);
      cmoSection = parts.join("\n");
    }
  }

  // === PROFILE ===
  let voiceProfileText = "Not set";
  if (profile?.voice_profile) {
    const vp = profile.voice_profile as any;
    if (typeof vp === "string") {
      voiceProfileText = vp.substring(0, 500);
    } else {
      // Extract key voice traits from JSON object
      const traits = [vp.tone, vp.style, vp.energy, vp.personality].filter(Boolean);
      voiceProfileText = traits.length > 0 ? traits.join(", ") : "Custom";
    }
  }
  const profileSection = profile
    ? `Niche: ${profile.niche || "Not specified"}\nDream Client: ${profile.dream_client || "Not specified"}\nEnd Goal: ${profile.end_goal || "Not specified"}\nGoal Type: ${profile.goal_type || "Not set"}\nMission: ${profile.mission || "Not set"}\nRevenue Target: ${profile.revenue_target || "Not set"}\nBusiness Model: ${profile.business_model || "Not set"}\nSuccess Metric: ${profile.success_metric || "Not set"}\nFollower Count: ${profile.follower_count || "Unknown"}\nPosting Cadence: ${profile.posting_cadence || "Not set"}\nPosts Per Day: ${profile.posts_per_day || "Not set"}\nTraffic URL: ${profile.traffic_url || "Not set"}\nDM Keyword: ${profile.dm_keyword || "Not set"}\nDM Offer: ${profile.dm_offer || "Not set"}\nVoice: ${voiceProfileText}`
    : "No profile data.";

  // === SALES FUNNEL ===
  const funnelSteps = salesFunnelRes.data || [];
  let funnelSection = "No sales funnel defined yet.";
  if (funnelSteps.length > 0) {
    funnelSection = funnelSteps.map((s: any) =>
      `Step ${s.step_number} (${s.step_name}): ${s.what}${s.url ? ` at ${s.url}` : ""}${s.price ? ` — ${s.price}` : ""} → Goal: ${s.goal || "Not specified"}`
    ).join("\n");
    funnelSection += `\n\nIMPORTANT: When writing TOF posts, the goal is Step 1 (awareness). When writing MOF posts, reference lead magnets or low-ticket offers from the funnel. When writing BOF posts, drive toward paid offers. Always use the REAL offer names, prices, and URLs from the funnel.`;
  }

  // === CONTENT TEMPLATES (count only — don't send template text to avoid verbatim copying) ===
  const templates = templatesRes.data || [];
  let templatesSection = "No content templates defined.";
  if (templates.length > 0) {
    const grouped: Record<string, number> = {};
    for (const t of templates as any[]) {
      grouped[t.archetype] = (grouped[t.archetype] || 0) + 1;
    }
    templatesSection = Object.entries(grouped).map(([arch, count]) =>
      `${arch}: ${count} template${count > 1 ? "s" : ""} available`
    ).join("\n");
  }

  // === COMPETITOR INSIGHTS (one line per account — themes + top views, max 5) ===
  const competitorAccounts = competitorAccountsRes.data || [];
  const competitorPosts = competitorPostsRes.data || [];
  let competitorSection = "No competitor accounts saved.";
  if (competitorPosts.length > 0) {
    // Group posts by account, summarize themes per account
    const byAccount: Record<string, { hooks: Set<string>; emotions: Set<string>; topViews: number }> = {};
    for (const p of competitorPosts) {
      const handle = p.source_username || "unknown";
      if (!byAccount[handle]) byAccount[handle] = { hooks: new Set(), emotions: new Set(), topViews: 0 };
      const text = p.text_content || "";
      byAccount[handle].hooks.add(classifyHook(text));
      byAccount[handle].emotions.add(classifyEmotion(text));
      byAccount[handle].topViews = Math.max(byAccount[handle].topViews, p.views || 0);
    }
    competitorSection = Object.entries(byAccount).slice(0, 5).map(([handle, data]) => {
      const themes = [...data.emotions].slice(0, 3).join(", ");
      return `@${handle} — themes: ${themes} (top post: ${data.topViews} views)`;
    }).join("\n");
  } else if (competitorAccounts.length > 0) {
    competitorSection = "Studying: " + competitorAccounts.slice(0, 5).map((c: any) => `@${c.threads_username}`).join(", ");
  }

  // === CONTENT BUCKETS (compact — name + audience only) ===
  const buckets = bucketsRes.data || [];
  const bucketsSection = buckets.length > 0
    ? buckets.map((b: any) => `- ${b.name}: ${(b.audience_persona || "General audience").substring(0, 80)}`).join("\n")
    : "No content buckets defined yet.";

  // === CONTENT PILLARS + TOPICS ===
  const pillarsList = pillarsRes.data || [];
  const allTopics = topicsRes.data || [];
  // Group topics by pillar_id
  const topicsByPillar: Record<string, string[]> = {};
  for (const t of allTopics) {
    (topicsByPillar[t.pillar_id] = topicsByPillar[t.pillar_id] || []).push(t.name);
  }
  const pillarsSection = pillarsList.length > 0
    ? pillarsList.map((p: any) => {
        const topics = topicsByPillar[p.id] || [];
        const desc = (p.description || "").substring(0, 40);
        const topicStr = topics.length > 0 ? ` | ${topics.slice(0, 3).join(", ")}` : "";
        return `- ${p.name} (${p.percentage || 0}%): ${desc}${topicStr}`;
      }).join("\n")
    : "No content pillars defined yet.";

  // === TODAY'S POST + WEEK PLAN ===
  const planItems = planItemsRes.data || [];
  // Build pillar name lookup
  const pillarNameMap: Record<string, string> = {};
  for (const p of pillarsList) pillarNameMap[p.id] = p.name;
  // Build topic ID → name lookup (connected_topics now includes id)
  const topicIdMap: Record<string, string> = {};
  for (const t of allTopics) topicIdMap[t.id] = t.name;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const trafficUrl = profile?.traffic_url || "Not set";
  const dmKeyword = profile?.dm_keyword || "";
  const dmOffer = profile?.dm_offer || "";

  function funnelInstruction(stage: string): string {
    switch (stage) {
      case "TOF":
        return "This is a TOP OF FUNNEL post. Goal = maximum reach and new eyeballs. Write a viral hook, shareable observation, or contrarian take. Keep it short and punchy. Do NOT mention your offer, CTA, or link. Just make people stop scrolling.";
      case "MOF":
        return "This is a MIDDLE OF FUNNEL post. Goal = build trust and start conversations. Share a personal story, teaching moment, or vulnerable take. End with a question or conversation starter. You can mention what you do but don't hard-sell.";
      case "BOF": {
        let bof = `This is a BOTTOM OF FUNNEL post. Goal = convert followers into leads or customers. Mention your offer, include a CTA, reference your traffic URL: ${trafficUrl}. Use proof, case studies, or urgency.`;
        if (dmKeyword && dmOffer) {
          bof += ` DM trigger: tell readers to DM you the word "${dmKeyword}" to get "${dmOffer}".`;
        } else if (dmKeyword) {
          bof += ` DM trigger: tell readers to DM you the word "${dmKeyword}".`;
        }
        bof += " This post should make someone DM you or click your link.";
        return bof;
      }
      default:
        return "";
    }
  }

  let todaySection = "No content plan generated yet.";
  let restOfWeekSection = "";

  if (planItems.length > 0) {
    const today = planItems[0];
    const todayPillar = pillarNameMap[today.pillar_id] || "Unknown Pillar";
    const todayTopic = today.topic_id ? topicIdMap[today.topic_id] : null;
    const todayArchetype = today.archetype || "—";
    const todayFunnel = today.funnel_stage || "TOF";

    todaySection = `Pillar: ${todayPillar}\nArchetype: ${todayArchetype}${todayTopic ? `\nTopic: "${todayTopic}"` : ""}\nFunnel Stage: ${todayFunnel}\nWhat this means: ${funnelInstruction(todayFunnel)}`;

    if (planItems.length > 1) {
      restOfWeekSection = planItems.slice(1).map((item: any, i: number) => {
        const date = new Date(item.scheduled_date + "T12:00:00");
        const dayName = dayNames[date.getDay()];
        const dayLabel = i === 0 ? `Tomorrow (${dayName})` : `${dayName} ${item.scheduled_date}`;
        const pillarName = pillarNameMap[item.pillar_id] || "Unknown Pillar";
        const archetype = item.archetype || "—";
        const funnel = item.funnel_stage || "—";
        const test = item.is_test_slot ? " [TEST]" : "";
        return `${dayLabel}: ${pillarName} × ${archetype} (${funnel})${test}`;
      }).join("\n");
    }
  }

  const weekPlanSection = todaySection;

  let postsBlock = "=== YOUR TOP PERFORMING POSTS (study these patterns — replicate structure and emotional triggers, NOT the exact words) ===\n" + viewsSection;
  if (engagementSection) {
    postsBlock += "\n\n=== TOP PERFORMING POST PATTERNS BY ENGAGEMENT RATE ===\n" + engagementSection;
  }
  if (recentSection) {
    postsBlock += "\n\n=== RECENT POST PATTERNS (for variety reference) ===\n" + recentSection;
  }

  const result = "=== JOURNEY STAGE ===\n" +
    journeySection + "\n\n" +
    "=== USER IDENTITY ===\n" +
    identitySection + "\n\n" +
    (guardrailsSection ? guardrailsSection + "\n\n" : "") +
    (playbookGuidelinesSection ? playbookGuidelinesSection + "\n\n" : "") +
    "=== CREATOR PROFILE ===\n" +
    profileSection + "\n\n" +
    "=== STORY VAULT (REAL facts only — NEVER invent stories or numbers not listed here) ===\n" +
    "CRITICAL: These are the user's REAL stories with REAL numbers. When writing posts:\n" +
    "- ONLY reference events and numbers that appear in this vault\n" +
    "- If a post needs a story you don't have, write the post WITHOUT a specific story — use general observations instead\n" +
    "- NEVER fabricate dollar amounts, timelines, or events\n" +
    "- It is BETTER to write a post with no specific story than to invent a fake one\n\n" +
    storiesSection + "\n\n" +
    (recentHooksSection ? recentHooksSection + "\n" : "") +
    (untappedSection ? untappedSection + "\n\n" : "") +
    "=== OFFERS ===\n" +
    offersSection + "\n\n" +
    "=== TARGET AUDIENCES ===\n" +
    audiencesSection + "\n\n" +
    "=== PERSONAL INFORMATION ===\n" +
    personalSection + "\n" +
    "NOTE: Prioritize professional facts (role, company, credentials, key achievements) over lifestyle details (hobbies, locations, preferences). Only use lifestyle details when they directly support the post's point or add authentic texture — never as the main content angle.\n\n" +
    "=== VOICE & STYLE ===\n" +
    styleSection + "\n" +
    "Content Preferences:\n" +
    prefsSection + "\n\n" +
    "=== CONTENT ARCHETYPES ===\n" +
    archetypesSection + "\n\n" +
    "=== CONTENT TEMPLATES ===\n" +
    templatesSection + "\n\n" +
    "=== SALES FUNNEL ===\n" +
    funnelSection + "\n\n" +
    "=== KNOWLEDGE BASE ===\n" +
    knowledgeSection + "\n\n" +
    "=== KEY INSIGHTS FROM DATA ===\n" +
    insightsSection + "\n\n" +
    (regressionFindingsSection ? regressionFindingsSection + "\n\n" : "") +
    buildRawRegressionSection(regressionData) +
    postsBlock + "\n\n" +
    (archetypePerformanceSection ? archetypePerformanceSection + "\n\n" : "") +
    "=== COMPETITOR POST PATTERNS (learn the structure and triggers — do NOT copy their words) ===\n" +
    competitorSection + "\n\n" +
    "=== CONTENT BUCKETS (audience segments) ===\n" +
    bucketsSection + "\n\n" +
    "=== CONTENT PILLARS ===\n" +
    pillarsSection + "\n\n" +
    "=== TODAY'S POST (GENERATE THIS FIRST) ===\n" +
    weekPlanSection + "\n\n" +
    (restOfWeekSection ? "=== REST OF THIS WEEK'S PLAN (for additional posts) ===\nWhen asked to generate a single post or template, generate for TODAY'S POST first. When asked for multiple posts, generate them in order from the plan — today first, then tomorrow, etc.\n\n" + restOfWeekSection + "\n\n" : "") +
    "=== PLANS ===\n" +
    plansSection +
    (queueSection ? "\n\n=== CONTENT QUEUE ===\n" + queueSection : "") +
    (cmoSection ? "\n\n=== LATEST CMO INSIGHT ===\n" + cmoSection : "");

  // === CONTEXT SIZE DEBUG: per-section breakdown ===
  const sectionSizes: Record<string, number> = {
    journeyStage: journeySection.length,
    identity: identitySection.length,
    profile: profileSection.length,
    stories: storiesSection.length,
    recentHooks: recentHooksSection.length,
    untappedAngles: untappedSection.length,
    offers: offersSection.length,
    audiences: audiencesSection.length,
    personal: personalSection.length,
    voiceStyle: styleSection.length + prefsSection.length,
    archetypes: archetypesSection.length,
    templates: templatesSection.length,
    salesFunnel: funnelSection.length,
    knowledgeBase: knowledgeSection.length,
    regressionInsights: insightsSection.length,
    topPostsByViews: viewsSection.length,
    topPostsByEngagement: engagementSection.length,
    recentPosts: recentSection.length,
    competitors: competitorSection.length,
    contentBuckets: bucketsSection.length,
    contentPillars: pillarsSection.length,
    todayPost: weekPlanSection.length,
    restOfWeek: restOfWeekSection.length,
    plans: plansSection.length,
    contentQueue: queueSection.length,
    cmoInsight: cmoSection.length,
    guardrails: guardrailsSection.length,
    playbookGuidelines: playbookGuidelinesSection.length,
    archetypePerformance: archetypePerformanceSection.length,
    regressionFindings: regressionFindingsSection.length,
  };

  // Sort by size descending to surface biggest offenders
  const sorted = Object.entries(sectionSizes).sort((a, b) => b[1] - a[1]);
  console.log(`[getUserContext] === CONTEXT SIZE AUDIT ===`);
  console.log(`[getUserContext] TOTAL: ${result.length} chars`);
  for (const [name, size] of sorted) {
    const pct = ((size / result.length) * 100).toFixed(1);
    const flag = size > 3000 ? " ⚠️ LARGE" : size > 1500 ? " ⚡ MEDIUM" : "";
    console.log(`[getUserContext]   ${name}: ${size} chars (${pct}%)${flag}`);
  }

  // Flag specific bloat patterns
  if (plansSection.includes("{")) {
    console.log(`[getUserContext] ⚠️ PLANS section contains raw JSON — should be summarized`);
  }
  if (profileSection.includes("{")) {
    console.log(`[getUserContext] ⚠️ PROFILE section contains raw JSON (likely voice_profile) — should be summarized`);
  }
  if (knowledgeSection.length > 3000) {
    console.log(`[getUserContext] ⚠️ KNOWLEDGE BASE is ${knowledgeSection.length} chars — ${knowledge.length} items × up to 500 chars each`);
  }
  if (restOfWeekSection.length > 2000) {
    console.log(`[getUserContext] ⚠️ REST OF WEEK is ${restOfWeekSection.length} chars — ${planItems.length - 1} days with full funnel instructions`);
  }
  console.log(`[getUserContext] === END AUDIT ===`);

  return result;
}
