import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowRight, TrendingUp, Clock, MessageSquare, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type PostAnalyzed = {
  id: string;
  text_content: string | null;
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  engagement_rate: number | null;
  virality_score: number | null;
  hour_posted: number | null;
  day_of_week: string | null;
  has_credibility_marker: boolean | null;
  has_question: boolean | null;
  word_count: number | null;
};

const DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const Analyze = () => {
  usePageTitle("Analyze", "Analyze your Threads performance and discover patterns");
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [isEstablished, setIsEstablished] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Path A state
  const [competitorUsernames, setCompetitorUsernames] = useState("");
  const [fetchingCompetitors, setFetchingCompetitors] = useState(false);
  const [competitorResults, setCompetitorResults] = useState<any>(null);

  // Path B state
  const [fetchingOwn, setFetchingOwn] = useState(false);
  const [ownPostsFetched, setOwnPostsFetched] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [progressValue, setProgressValue] = useState(0);
  const [topPosts, setTopPosts] = useState<PostAnalyzed[]>([]);
  const [dayData, setDayData] = useState<{ day: string; avgViews: number }[]>([]);
  const [hourData, setHourData] = useState<{ hour: string; avgViews: number }[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  // Check if user is established
  useEffect(() => {
    const checkProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("is_established")
        .eq("id", user.id)
        .single();
      setIsEstablished(data?.is_established ?? false);
      setLoading(false);
    };
    checkProfile();
  }, [user]);

  // Path B: auto-trigger fetch on load
  const fetchOwnPosts = useCallback(async () => {
    if (!session?.access_token) return;
    setFetchingOwn(true);
    setProgressMessage("Pulling your posts...");
    setProgressValue(20);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-user-posts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setProgressMessage("Analyzing engagement...");
      setProgressValue(60);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch posts");
      }

      setProgressMessage("Running regression analysis...");
      setProgressValue(80);

      // Now load posts from DB
      const { data: posts } = await supabase
        .from("posts_analyzed")
        .select("*")
        .eq("user_id", user!.id)
        .eq("source", "own")
        .order("engagement_rate", { ascending: false });

      if (posts && posts.length > 0) {
        setTopPosts(posts.slice(0, 10));
        computeCharts(posts);
        computeInsights(posts);
      }

      setProgressValue(100);
      setProgressMessage("Analysis complete!");
      setOwnPostsFetched(true);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setFetchingOwn(false);
    }
  }, [session, user]);

  useEffect(() => {
    if (isEstablished === true && !ownPostsFetched && !fetchingOwn) {
      fetchOwnPosts();
    }
  }, [isEstablished, ownPostsFetched, fetchingOwn, fetchOwnPosts]);

  const computeCharts = (posts: PostAnalyzed[]) => {
    // Day of week
    const dayMap: Record<string, { total: number; count: number }> = {};
    const hourMap: Record<number, { total: number; count: number }> = {};

    for (const p of posts) {
      if (p.day_of_week && p.views != null) {
        if (!dayMap[p.day_of_week]) dayMap[p.day_of_week] = { total: 0, count: 0 };
        dayMap[p.day_of_week].total += p.views;
        dayMap[p.day_of_week].count++;
      }
      if (p.hour_posted != null && p.views != null) {
        if (!hourMap[p.hour_posted]) hourMap[p.hour_posted] = { total: 0, count: 0 };
        hourMap[p.hour_posted].total += p.views;
        hourMap[p.hour_posted].count++;
      }
    }

    setDayData(
      DAYS_ORDER.filter((d) => dayMap[d]).map((d) => ({
        day: d.slice(0, 3),
        avgViews: Math.round(dayMap[d].total / dayMap[d].count),
      }))
    );

    const hours = Object.keys(hourMap).map(Number).sort((a, b) => a - b);
    setHourData(
      hours.map((h) => ({
        hour: `${h}:00`,
        avgViews: Math.round(hourMap[h].total / hourMap[h].count),
      }))
    );
  };

  const computeInsights = (posts: PostAnalyzed[]) => {
    const results: string[] = [];
    const avgViews = posts.reduce((s, p) => s + (p.views || 0), 0) / posts.length;

    const withCred = posts.filter((p) => p.has_credibility_marker);
    const withoutCred = posts.filter((p) => !p.has_credibility_marker);
    if (withCred.length > 2 && withoutCred.length > 2) {
      const avgCred = withCred.reduce((s, p) => s + (p.views || 0), 0) / withCred.length;
      const avgNoCred = withoutCred.reduce((s, p) => s + (p.views || 0), 0) / withoutCred.length;
      if (avgCred > avgNoCred) {
        const pct = Math.round(((avgCred - avgNoCred) / avgNoCred) * 100);
        results.push(`Posts with credibility markers get ${pct}% more views`);
      }
    }

    const withQ = posts.filter((p) => p.has_question);
    const withoutQ = posts.filter((p) => !p.has_question);
    if (withQ.length > 2 && withoutQ.length > 2) {
      const avgQ = withQ.reduce((s, p) => s + (p.replies || 0), 0) / withQ.length;
      const avgNoQ = withoutQ.reduce((s, p) => s + (p.replies || 0), 0) / withoutQ.length;
      if (avgQ > avgNoQ) {
        const pct = Math.round(((avgQ - avgNoQ) / avgNoQ) * 100);
        results.push(`Questions get ${pct}% more replies`);
      }
    }

    // Best day and hour
    const dayMap: Record<string, number[]> = {};
    for (const p of posts) {
      if (p.day_of_week && p.views != null) {
        if (!dayMap[p.day_of_week]) dayMap[p.day_of_week] = [];
        dayMap[p.day_of_week].push(p.views);
      }
    }
    const bestDay = Object.entries(dayMap)
      .map(([d, v]) => ({ day: d, avg: v.reduce((a, b) => a + b, 0) / v.length }))
      .sort((a, b) => b.avg - a.avg)[0];

    const hourMap: Record<number, number[]> = {};
    for (const p of posts) {
      if (p.hour_posted != null && p.views != null) {
        if (!hourMap[p.hour_posted]) hourMap[p.hour_posted] = [];
        hourMap[p.hour_posted].push(p.views);
      }
    }
    const bestHour = Object.entries(hourMap)
      .map(([h, v]) => ({ hour: Number(h), avg: v.reduce((a, b) => a + b, 0) / v.length }))
      .sort((a, b) => b.avg - a.avg)[0];

    if (bestDay && bestHour) {
      results.push(`Your best day is ${bestDay.day} at ${bestHour.hour}:00`);
    }

    setInsights(results);
  };

  // Path A: fetch competitor posts
  const handleFetchCompetitors = async () => {
    if (!session?.access_token) return;
    const usernames = competitorUsernames
      .split("\n")
      .map((u) => u.trim().replace(/^@/, ""))
      .filter(Boolean)
      .slice(0, 5);

    if (!usernames.length) {
      toast({ title: "Enter at least one username", variant: "destructive" });
      return;
    }

    setFetchingCompetitors(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-competitor-posts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ usernames }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch competitor posts");
      }

      const data = await res.json();
      setCompetitorResults(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setFetchingCompetitors(false);
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
      <div className="mx-auto max-w-4xl px-6 py-12">
        {isEstablished ? <PathB /> : <PathA />}
      </div>
    </div>
  );

  function PathA() {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Let's Find Your Content Playbook
          </h1>
          <p className="text-muted-foreground text-lg">
            Since you're just getting started, we'll analyze what's working for top accounts in your niche.
          </p>
        </div>

        {!competitorResults ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Enter Threads usernames to analyze</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  value={competitorUsernames}
                  onChange={(e) => setCompetitorUsernames(e.target.value)}
                  placeholder={"@username1\n@username2\n@username3"}
                  rows={5}
                  className="text-base resize-none font-mono"
                  disabled={fetchingCompetitors}
                />
                <p className="text-sm text-muted-foreground">
                  One username per line, up to 5 accounts.
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleFetchCompetitors}
                disabled={fetchingCompetitors || !competitorUsernames.trim()}
                className="gap-2"
              >
                {fetchingCompetitors ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Analyze These Accounts"
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Content Patterns Found
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {competitorResults.patterns?.length > 0 ? (
                  competitorResults.patterns.map((p: string, i: number) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">
                      {p}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">No strong patterns detected yet.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-primary" />
                    Best Posting Times
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{competitorResults.best_day}</p>
                  <p className="text-muted-foreground text-sm">
                    Best hour: {competitorResults.best_hour}:00
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Avg Post Length
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{competitorResults.avg_word_count} words</p>
                  <p className="text-muted-foreground text-sm">
                    Across {competitorResults.total_posts} posts analyzed
                  </p>
                </CardContent>
              </Card>
            </div>

            {competitorResults.top_openers?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Common Hooks & Openers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {competitorResults.top_openers.map((opener: string, i: number) => (
                      <div key={i} className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground font-mono">
                        "{opener}..."
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button size="lg" onClick={() => navigate("/strategy")} className="gap-2">
              Build My Strategy
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  function PathB() {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Analyzing Your Threads Performance
          </h1>
          {!ownPostsFetched && (
            <p className="text-muted-foreground text-lg">
              Sit tight — we're crunching your data.
            </p>
          )}
        </div>

        {!ownPostsFetched ? (
          <Card>
            <CardContent className="py-8 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-foreground font-medium">{progressMessage}</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Key Insights */}
            {insights.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                {insights.map((insight, i) => (
                  <Card key={i}>
                    <CardContent className="py-5">
                      <div className="flex items-start gap-3">
                        <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <p className="text-sm font-medium text-foreground">{insight}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              {dayData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Avg Views by Day of Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dayData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="day" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        <Bar dataKey="avgViews" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {hourData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Avg Views by Hour Posted</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={hourData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="hour" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        <Bar dataKey="avgViews" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Top 10 Posts */}
            {topPosts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top 10 Posts by Engagement Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topPosts.map((post, i) => (
                      <div
                        key={post.id}
                        className="flex items-start gap-4 rounded-lg border border-border p-4"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm text-foreground line-clamp-2">
                            {post.text_content || "No text"}
                          </p>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>{post.views?.toLocaleString()} views</span>
                            <span>{post.likes} likes</span>
                            <span>{post.replies} replies</span>
                            <span className="font-medium text-primary">
                              {post.engagement_rate?.toFixed(1)}% eng
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button size="lg" onClick={() => navigate("/strategy")} className="gap-2">
              Build My Strategy
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }
};

export default Analyze;
