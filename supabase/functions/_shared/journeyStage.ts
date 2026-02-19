/**
 * Journey stage definitions and helpers.
 * Used by generate-strategy, generate-playbook, generate-30day-plan, generate-plans, and getUserContext.
 */

export type JourneyStage = "getting_started" | "growing" | "monetizing";

export interface JourneyStageConfig {
  label: string;
  funnelMix: { tof: number; mof: number; bof: number };
  contentFocus: string;
  promptBlock: string;
}

const STAGE_CONFIGS: Record<JourneyStage, JourneyStageConfig> = {
  getting_started: {
    label: "Getting Started (under 1K followers)",
    funnelMix: { tof: 70, mof: 20, bof: 10 },
    contentFocus: "Reach and audience growth",
    promptBlock: `The user is JUST GETTING STARTED (under 1K followers). Optimize their strategy for REACH and AUDIENCE GROWTH.
- Funnel mix: 70% TOF (reach/awareness), 20% MOF (trust/engagement), 10% BOF (conversion)
- Prioritize: viral hooks, shareable observations, contrarian takes, broad-appeal content
- Avoid: heavy selling, complex CTAs, offer posts
- Post style: short, punchy, screenshot-worthy`,
  },
  growing: {
    label: "Growing & Engaging",
    funnelMix: { tof: 30, mof: 50, bof: 20 },
    contentFocus: "Engagement and trust",
    promptBlock: `The user is GROWING AND ENGAGING (has an audience, needs conversations). Optimize their strategy for ENGAGEMENT and TRUST.
- Funnel mix: 30% TOF (reach), 50% MOF (trust/value), 20% BOF (conversion)
- Prioritize: vulnerability, personal stories, teaching moments, conversation starters
- Include: DM-friendly CTAs, questions, 'what do you think?' endings
- Post style: medium length, personal, trust-building`,
  },
  monetizing: {
    label: "Ready to Monetize",
    funnelMix: { tof: 20, mof: 30, bof: 50 },
    contentFocus: "Conversions and sales",
    promptBlock: `The user is READY TO MONETIZE (has engagement, wants sales). Optimize their strategy for CONVERSIONS.
- Funnel mix: 20% TOF (reach), 30% MOF (trust), 50% BOF (conversion)
- Prioritize: case studies, proof/results, offer mentions, urgency, social proof
- Include: direct CTAs, link-in-bio mentions, DM triggers for offers
- Post style: authority-driven, proof-heavy, clear next steps`,
  },
};

const DEFAULT_STAGE: JourneyStage = "getting_started";

export function getStageConfig(stage: string | null | undefined): JourneyStageConfig {
  if (stage && stage in STAGE_CONFIGS) {
    return STAGE_CONFIGS[stage as JourneyStage];
  }
  return STAGE_CONFIGS[DEFAULT_STAGE];
}

/**
 * Read journey_stage and goal_type from the profiles table for a given user.
 */
export async function fetchJourneyStage(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("journey_stage, goal_type")
    .eq("id", userId)
    .single();
  return data?.journey_stage || DEFAULT_STAGE;
}

/**
 * Fetch the user's goal_type from profiles.
 */
export async function fetchGoalType(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("goal_type")
    .eq("id", userId)
    .single();
  return data?.goal_type || null;
}
