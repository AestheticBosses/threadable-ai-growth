import { fetchJourneyStage, getStageConfig } from "./journeyStage.ts";

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
    profileRes,
    salesFunnelRes,
    templatesRes,
    competitorAccountsRes,
    competitorPostsRes,
    bucketsRes,
    pillarsRes,
    topicsRes,
    planItemsRes,
  ] = await Promise.all([
    supabase.from("user_identity").select("about_you, desired_perception, main_goal").eq("user_id", userId).maybeSingle(),
    supabase.from("user_story_vault").select("section, data").eq("user_id", userId),
    supabase.from("user_offers").select("name, description").eq("user_id", userId),
    supabase.from("user_audiences").select("name").eq("user_id", userId),
    supabase.from("user_personal_info").select("content").eq("user_id", userId),
    supabase.from("user_writing_style").select("selected_style, custom_style_description").eq("user_id", userId).maybeSingle(),
    supabase.from("content_preferences").select("content").eq("user_id", userId).order("sort_order"),
    supabase.from("knowledge_base").select("title, type, content, summary").eq("user_id", userId).eq("processed", true).limit(50),
    // Top 10 by views (existing)
    supabase.from("posts_analyzed").select("text_content, likes, views, replies, reposts, engagement_rate, archetype, posted_at").eq("user_id", userId).eq("source", "own").not("text_content", "is", null).order("views", { ascending: false }).limit(10),
    // Top 10 by engagement rate (NEW — may surface different posts)
    supabase.from("posts_analyzed").select("text_content, views, engagement_rate, archetype").eq("user_id", userId).eq("source", "own").not("text_content", "is", null).order("engagement_rate", { ascending: false }).limit(10),
    // 30 recent posts to pick 10 random for variety
    supabase.from("posts_analyzed").select("text_content, views, engagement_rate, archetype").eq("user_id", userId).eq("source", "own").not("text_content", "is", null).order("posted_at", { ascending: false }).limit(30),
    supabase.from("user_plans").select("plan_type, plan_data").eq("user_id", userId),
    supabase.from("content_strategies").select("strategy_data").eq("user_id", userId).eq("strategy_type", "archetype_discovery").limit(1).maybeSingle(),
    supabase.from("content_strategies").select("regression_insights").eq("user_id", userId).eq("strategy_type", "weekly").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("niche, dream_client, end_goal, voice_profile, posting_cadence, traffic_url, mission, follower_count, goal_type, dm_keyword, dm_offer, posts_per_day, revenue_target, business_model, biggest_challenge, success_metric").eq("id", userId).single(),
    supabase.from("user_sales_funnel").select("step_number, step_name, what, url, price, goal").eq("user_id", userId).order("step_number"),
    supabase.from("content_templates").select("archetype, template_text").eq("user_id", userId).order("archetype").order("sort_order"),
    // Competitor accounts the user is studying
    supabase.from("competitor_accounts").select("threads_username").eq("user_id", userId),
    // Top competitor posts by engagement for pattern learning
    supabase.from("posts_analyzed").select("text_content, views, likes, replies, reposts, engagement_rate, source_username").eq("user_id", userId).eq("source", "competitor").not("text_content", "is", null).order("engagement_rate", { ascending: false }).limit(25),
    // Content strategy v2
    supabase.from("content_buckets").select("name, description, audience_persona, priority").eq("user_id", userId).eq("is_active", true).order("priority"),
    supabase.from("content_pillars").select("id, name, description, purpose, percentage, bucket_id").eq("user_id", userId).eq("is_active", true),
    supabase.from("connected_topics").select("id, pillar_id, name").eq("user_id", userId).eq("is_active", true),
    supabase.from("content_plan_items").select("scheduled_date, archetype, funnel_stage, pillar_id, topic_id, is_test_slot, status").eq("user_id", userId).gte("scheduled_date", new Date().toISOString().split("T")[0]).order("scheduled_date").limit(14),
  ]);

  // === JOURNEY STAGE ===
  const journeyStage = await fetchJourneyStage(supabase, userId);
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
  if (stories.length > 0) {
    const storyLines: string[] = [];
    for (const s of stories) {
      const items = Array.isArray(s.data) ? s.data : (s.data?.items || []);
      for (const item of items as any[]) {
        const title = item.title || item.name || "Untitled";
        const lesson = item.lesson || item.key_lesson || "";
        const storyText = item.story || item.content || "";
        // For "numbers" section entries, show label + value + context
        if (item.label && item.value) {
          storyLines.push(`- Number: ${item.label} = ${item.value}${item.context ? ` (${item.context})` : ""}`);
        } else {
          // Send first 300 chars of story text as factual reference
          const factSnippet = storyText.length > 300 ? storyText.substring(0, 300) + "…" : storyText;
          const parts = [`- Story: ${title}`];
          if (factSnippet) parts.push(`  Facts: ${factSnippet}`);
          if (lesson) parts.push(`  Lesson: ${lesson}`);
          storyLines.push(parts.join("\n"));
        }
      }
    }
    storiesSection = storyLines.join("\n");
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

  // === KNOWLEDGE BASE ===
  const knowledge = knowledgeRes.data || [];
  const knowledgeSection = knowledge.length > 0
    ? knowledge.map((k: any) => {
        const content = k.summary || k.content || "";
        return `- [${k.type}] ${k.title}: ${content.slice(0, 500)}`;
      }).join("\n")
    : "No knowledge base items.";

  // === TOP POSTS BY VIEWS (patterns only — not full text) ===
  const topByViews = topPostsByViewsRes.data || [];
  const viewsSection = topByViews.length > 0
    ? topByViews.map((p: any, i: number) => {
        const text = p.text_content || "";
        const firstWords = text.split(/\s+/).slice(0, 10).join(" ");
        const hook = classifyHook(text);
        const emotion = classifyEmotion(text);
        return `${i + 1}. Hook: ${hook} | Trigger: ${emotion} | Archetype: ${p.archetype || "unknown"} | ${p.views || 0} views, ER: ${p.engagement_rate ? (p.engagement_rate * 100).toFixed(1) + "%" : "N/A"} | Length: ${text.length} chars | Opens with: "${firstWords}…"`;
      }).join("\n")
    : "No posts analyzed yet.";

  // === TOP POSTS BY ENGAGEMENT RATE (patterns only) ===
  const topByEngagement = topPostsByEngagementRes.data || [];
  const engagementSection = topByEngagement.length > 0
    ? topByEngagement.map((p: any, i: number) => {
        const text = p.text_content || "";
        const firstWords = text.split(/\s+/).slice(0, 10).join(" ");
        const hook = classifyHook(text);
        const emotion = classifyEmotion(text);
        return `${i + 1}. Hook: ${hook} | Trigger: ${emotion} | Archetype: ${p.archetype || "unknown"} | ER: ${p.engagement_rate ? (p.engagement_rate * 100).toFixed(1) + "%" : "N/A"}, ${p.views || 0} views | Length: ${text.length} chars | Opens with: "${firstWords}…"`;
      }).join("\n")
    : "";

  // === RECENT POSTS (random 10 from last 30, patterns only) ===
  const recentPosts = recentPostsRes.data || [];
  const randomRecent = recentPosts
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);
  const recentSection = randomRecent.length > 0
    ? randomRecent.map((p: any, i: number) => {
        const text = p.text_content || "";
        const firstWords = text.split(/\s+/).slice(0, 10).join(" ");
        const hook = classifyHook(text);
        return `${i + 1}. Hook: ${hook} | Archetype: ${p.archetype || "unknown"} | Opens with: "${firstWords}…"`;
      }).join("\n")
    : "";

  // === REGRESSION INSIGHTS ===
  const regressionData = regressionRes.data?.regression_insights as any;
  let insightsSection = "No regression data available yet.";
  if (regressionData?.human_readable_insights && Array.isArray(regressionData.human_readable_insights)) {
    insightsSection = regressionData.human_readable_insights.map((i: string) => `- ${i}`).join("\n");
  }

  // === PLANS ===
  const plans = plansRes.data || [];
  const contentPlan = plans.find((p: any) => p.plan_type === "content_plan");
  const brandingPlan = plans.find((p: any) => p.plan_type === "branding_plan");
  const funnelPlan = plans.find((p: any) => p.plan_type === "funnel_strategy");
  const plansSection = [
    contentPlan ? `Content Plan: ${JSON.stringify(contentPlan.plan_data).slice(0, 500)}` : "Content Plan: Not generated yet",
    brandingPlan ? `Branding Plan: Positioning: ${(brandingPlan.plan_data as any)?.positioning_statement || "N/A"}` : "Branding Plan: Not generated yet",
    funnelPlan ? `Funnel Strategy: ${JSON.stringify(funnelPlan.plan_data).slice(0, 500)}` : "Funnel Strategy: Not generated yet",
  ].join("\n");

  // === PROFILE ===
  const profile = profileRes.data;
  const profileSection = profile
    ? `Niche: ${profile.niche || "Not specified"}\nDream Client: ${profile.dream_client || "Not specified"}\nEnd Goal: ${profile.end_goal || "Not specified"}\nGoal Type: ${profile.goal_type || "Not set"}\nMission: ${profile.mission || "Not set"}\nRevenue Target: ${profile.revenue_target || "Not set"}\nBusiness Model: ${profile.business_model || "Not set"}\nBiggest Challenge: ${profile.biggest_challenge || "Not set"}\nSuccess Metric: ${profile.success_metric || "Not set"}\nFollower Count: ${profile.follower_count || "Unknown"}\nPosting Cadence: ${profile.posting_cadence || "Not set"}\nPosts Per Day: ${profile.posts_per_day || "Not set"}\nTraffic URL (for BOF/CTA posts): ${profile.traffic_url || "Not set"}\nDM Keyword: ${profile.dm_keyword || "Not set"}\nDM Offer: ${profile.dm_offer || "Not set"}\nVoice Profile: ${profile.voice_profile ? JSON.stringify(profile.voice_profile) : "Not set"}`
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

  // === COMPETITOR INSIGHTS (patterns only — do NOT copy their content) ===
  const competitorAccounts = competitorAccountsRes.data || [];
  const competitorPosts = competitorPostsRes.data || [];
  let competitorSection = "No competitor accounts saved.";
  if (competitorAccounts.length > 0 || competitorPosts.length > 0) {
    const parts: string[] = [];
    if (competitorAccounts.length > 0) {
      parts.push("Accounts being studied: " + competitorAccounts.map((c: any) => `@${c.threads_username}`).join(", "));
    }
    if (competitorPosts.length > 0) {
      parts.push("Top competitor post patterns (learn the structure and triggers — apply to user's own stories):");
      competitorPosts.forEach((p: any, i: number) => {
        const text = p.text_content || "";
        const firstWords = text.split(/\s+/).slice(0, 10).join(" ");
        const hook = classifyHook(text);
        const emotion = classifyEmotion(text);
        parts.push(`${i + 1}. [@${p.source_username || "unknown"}] Hook: ${hook} | Trigger: ${emotion} | ${p.views || 0} views, ER: ${p.engagement_rate ? (p.engagement_rate * 100).toFixed(1) + "%" : "N/A"} | Length: ${text.length} chars | Opens with: "${firstWords}…"`);
      });
    }
    competitorSection = parts.join("\n");
  }

  // === CONTENT BUCKETS ===
  const buckets = bucketsRes.data || [];
  const bucketsSection = buckets.length > 0
    ? buckets.map((b: any, i: number) =>
        `${i + 1}. ${b.name} (Priority: ${b.priority}): ${b.description || ""}\n   Persona: ${b.audience_persona || "Not defined"}`
      ).join("\n")
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
    ? pillarsList.map((p: any, i: number) => {
        const topics = topicsByPillar[p.id] || [];
        return `${i + 1}. ${p.name} (${p.purpose || "general"}) — ${p.percentage || 0}% of content\n   ${p.description || ""}\n   Topics: ${topics.length > 0 ? topics.join(", ") : "None yet"}`;
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
        const topicName = item.topic_id ? topicIdMap[item.topic_id] : null;
        const archetype = item.archetype || "—";
        const funnel = item.funnel_stage || "—";
        const test = item.is_test_slot ? " [TEST]" : "";
        const topicPart = topicName ? ` — "${topicName}"` : "";
        return `${dayLabel}: ${pillarName} × ${archetype}${topicPart} (${funnel})${test}\n  → ${funnelInstruction(funnel)}`;
      }).join("\n");
    }
  }

  const weekPlanSection = todaySection;

  let postsBlock = "=== TOP PERFORMING POST PATTERNS BY VIEWS (do NOT copy these posts — learn the patterns) ===\n" + viewsSection;
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
    "=== CREATOR PROFILE ===\n" +
    profileSection + "\n\n" +
    "=== STORY VAULT (REAL facts only — NEVER invent stories or numbers not listed here) ===\n" +
    "CRITICAL: These are the user's REAL stories with REAL numbers. When writing posts:\n" +
    "- ONLY reference events and numbers that appear in this vault\n" +
    "- If a post needs a story you don't have, write the post WITHOUT a specific story — use general observations instead\n" +
    "- NEVER fabricate dollar amounts, timelines, or events\n" +
    "- It is BETTER to write a post with no specific story than to invent a fake one\n\n" +
    storiesSection + "\n\n" +
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
    postsBlock + "\n\n" +
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
    plansSection;

  // Debug: log context size to help diagnose content quality issues
  console.log(`[getUserContext] Total context: ${result.length} chars | Sections: identity=${identitySection.length}, stories=${storiesSection.length}, posts=${viewsSection.length}, competitors=${competitorSection.length}, pillars=${pillarsSection.length}, plan=${weekPlanSection.length}`);

  return result;
}
