import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePostsAnalyzed } from "@/hooks/usePostsAnalyzed";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  ArrowRight,
  BarChart3,
  Users,
  Zap,
  Sparkles,
  Plus,
  X,
  Download,
} from "lucide-react";

interface RealAnalysis {
  avgEngagement: string;
  bestDay: string;
  bestHour: number;
  postsAnalyzed: number;
  topContentTypes: { type: string; avgEngagement: string }[];
  topInsights: string[];
}

function deriveAnalysis(posts: ReturnType<typeof usePostsAnalyzed>["data"]): RealAnalysis | null {
  if (!posts || posts.length === 0) return null;

  const totalEng = posts.reduce((s, p) => s + (p.engagement_rate ?? 0), 0);
  const avgEngagement = (totalEng / posts.length).toFixed(1);

  // Best day
  const dayMap: Record<string, { views: number; count: number }> = {};
  posts.forEach((p) => {
    const d = p.day_of_week ?? "Unknown";
    if (!dayMap[d]) dayMap[d] = { views: 0, count: 0 };
    dayMap[d].views += p.views ?? 0;
    dayMap[d].count += 1;
  });
  const bestDay = Object.entries(dayMap).sort((a, b) => b[1].views / b[1].count - a[1].views / a[1].count)[0]?.[0] ?? "N/A";

  // Best hour
  const hourMap: Record<number, { views: number; count: number }> = {};
  posts.forEach((p) => {
    if (p.hour_posted == null) return;
    if (!hourMap[p.hour_posted]) hourMap[p.hour_posted] = { views: 0, count: 0 };
    hourMap[p.hour_posted].views += p.views ?? 0;
    hourMap[p.hour_posted].count += 1;
  });
  const bestHour = Number(Object.entries(hourMap).sort((a, b) => b[1].views / b[1].count - a[1].views / a[1].count)[0]?.[0] ?? 9);

  // Top content types
  const catMap: Record<string, { eng: number; count: number }> = {};
  posts.forEach((p) => {
    const c = p.content_category ?? "Uncategorized";
    if (!catMap[c]) catMap[c] = { eng: 0, count: 0 };
    catMap[c].eng += (p.engagement_rate ?? 0);
    catMap[c].count += 1;
  });
  const topContentTypes = Object.entries(catMap)
    .map(([type, v]) => ({ type, avgEngagement: (v.eng / v.count).toFixed(1) }))
    .sort((a, b) => parseFloat(b.avgEngagement) - parseFloat(a.avgEngagement))
    .slice(0, 4);

  // Key insights derived from actual data
  const topInsights: string[] = [];
  const withQuestion = posts.filter((p) => p.has_question);
  const withoutQuestion = posts.filter((p) => !p.has_question);
  if (withQuestion.length >= 3 && withoutQuestion.length >= 3) {
    const qAvg = withQuestion.reduce((s, p) => s + (p.views ?? 0), 0) / withQuestion.length;
    const nqAvg = withoutQuestion.reduce((s, p) => s + (p.views ?? 0), 0) / withoutQuestion.length;
    if (qAvg > nqAvg * 1.2) {
      topInsights.push(`Posts with questions get ${Math.round((qAvg / nqAvg - 1) * 100)}% more views`);
    }
  }

  const withCred = posts.filter((p) => p.has_credibility_marker);
  const withoutCred = posts.filter((p) => !p.has_credibility_marker);
  if (withCred.length >= 3 && withoutCred.length >= 3) {
    const cAvg = withCred.reduce((s, p) => s + (p.views ?? 0), 0) / withCred.length;
    const ncAvg = withoutCred.reduce((s, p) => s + (p.views ?? 0), 0) / withoutCred.length;
    if (cAvg > ncAvg * 1.2) {
      topInsights.push(`Credibility markers boost views by ${Math.round((cAvg / ncAvg - 1) * 100)}%`);
    }
  }

  const shortPosts = posts.filter((p) => (p.word_count ?? 999) < 50);
  const longPosts = posts.filter((p) => (p.word_count ?? 0) >= 50);
  if (shortPosts.length >= 3 && longPosts.length >= 3) {
    const sAvg = shortPosts.reduce((s, p) => s + (p.views ?? 0), 0) / shortPosts.length;
    const lAvg = longPosts.reduce((s, p) => s + (p.views ?? 0), 0) / longPosts.length;
    if (sAvg > lAvg * 1.1) {
      topInsights.push("Your short-form posts (<50 words) outperform longer ones");
    } else if (lAvg > sAvg * 1.1) {
      topInsights.push("Your longer posts (50+ words) outperform shorter ones");
    }
  }

  if (topInsights.length === 0) {
    topInsights.push(`Your top post received ${posts[0]?.views?.toLocaleString() ?? 0} views`);
  }

  return {
    avgEngagement,
    bestDay,
    bestHour,
    postsAnalyzed: posts.length,
    topContentTypes,
    topInsights,
  };
}

