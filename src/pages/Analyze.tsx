import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  ArrowRight,
  TrendingUp,
  Clock,
  MessageSquare,
  BarChart3,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

// Mock suggested accounts by niche keyword
function getSuggestedAccounts(niche: string): { username: string; reason: string }[] {
  const lower = niche.toLowerCase();
  if (lower.includes("fitness") || lower.includes("gym") || lower.includes("health")) {
    return [
      { username: "fitfounder", reason: "Fitness brand building expert" },
      { username: "strengthcoach_pro", reason: "Strength coaching content creator" },
      { username: "wellnesswithjay", reason: "Wellness & health niche leader" },
    ];
  }
  if (lower.includes("market") || lower.includes("agency") || lower.includes("brand")) {
    return [
      { username: "marketingmax", reason: "Growth marketing strategist" },
      { username: "brandbuilder_co", reason: "Brand strategy content creator" },
      { username: "adspend_guru", reason: "Performance marketing expert" },
    ];
  }
  if (lower.includes("tech") || lower.includes("saas") || lower.includes("dev") || lower.includes("ai")) {
    return [
      { username: "buildinpublic_dev", reason: "Build-in-public SaaS founder" },
      { username: "techstartupguy", reason: "Startup growth content creator" },
      { username: "ai_insights_daily", reason: "AI & tech thought leader" },
    ];
  }
  if (lower.includes("real estate") || lower.includes("property")) {
    return [
      { username: "realestate_mogul", reason: "Real estate investing content" },
      { username: "propertypro_tips", reason: "Property management expert" },
      { username: "homeselling_ace", reason: "Residential real estate leader" },
    ];
  }
  return [
    { username: "growthmindset_daily", reason: "Personal growth content creator" },
    { username: "nicheleader_pro", reason: "Authority building strategist" },
    { username: "contentking_threads", reason: "Threads growth specialist" },
  ];
}

function generateMockOwnAnalysis() {
  return {
    bestDay: "Tuesday",
    bestHour: 9,
    avgEngagement: (2.5 + Math.random() * 4).toFixed(1),
    topContentTypes: [
      { type: "Personal stories", avgEngagement: (4 + Math.random() * 3).toFixed(1) },
      { type: "Actionable tips", avgEngagement: (3 + Math.random() * 3).toFixed(1) },
      { type: "Hot takes", avgEngagement: (2.5 + Math.random() * 3).toFixed(1) },
    ],
    postsAnalyzed: 25 + Math.floor(Math.random() * 20),
    topInsights: [
      "Posts with credibility markers get 180% more views",
      "Questions drive 3x more replies than statements",
      "Your best posts are under 50 words",
    ],
  };
}

function generateMockStrategy(niche: string) {
  const lower = niche.toLowerCase();
  const patterns = lower.includes("fitness")
    ? [
        "Transformation stories get 340% more engagement",
        "Workout routine questions get 2x more replies",
        "Posts with specific numbers outperform by 180%",
      ]
    : lower.includes("market")
    ? [
        "Revenue/growth numbers get 280% more engagement",
        "Contrarian takes outperform agreeable content by 3x",
        "Numbered list posts get 2.5x more saves",
      ]
    : [
        "Personal stories get 220% more engagement",
        "Questions drive 3x more replies",
        "Credibility markers boost views by 180%",
      ];

  return {
    patterns,
    best_day: "Tuesday",
    best_hour: 9,
    avg_word_count: 35 + Math.floor(Math.random() * 25),
    total_posts: 30 + Math.floor(Math.random() * 20),
    top_openers: [
      "Stop doing this if you want to grow",
      "I spent 6 months testing this",
      "Most people don't realize that",
    ],
  };
}

