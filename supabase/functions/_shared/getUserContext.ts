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
    supabase.from("profiles").select("niche, dream_client, end_goal, voice_profile").eq("id", userId).single(),
    supabase.from("user_sales_funnel").select("step_number, step_name, what, url, price, goal").eq("user_id", userId).order("step_number"),
    supabase.from("content_templates").select("archetype, template_text").eq("user_id", userId).order("archetype").order("sort_order"),
    // Competitor accounts the user is studying
    supabase.from("competitor_accounts").select("threads_username").eq("user_id", userId),
    // Top competitor posts by engagement for pattern learning
    supabase.from("posts_analyzed").select("text_content, views, likes, replies, reposts, engagement_rate, source_username").eq("user_id", userId).eq("source", "competitor").not("text_content", "is", null).order("engagement_rate", { ascending: false }).limit(25),
  ]);

  // === IDENTITY ===
  const identity = identityRes.data;
  const identitySection = identity?.about_you
    ? `About: ${identity.about_you}\nDesired Perception: ${identity.desired_perception || "Not set"}\nMain Goal: ${identity.main_goal || "Not set"}`
    : "No identity data provided yet.";

  // === STORIES (titles + lessons only — keeps AI from retelling stories verbatim) ===
  const stories = storiesRes.data || [];
  const storiesSection = stories.length > 0
    ? stories.map((s: any) => {
        const items = Array.isArray(s.data) ? s.data : (s.data?.items || []);
        return items.map((item: any) => {
          const title = item.title || item.name || "Untitled";
          const lesson = item.lesson || item.key_lesson || "";
          return lesson ? `- Story: ${title} — Lesson: ${lesson}` : `- Story: ${title}`;
        }).join("\n");
      }).filter(Boolean).join("\n")
    : "No stories added yet.";

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
    archetypesSection = archetypeData.archetypes.map((a: any) =>
      `- ${a.emoji || ""} ${a.name}: ${a.description || ""} (${a.recommended_percentage || 0}% of content, drives: ${a.drives || "N/A"})\n  Key ingredients: ${(a.key_ingredients || []).join(", ")}\n  Template: ${a.template || "N/A"}`
    ).join("\n\n");
  }

  // === KNOWLEDGE BASE ===
  const knowledge = knowledgeRes.data || [];
  const knowledgeSection = knowledge.length > 0
    ? knowledge.map((k: any) => {
        const content = k.summary || k.content || "";
        return `- [${k.type}] ${k.title}: ${content.slice(0, 500)}`;
      }).join("\n")
    : "No knowledge base items.";

  // === TOP POSTS BY VIEWS ===
  const topByViews = topPostsByViewsRes.data || [];
  const viewsSection = topByViews.length > 0
    ? topByViews.map((p: any, i: number) =>
        `${i + 1}. [${p.archetype || "unknown"}] "${(p.text_content || "").slice(0, 200)}" — ${p.views || 0} views, ${p.likes || 0} likes, ${p.replies || 0} replies, ${p.reposts || 0} reposts, ER: ${p.engagement_rate ? (p.engagement_rate * 100).toFixed(1) + "%" : "N/A"}`
      ).join("\n")
    : "No posts analyzed yet.";

  // === TOP POSTS BY ENGAGEMENT RATE ===
  const topByEngagement = topPostsByEngagementRes.data || [];
  const engagementSection = topByEngagement.length > 0
    ? topByEngagement.map((p: any, i: number) =>
        `${i + 1}. [${p.archetype || "unknown"}] "${(p.text_content || "").slice(0, 200)}" — ER: ${p.engagement_rate ? (p.engagement_rate * 100).toFixed(1) + "%" : "N/A"}, ${p.views || 0} views`
      ).join("\n")
    : "";

  // === RECENT POSTS (random 10 from last 30 for variety) ===
  const recentPosts = recentPostsRes.data || [];
  const randomRecent = recentPosts
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);
  const recentSection = randomRecent.length > 0
    ? randomRecent.map((p: any, i: number) =>
        `${i + 1}. [${p.archetype || "unknown"}] "${(p.text_content || "").slice(0, 200)}"`
      ).join("\n")
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
    ? `Niche: ${profile.niche || "Not specified"}\nDream Client: ${profile.dream_client || "Not specified"}\nEnd Goal: ${profile.end_goal || "Not specified"}`
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

  // === CONTENT TEMPLATES ===
  const templates = templatesRes.data || [];
  let templatesSection = "No content templates defined.";
  if (templates.length > 0) {
    const grouped: Record<string, string[]> = {};
    for (const t of templates as any[]) {
      (grouped[t.archetype] = grouped[t.archetype] || []).push(t.template_text);
    }
    templatesSection = Object.entries(grouped).map(([arch, texts]) =>
      arch + ":\n" + texts.map((t, i) => "  Template " + (i + 1) + ": \"" + t.slice(0, 200) + "\"").join("\n")
    ).join("\n");
    templatesSection += "\n\nUse these templates as structural guides when drafting posts — fill in the brackets with real user data, don't copy verbatim.";
  }

  // === COMPETITOR INSIGHTS ===
  const competitorAccounts = competitorAccountsRes.data || [];
  const competitorPosts = competitorPostsRes.data || [];
  let competitorSection = "No competitor accounts saved.";
  if (competitorAccounts.length > 0 || competitorPosts.length > 0) {
    const parts: string[] = [];
    if (competitorAccounts.length > 0) {
      parts.push("Accounts being studied: " + competitorAccounts.map((c: any) => `@${c.threads_username}`).join(", "));
    }
    if (competitorPosts.length > 0) {
      parts.push("Top competitor posts (study their patterns, hooks, and structures — then apply to user's own stories and data):");
      competitorPosts.forEach((p: any, i: number) => {
        parts.push(`${i + 1}. [@${p.source_username || "unknown"}] "${(p.text_content || "").slice(0, 250)}" — ${p.views || 0} views, ER: ${p.engagement_rate ? (p.engagement_rate * 100).toFixed(1) + "%" : "N/A"}`);
      });
    }
    competitorSection = parts.join("\n");
  }

  let postsBlock = "=== TOP PERFORMING POSTS BY VIEWS ===\n" + viewsSection;
  if (engagementSection) {
    postsBlock += "\n\n=== TOP PERFORMING POSTS BY ENGAGEMENT RATE ===\n" + engagementSection;
  }
  if (recentSection) {
    postsBlock += "\n\n=== RECENT POSTS (for variety reference) ===\n" + recentSection;
  }

  return "=== USER IDENTITY ===\n" +
    identitySection + "\n\n" +
    "=== CREATOR PROFILE ===\n" +
    profileSection + "\n\n" +
    "=== STORIES ===\n" +
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
    "=== COMPETITOR INSIGHTS (learn from their patterns, not their content) ===\n" +
    competitorSection + "\n\n" +
    "=== PLANS ===\n" +
    plansSection;
}