const Analyze = () => {
  usePageTitle("Analyze", "Analyze performance and discover patterns");
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [isEstablished, setIsEstablished] = useState<boolean | null>(null);
  const [niche, setNiche] = useState("");
  const [dreamClient, setDreamClient] = useState("");
  const [loading, setLoading] = useState(true);
  const [additionalUsernames, setAdditionalUsernames] = useState("");
  const [building, setBuilding] = useState(false);

  // AI-suggested accounts
  const [suggestedAccounts, setSuggestedAccounts] = useState<{ username: string; why: string; patterns: string[] }[]>([]);
  const [savedUsernames, setSavedUsernames] = useState<Set<string>>(new Set());
  const [suggesting, setSuggesting] = useState(false);
  const [fetchingPosts, setFetchingPosts] = useState(false);

  const { data: posts, isLoading: postsLoading } = usePostsAnalyzed();
  const analysis = useMemo(() => deriveAnalysis(posts ?? null), [posts]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      // Load profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_established, niche, dream_client")
        .eq("id", user.id)
        .single();
      setIsEstablished(profile?.is_established ?? false);
      setNiche(profile?.niche ?? "");
      setDreamClient(profile?.dream_client ?? "");

      // Load saved competitor accounts
      const { data: competitors } = await supabase
        .from("competitor_accounts")
        .select("threads_username")
        .eq("user_id", user.id);
      if (competitors) {
        setSavedUsernames(new Set(competitors.map((c: any) => c.threads_username).filter(Boolean)));
      }

      // Load AI-suggested accounts from niche_discovery
      const { data: nicheDiscovery } = await (supabase as any)
        .from("content_strategies")
        .select("strategy_data")
        .eq("user_id", user.id)
        .eq("strategy_type", "niche_discovery")
        .maybeSingle();
      if (nicheDiscovery?.strategy_data?.accounts) {
        const accounts = nicheDiscovery.strategy_data.accounts
          .filter((a: any) => {
            const u = (a.username || "").replace(/^@/, "").trim();
            return u && !u.includes(" "); // Only real usernames, not descriptions
          })
          .map((a: any) => ({
            username: (a.username || "").replace(/^@/, "").trim(),
            why: a.why || "",
            patterns: a.patterns || [],
          }));
        setSuggestedAccounts(accounts);
      }

      setLoading(false);
    };
    load();
  }, [user]);

  const handleSuggestAccounts = async () => {
    if (!user) return;
    setSuggesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");
      const { data, error } = await supabase.functions.invoke("discover-niche-accounts", {
        body: { niche, dream_client: dreamClient },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      const accounts = (data?.data?.accounts || [])
        .filter((a: any) => {
          const u = (a.username || "").replace(/^@/, "").trim();
          return u && !u.includes(" ");
        })
        .map((a: any) => ({
          username: (a.username || "").replace(/^@/, "").trim(),
          why: a.why || "",
          patterns: a.patterns || [],
        }));
      setSuggestedAccounts(accounts);

      // Reload saved accounts since discover-niche-accounts auto-saves to competitor_accounts
      const { data: competitors } = await supabase
        .from("competitor_accounts")
        .select("threads_username")
        .eq("user_id", user.id);
      if (competitors) {
        setSavedUsernames(new Set(competitors.map((c: any) => c.threads_username).filter(Boolean)));
      }

      toast({ title: "Accounts suggested!", description: `Found ${accounts.length} accounts to study.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to suggest accounts", variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };

  const handleToggleAccount = async (username: string) => {
    if (!user) return;
    if (savedUsernames.has(username)) {
      // Remove
      await supabase
        .from("competitor_accounts")
        .delete()
        .eq("user_id", user.id)
        .eq("threads_username", username);
      setSavedUsernames((prev) => { const next = new Set(prev); next.delete(username); return next; });
    } else {
      // Add
      await supabase
        .from("competitor_accounts")
        .upsert({ user_id: user.id, threads_username: username }, { onConflict: "user_id,threads_username" });
      setSavedUsernames((prev) => new Set(prev).add(username));
    }
  };

  const handleFetchCompetitorPosts = async () => {
    if (!user || savedUsernames.size === 0) return;
    setFetchingPosts(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");
      const usernames = Array.from(savedUsernames).slice(0, 5);
      const { data, error } = await supabase.functions.invoke("fetch-competitor-posts", {
        body: { usernames },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      toast({ title: "Posts fetched!", description: `Pulled ${data?.total_posts || 0} posts from ${usernames.length} accounts.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to fetch posts", variant: "destructive" });
    } finally {
      setFetchingPosts(false);
    }
  };

  const handleBuildStrategy = async () => {
    if (!user) return;
    setBuilding(true);
    try {
      const extras = additionalUsernames
        .split("\n")
        .map((u) => u.trim().replace(/^@/, ""))
        .filter(Boolean);

      if (extras.length) {
        const rows = extras.map((u) => ({
          user_id: user.id,
          threads_username: u,
        }));
        await supabase.from("competitor_accounts").upsert(rows, {
          onConflict: "user_id,threads_username",
          ignoreDuplicates: true,
        });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("niche, dream_client, end_goal")
        .eq("id", user.id)
        .maybeSingle();

      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(
        ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
      );

      await supabase.from("content_strategies").insert([{
        user_id: user.id,
        week_number: weekNumber,
        year: now.getFullYear(),
        status: "active",
        regression_insights: JSON.parse(JSON.stringify({
          own_analysis: analysis || null,
          niche: profile?.niche ?? null,
          dream_client: profile?.dream_client ?? null,
          end_goal: profile?.end_goal ?? null,
        })),
      }]);

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

  const hasPosts = (posts?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isEstablished ? "Let's Analyze What's Working For You" : "Let's Find Your Content Playbook"}
          </h1>
          <p className="text-muted-foreground text-lg">
            {isEstablished
              ? "We'll study your posts to find your winning patterns, then find accounts to level up your strategy."
              : "Add accounts in your niche to learn from, and we'll build your starting strategy."}
          </p>
        </div>

        {/* Performance Analysis — only for established users with posts */}
        {isEstablished && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Your Performance Analysis
              </CardTitle>
              <CardDescription>Patterns discovered from your Threads posts</CardDescription>
            </CardHeader>
            <CardContent>
              {postsLoading ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 rounded-lg" />
                    ))}
                  </div>
                  <Skeleton className="h-32 rounded-lg" />
                </div>
              ) : !hasPosts ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">No Threads posts found yet.</p>
                  <p className="text-xs text-muted-foreground">
                    Connect your Threads account and sync your posts from Settings to see your performance analysis.
                  </p>
                </div>
              ) : analysis ? (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{analysis.avgEngagement}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Avg Engagement Rate</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{analysis.bestDay}</p>
                      <p className="text-xs text-muted-foreground mt-1">Best Day to Post</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{analysis.bestHour}:00</p>
                      <p className="text-xs text-muted-foreground mt-1">Best Hour to Post</p>
                    </div>
                  </div>

                  {analysis.topContentTypes.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Top Content Types</p>
                      <div className="space-y-2">
                        {analysis.topContentTypes.map((ct) => (
                          <div key={ct.type} className="flex items-center justify-between rounded-lg border border-border p-3">
                            <span className="text-sm text-foreground">{ct.type}</span>
                            <Badge variant="secondary" className="font-mono">{ct.avgEngagement}% eng</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Key Insights</p>
                    <div className="space-y-2">
                      {analysis.topInsights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-3">
                          <Zap className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                          <p className="text-sm text-foreground">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Based on {analysis.postsAnalyzed} posts analyzed
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {isEstablished && <Separator />}

        {/* Accounts to Learn From */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Accounts to Learn From
            </CardTitle>
            <CardDescription>
              Study top creators in your {niche || "niche"} — we'll analyze their patterns for your strategy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* AI-Suggested Accounts */}
            {suggestedAccounts.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">AI-Suggested Accounts</p>
                  <Button variant="ghost" size="sm" onClick={handleSuggestAccounts} disabled={suggesting} className="text-xs gap-1">
                    {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Refresh
                  </Button>
                </div>
                <div className="space-y-2">
                  {suggestedAccounts.map((account) => {
                    const isSaved = savedUsernames.has(account.username);
                    return (
                      <div key={account.username} className={`rounded-lg border p-3 space-y-1.5 transition-colors ${isSaved ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">@{account.username}</span>
                          <Button
                            variant={isSaved ? "outline" : "secondary"}
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleToggleAccount(account.username)}
                          >
                            {isSaved ? <><X className="h-3 w-3" /> Remove</> : <><Plus className="h-3 w-3" /> Add</>}
                          </Button>
                        </div>
                        {account.why && (
                          <p className="text-xs text-muted-foreground">{account.why}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
                <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Get AI-Suggested Accounts</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    We'll find top creators in your niche worth studying.
                  </p>
                </div>
                <Button onClick={handleSuggestAccounts} disabled={suggesting} className="gap-2">
                  {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {suggesting ? "Finding accounts..." : "Suggest Accounts"}
                </Button>
              </div>
            )}

            {/* Saved accounts summary + Fetch button */}
            {savedUsernames.size > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {savedUsernames.size} account{savedUsernames.size !== 1 ? "s" : ""} saved
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchCompetitorPosts}
                    disabled={fetchingPosts}
                    className="text-xs gap-1.5"
                  >
                    {fetchingPosts ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    {fetchingPosts ? "Fetching..." : "Fetch Their Posts"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fetch their posts so the AI can study their hook patterns and content structures for your strategy.
                </p>
              </div>
            )}

            <Separator />

            {/* Manual input */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Add accounts manually</p>
              <Textarea
                value={additionalUsernames}
                onChange={(e) => setAdditionalUsernames(e.target.value)}
                placeholder={"Enter usernames, one per line\ne.g. @creator_name"}
                rows={3}
                className="resize-none font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Button
          size="lg"
          onClick={handleBuildStrategy}
          disabled={building || (isEstablished && postsLoading)}
          className="gap-2 w-full sm:w-auto"
        >
          {building ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isEstablished ? "Building Strategy..." : "Analyzing & Building..."}
            </>
          ) : (
            <>
              {isEstablished ? "Build My Strategy" : "Analyze & Build Strategy"}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Analyze;
