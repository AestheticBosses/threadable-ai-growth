import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchJourneyStage, getStageConfig } from "../_shared/journeyStage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CADENCE_MAP: Record<string, { total: number; daysPerWeek: number }> = {
  "7x_week": { total: 30, daysPerWeek: 7 },
  "5x_week": { total: 22, daysPerWeek: 5 },
  "3x_week": { total: 13, daysPerWeek: 3 },
  "2x_week": { total: 9, daysPerWeek: 2 },
};

// Weekday indices for cadences that skip days
const WEEKDAY_SCHEDULES: Record<string, number[]> = {
  "7x_week": [0, 1, 2, 3, 4, 5, 6], // Sun-Sat
  "5x_week": [1, 2, 3, 4, 5],         // Mon-Fri
  "3x_week": [1, 3, 5],               // Mon, Wed, Fri
  "2x_week": [2, 5],                  // Tue, Fri
};

function getPostingDates(cadence: string, startDate: Date, totalPosts: number): Date[] {
  const allowedDays = WEEKDAY_SCHEDULES[cadence] || WEEKDAY_SCHEDULES["7x_week"];
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (dates.length < totalPosts) {
    if (allowedDays.includes(current.getDay())) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function weightedRoundRobin<T extends { weight: number }>(items: T[], count: number): T[] {
  if (items.length === 0) return [];

  // Normalize weights to get slot counts
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight === 0) {
    // Equal distribution if no weights
    const result: T[] = [];
    for (let i = 0; i < count; i++) {
      result.push(items[i % items.length]);
    }
    return result;
  }

  // Calculate slots per item
  const slots = items.map((item) => ({
    item,
    target: Math.max(1, Math.round((item.weight / totalWeight) * count)),
    assigned: 0,
  }));

  // Adjust to match exact count
  let totalSlots = slots.reduce((sum, s) => sum + s.target, 0);
  while (totalSlots > count) {
    // Remove from highest over-target
    const maxSlot = slots.reduce((a, b) => a.target > b.target ? a : b);
    maxSlot.target--;
    totalSlots--;
  }
  while (totalSlots < count) {
    // Add to lowest under-target
    const minSlot = slots.reduce((a, b) => a.target < b.target ? a : b);
    minSlot.target++;
    totalSlots++;
  }

  // Interleave: distribute evenly across the timeline
  const result: T[] = [];
  while (result.length < count) {
    let added = false;
    for (const slot of slots) {
      if (slot.assigned < slot.target) {
        result.push(slot.item);
        slot.assigned++;
        added = true;
        if (result.length >= count) break;
      }
    }
    if (!added) break;
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch all data in parallel
    const [
      { data: profile },
      { data: pillars },
      { data: topics },
      { data: archetypeStrategy },
    ] = await Promise.all([
      adminClient
        .from("profiles")
        .select("posting_cadence, end_goal, journey_stage, posts_per_day")
        .eq("id", userId)
        .single(),
      adminClient
        .from("content_pillars")
        .select("id, name, percentage, purpose")
        .eq("user_id", userId)
        .eq("is_active", true),
      adminClient
        .from("connected_topics")
        .select("id, pillar_id, name, hook_angle, used_count")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("used_count", { ascending: true }),
      adminClient
        .from("content_strategies")
        .select("strategy_data")
        .eq("user_id", userId)
        .eq("strategy_type", "archetype_discovery")
        .maybeSingle(),
    ]);

    if (!pillars || pillars.length === 0) {
      return new Response(JSON.stringify({ error: "No content pillars found. Generate pillars first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postsPerDay = profile?.posts_per_day || null;
    const cadence = profile?.posting_cadence || "7x_week";
    const cadenceConfig = CADENCE_MAP[cadence] || CADENCE_MAP["7x_week"];

    // Use posts_per_day if set (new onboarding), otherwise fall back to cadence map
    const totalPosts = postsPerDay ? postsPerDay * 30 : cadenceConfig.total;
    const effectiveDaysPerWeek = postsPerDay ? 7 : cadenceConfig.daysPerWeek;

    // Build posting dates starting from tomorrow
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);
    // When using posts_per_day, post every day; otherwise use cadence schedule
    const postingDates = postsPerDay
      ? getPostingDates("7x_week", startDate, totalPosts)
      : getPostingDates(cadence, startDate, totalPosts);

    // Distribute posts across pillars by percentage
    const pillarSchedule = weightedRoundRobin(
      pillars.map((p: any) => ({ ...p, weight: p.percentage || Math.round(100 / pillars.length) })),
      totalPosts
    );

    // Group topics by pillar_id for round-robin assignment
    const topicsByPillar: Record<string, any[]> = {};
    for (const t of (topics || [])) {
      (topicsByPillar[t.pillar_id] = topicsByPillar[t.pillar_id] || []).push(t);
    }
    // Track topic index per pillar for rotation
    const topicIndex: Record<string, number> = {};

    // Build archetype rotation
    const archetypeData = archetypeStrategy?.strategy_data as any;
    const archetypes = archetypeData?.archetypes || [];
    let archetypeSchedule: string[];
    if (archetypes.length > 0) {
      // Use archetype weights if available, otherwise equal
      archetypeSchedule = weightedRoundRobin(
        archetypes.map((a: any) => ({
          name: a.name,
          weight: a.percentage || Math.round(100 / archetypes.length),
        })),
        totalPosts
      ).map((a: any) => a.name);
    } else {
      archetypeSchedule = new Array(totalPosts).fill("General");
    }

    // Funnel stage distribution based on journey stage
    const stageConfig = getStageConfig(profile?.journey_stage);
    const funnelDistribution = weightedRoundRobin(
      [
        { stage: "TOF", weight: stageConfig.funnelMix.tof },
        { stage: "MOF", weight: stageConfig.funnelMix.mof },
        { stage: "BOF", weight: stageConfig.funnelMix.bof },
      ],
      totalPosts
    ).map((f: any) => f.stage);

    // Determine test slots (20% of posts, spread evenly)
    const testSlotCount = Math.max(1, Math.round(totalPosts * 0.2));
    const testSlotInterval = Math.floor(totalPosts / testSlotCount);
    const testSlotIndices = new Set<number>();
    for (let i = 0; i < testSlotCount; i++) {
      testSlotIndices.add(Math.min(i * testSlotInterval + (testSlotInterval - 1), totalPosts - 1));
    }

    // Build plan items
    const planItems: any[] = [];
    for (let i = 0; i < totalPosts; i++) {
      const pillar = pillarSchedule[i];
      const date = postingDates[i];
      const week = Math.floor(i / effectiveDaysPerWeek) + 1;
      const dayInWeek = (i % effectiveDaysPerWeek) + 1;

      // Pick topic from this pillar (round-robin, least-used first since topics are pre-sorted)
      const pillarTopics = topicsByPillar[pillar.id] || [];
      let topic = null;
      if (pillarTopics.length > 0) {
        const idx = (topicIndex[pillar.id] || 0) % pillarTopics.length;
        topic = pillarTopics[idx];
        topicIndex[pillar.id] = idx + 1;
      }

      const isTest = testSlotIndices.has(i);

      planItems.push({
        user_id: userId,
        plan_week: week,
        plan_day: dayInWeek,
        scheduled_date: date.toISOString().split("T")[0],
        pillar_id: pillar.id,
        topic_id: topic?.id || null,
        archetype: archetypeSchedule[i],
        funnel_stage: funnelDistribution[i],
        is_test_slot: isTest,
        status: "planned",
      });
    }

    // Clear existing plan and insert new one
    await adminClient.from("content_plan_items").delete().eq("user_id", userId);

    const { error: insertError } = await adminClient
      .from("content_plan_items")
      .insert(planItems);

    if (insertError) {
      console.error("Insert content_plan_items failed:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save plan" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generated 30-day plan: ${planItems.length} posts for user: ${userId} (${postsPerDay ? `${postsPerDay}/day` : `cadence: ${cadence}`})`);

    // Return summary with readable plan
    const summary = planItems.map((p) => ({
      week: p.plan_week,
      day: p.plan_day,
      date: p.scheduled_date,
      pillar: pillarSchedule[planItems.indexOf(p)]?.name,
      topic: (topics || []).find((t: any) => t.id === p.topic_id)?.name || null,
      archetype: p.archetype,
      funnel_stage: p.funnel_stage,
      is_test: p.is_test_slot,
    }));

    return new Response(JSON.stringify({
      data: summary,
      total_posts: planItems.length,
      cadence,
      weeks: Math.ceil(planItems.length / effectiveDaysPerWeek),
      funnel_split: {
        TOF: funnelDistribution.filter((f) => f === "TOF").length,
        MOF: funnelDistribution.filter((f) => f === "MOF").length,
        BOF: funnelDistribution.filter((f) => f === "BOF").length,
      },
      test_slots: testSlotCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-30day-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