const Analyze = () => {
  usePageTitle("Analyze", "Analyze performance and discover patterns");
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [isEstablished, setIsEstablished] = useState<boolean | null>(null);
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(true);

  // Established path state
  const [ownAnalysis, setOwnAnalysis] = useState<ReturnType<typeof generateMockOwnAnalysis> | null>(null);
  const [analyzingOwn, setAnalyzingOwn] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");

  // Shared state
  const [additionalUsernames, setAdditionalUsernames] = useState("");
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("is_established, niche")
        .eq("id", user.id)
        .single();
      setIsEstablished(data?.is_established ?? false);
      setNiche(data?.niche ?? "");
      setLoading(false);
    };
    load();
  }, [user]);

  // Auto-trigger own analysis for established users
  const runOwnAnalysis = useCallback(async () => {
    setAnalyzingOwn(true);
    setProgressMsg("Pulling your posts from Threads...");
    setProgressValue(20);
    await new Promise((r) => setTimeout(r, 800));
    setProgressMsg("Analyzing engagement patterns...");
    setProgressValue(50);
    await new Promise((r) => setTimeout(r, 800));
    setProgressMsg("Running regression analysis...");
    setProgressValue(80);
    await new Promise((r) => setTimeout(r, 600));
    setProgressValue(100);
    setProgressMsg("Analysis complete!");
    setOwnAnalysis(generateMockOwnAnalysis());
    setAnalyzingOwn(false);
  }, []);

  useEffect(() => {
    if (isEstablished === true && !ownAnalysis && !analyzingOwn) {
      runOwnAnalysis();
    }
  }, [isEstablished, ownAnalysis, analyzingOwn, runOwnAnalysis]);

  const suggestedAccounts = getSuggestedAccounts(niche);

  const handleBuildStrategy = async () => {
    if (!user) return;
    setBuilding(true);
    try {
      // Parse additional usernames
      const extras = additionalUsernames
        .split("\n")
        .map((u) => u.trim().replace(/^@/, ""))
        .filter(Boolean);

      const allUsernames = [
        ...suggestedAccounts.map((a) => a.username),
        ...extras,
      ];

      // Save competitor accounts
      const rows = allUsernames.map((u) => ({
        user_id: user.id,
        threads_username: u,
      }));
      if (rows.length) {
        await supabase.from("competitor_accounts").upsert(rows, {
          onConflict: "user_id,threads_username",
          ignoreDuplicates: true,
        });
      }

      // Get profile info
      const { data: profile } = await supabase
        .from("profiles")
        .select("niche, dream_client, end_goal")
        .eq("id", user.id)
        .maybeSingle();

      const mockData = generateMockStrategy(profile?.niche || "");
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(
        ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
      );

      await supabase.from("content_strategies").insert({
        user_id: user.id,
        week_number: weekNumber,
        year: now.getFullYear(),
        status: "active",
        regression_insights: {
          competitor_analysis: mockData,
          own_analysis: ownAnalysis || null,
          niche: profile?.niche,
          dream_client: profile?.dream_client,
          end_goal: profile?.end_goal,
        },
      });

      await refreshProfile();
      toast({ title: "Strategy created!", description: "Your content strategy is ready." });
      navigate("/strategy");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBuilding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
        {isEstablished ? <EstablishedPath /> : <NewAccountPath />}
      </div>
    </div>
  );

  function EstablishedPath() {
    return (
      <>
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Let's Analyze What's Working For You
          </h1>
          <p className="text-muted-foreground text-lg">
            We'll study your posts to find your winning patterns, then find accounts to level up your strategy.
          </p>
        </div>

        {/* Section 1: Own Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Your Performance Analysis
            </CardTitle>
            <CardDescription>Patterns discovered from your Threads posts</CardDescription>
          </CardHeader>
          <CardContent>
            {!ownAnalysis ? (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-medium text-foreground">{progressMsg}</span>
                </div>
                <Progress value={progressValue} className="h-2" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{ownAnalysis.avgEngagement}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Avg Engagement Rate</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{ownAnalysis.bestDay}</p>
                    <p className="text-xs text-muted-foreground mt-1">Best Day to Post</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{ownAnalysis.bestHour}:00</p>
                    <p className="text-xs text-muted-foreground mt-1">Best Hour to Post</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Top Content Types</p>
                  <div className="space-y-2">
                    {ownAnalysis.topContentTypes.map((ct) => (
                      <div key={ct.type} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <span className="text-sm text-foreground">{ct.type}</span>
                        <Badge variant="secondary" className="font-mono">{ct.avgEngagement}% eng</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Key Insights</p>
                  <div className="space-y-2">
                    {ownAnalysis.topInsights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-3">
                        <Zap className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <p className="text-sm text-foreground">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Based on {ownAnalysis.postsAnalyzed} posts analyzed
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Section 2: Suggested Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Suggested Accounts to Emulate
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI-suggested based on your niche
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestedAccounts.map((acct) => (
              <div key={acct.username} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">@{acct.username}</p>
                  <p className="text-xs text-muted-foreground">{acct.reason}</p>
                </div>
                <Badge variant="outline" className="text-xs">Suggested</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Section 3: Additional accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add accounts you admire</CardTitle>
            <CardDescription>Optional — add more accounts to strengthen your strategy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={additionalUsernames}
              onChange={(e) => setAdditionalUsernames(e.target.value)}
              placeholder="Enter usernames, one per line"
              rows={3}
              className="resize-none font-mono text-sm"
            />
          </CardContent>
        </Card>

        {/* CTA */}
        <Button
          size="lg"
          onClick={handleBuildStrategy}
          disabled={building || !ownAnalysis}
          className="gap-2 w-full sm:w-auto"
        >
          {building ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Building Strategy...
            </>
          ) : (
            <>
              Build My Strategy
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </>
    );
  }

  function NewAccountPath() {
    return (
      <>
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Let's Find Your Content Playbook
          </h1>
          <p className="text-muted-foreground text-lg">
            We'll analyze top accounts in your space to build your starting strategy.
          </p>
        </div>

        {/* Section 1: Suggested Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Suggested Accounts in Your Niche
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI-suggested based on your niche
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestedAccounts.map((acct) => (
              <div key={acct.username} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">@{acct.username}</p>
                  <p className="text-xs text-muted-foreground">{acct.reason}</p>
                </div>
                <Badge variant="outline" className="text-xs">Suggested</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Section 2: Additional accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add other accounts you want to emulate</CardTitle>
            <CardDescription>Optional — enter usernames of creators you admire</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={additionalUsernames}
              onChange={(e) => setAdditionalUsernames(e.target.value)}
              placeholder="Enter usernames, one per line"
              rows={3}
              className="resize-none font-mono text-sm"
            />
          </CardContent>
        </Card>

        {/* CTA */}
        <Button
          size="lg"
          onClick={handleBuildStrategy}
          disabled={building}
          className="gap-2 w-full sm:w-auto"
        >
          {building ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing & Building...
            </>
          ) : (
            <>
              Analyze & Build Strategy
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </>
    );
  }
};

export default Analyze;
