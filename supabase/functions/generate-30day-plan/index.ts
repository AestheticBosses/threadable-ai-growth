import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;
    console.log("[generate-30day-plan] Auth OK, userId:", userId);

    // Fetch content_plan from user_plans — this is the single source of truth
    const { data: contentPlanRow } = await adminClient
      .from("user_plans")
      .select("plan_data")
      .eq("user_id", userId)
      .eq("plan_type", "content_plan")
      .maybeSingle();

    const contentPlan = contentPlanRow?.plan_data as any;
    if (!contentPlan?.daily_plan || !Array.isArray(contentPlan.daily_plan)) {
      return new Response(JSON.stringify({ error: "No content plan found. Generate your content plan first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a day-of-week → posts lookup from the content_plan
    // content_plan.daily_plan = [{ day: "Monday", posts: [{ archetype, funnel_stage, topic, hook_idea }] }, ...]
    const dayPostsMap: Record<string, any[]> = {};
    for (const day of contentPlan.daily_plan) {
      dayPostsMap[day.day] = (day.posts || []).map((p: any) => ({
        archetype: p.archetype || "General",
        funnel_stage: p.funnel_stage || "TOF",
        topic: p.topic || "",
      }));
    }

    const postsPerDay = contentPlan.posts_per_day || 1;
    console.log("[generate-30day-plan] Mapping content_plan to 30 days, postsPerDay:", postsPerDay);

    // Generate 30 calendar days starting from tomorrow
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);

    const planItems: any[] = [];
    let globalSlot = 0;

    for (let d = 0; d < 30; d++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + d);
      const dayName = DAY_NAMES[date.getDay()];
      const dateStr = date.toISOString().split("T")[0];
      const week = Math.floor(d / 7) + 1;
      const dayInWeek = (d % 7) + 1;

      // Get the posts for this day-of-week from the content plan
      const dayPosts = dayPostsMap[dayName] || [];

      // If the content plan has posts for this day, map them directly
      // If not (shouldn't happen for a 7-day plan), create empty slots
      const slotsForDay = dayPosts.length > 0 ? dayPosts : Array(postsPerDay).fill({ archetype: "General", funnel_stage: "TOF", topic: "" });

      for (let s = 0; s < slotsForDay.length; s++) {
        const slot = slotsForDay[s];
        planItems.push({
          user_id: userId,
          plan_week: week,
          plan_day: dayInWeek,
          scheduled_date: dateStr,
          archetype: slot.archetype,
          funnel_stage: slot.funnel_stage,
          status: "planned",
          // topic stored in archetype field note: topic_id and pillar_id are left null
          // since the content_plan topics are free-text, not FK references
          pillar_id: null,
          topic_id: null,
        });
        globalSlot++;
      }
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

    console.log(`[generate-30day-plan] Mapped ${planItems.length} slots across 30 days (${postsPerDay}/day)`);

    // Return summary grouped by date for the UI
    const summary = planItems.map((p) => ({
      week: p.plan_week,
      day: p.plan_day,
      date: p.scheduled_date,
      archetype: p.archetype,
      funnel_stage: p.funnel_stage,
    }));

    const funnelCounts = { TOF: 0, MOF: 0, BOF: 0 };
    for (const p of planItems) {
      if (p.funnel_stage in funnelCounts) funnelCounts[p.funnel_stage as keyof typeof funnelCounts]++;
    }

    return new Response(JSON.stringify({
      data: summary,
      total_posts: planItems.length,
      posts_per_day: postsPerDay,
      days: 30,
      funnel_split: funnelCounts,
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
