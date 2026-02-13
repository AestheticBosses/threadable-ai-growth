import { useRef } from "react";
import { usePostsAnalyzed } from "@/hooks/usePostsAnalyzed";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BadgeData {
  displayName: string;
  username: string;
  profilePic: string | null;
  totalViews: number;
  totalLikes: number;
  totalReplies: number;
  totalPosts: number;
  followerCount: number;
  followerGrowth: number;
  streak: number;
  topPost: { text: string; views: number } | null;
}

function useBadgeData(): BadgeData | null {
  const { data: posts } = usePostsAnalyzed();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile-badge", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("threads_username, display_name, threads_profile_picture_url, follower_count")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: snapshots } = useQuery({
    queryKey: ["follower-snapshots-badge", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("follower_snapshots")
        .select("follower_count, recorded_at")
        .eq("user_id", user!.id)
        .order("recorded_at", { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: publishedPosts } = useQuery({
    queryKey: ["published-posts-streak", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("scheduled_posts")
        .select("published_at")
        .eq("user_id", user!.id)
        .eq("status", "published")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  if (!posts || posts.length === 0 || !profile) return null;

  const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalReplies = posts.reduce((s, p) => s + (p.replies ?? 0), 0);
  const topPost = posts.reduce((best, p) => ((p.views ?? 0) > (best.views ?? 0) ? p : best), posts[0]);

  // Calculate streak
  let streak = 0;
  if (publishedPosts && publishedPosts.length > 0) {
    const days = new Set(
      publishedPosts.map((p) => new Date(p.published_at!).toISOString().slice(0, 10))
    );
    const sortedDays = [...days].sort().reverse();
    const today = new Date().toISOString().slice(0, 10);
    if (sortedDays[0] === today || sortedDays[0] === new Date(Date.now() - 86400000).toISOString().slice(0, 10)) {
      streak = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        const prev = new Date(sortedDays[i - 1]);
        const curr = new Date(sortedDays[i]);
        const diff = (prev.getTime() - curr.getTime()) / 86400000;
        if (diff === 1) streak++;
        else break;
      }
    }
  }

  const followerGrowth = snapshots && snapshots.length >= 2
    ? (snapshots[snapshots.length - 1].follower_count - snapshots[0].follower_count)
    : 0;

  return {
    displayName: profile.display_name || profile.threads_username || "Creator",
    username: profile.threads_username ? `@${profile.threads_username}` : "",
    profilePic: profile.threads_profile_picture_url,
    totalViews,
    totalLikes,
    totalReplies,
    totalPosts: posts.length,
    followerCount: profile.follower_count ?? 0,
    followerGrowth,
    streak,
    topPost: topPost ? { text: topPost.text_content ?? "", views: topPost.views ?? 0 } : null,
  };
}

function ProfileAvatar({ src, name }: { src: string | null; name: string }) {
  return (
    <div className="flex justify-center">
      {src ? (
        <img src={src} alt={name} className="h-16 w-16 rounded-full border-2 border-white/20 object-cover" />
      ) : (
        <div className="h-16 w-16 rounded-full border-2 border-white/20 bg-white/10 flex items-center justify-center text-xl font-bold text-white">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  background: "linear-gradient(160deg, hsl(240, 15%, 16%), hsl(260, 20%, 12%))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  color: "white",
  width: "100%",
  maxWidth: "400px",
};

function ScreenshotButton({ targetRef }: { targetRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
      onClick={() => {
        targetRef.current?.scrollIntoView({ behavior: "smooth" });
        toast.info("Take a screenshot to share on Threads!");
      }}
    >
      <Camera className="h-3 w-3" /> Screenshot to share
    </Button>
  );
}

function DailyRecapBadge({ data }: { data: BadgeData }) {
  const ref = useRef<HTMLDivElement>(null);
  const dateLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} style={badgeStyle} className="p-6 text-center space-y-4">
        <ProfileAvatar src={data.profilePic} name={data.displayName} />
        <div>
          <p className="text-sm font-bold">{data.displayName}</p>
          <p className="text-xs text-white/50">{data.username}</p>
        </div>
        <p className="text-xs text-white/40">{dateLabel}</p>
        <div>
          <p className="text-3xl font-bold">{data.totalViews.toLocaleString()}</p>
          <p className="text-xs text-white/50 uppercase tracking-wider">Views</p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-sm font-bold">+{data.followerGrowth}</p>
            <p className="text-[9px] text-white/40">new followers</p>
          </div>
          <div>
            <p className="text-sm font-bold">{data.totalPosts}</p>
            <p className="text-[9px] text-white/40">posts</p>
          </div>
          <div>
            <p className="text-sm font-bold">{data.totalLikes.toLocaleString()}</p>
            <p className="text-[9px] text-white/40">likes</p>
          </div>
          <div>
            <p className="text-sm font-bold">{data.totalReplies.toLocaleString()}</p>
            <p className="text-[9px] text-white/40">replies</p>
          </div>
        </div>
        <p className="text-[10px] text-white/25">Threadable.ai — AI Threads growth</p>
      </div>
      <ScreenshotButton targetRef={ref} />
    </div>
  );
}

function StreakBadge({ data }: { data: BadgeData }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} style={badgeStyle} className="p-6 text-center space-y-4">
        <ProfileAvatar src={data.profilePic} name={data.displayName} />
        <div>
          <p className="text-sm font-bold">{data.displayName}</p>
          <p className="text-xs text-white/50">{data.username}</p>
        </div>
        <div>
          <p className="text-3xl font-bold">🔥 {data.streak} day{data.streak !== 1 ? "s" : ""}</p>
          <p className="text-xs text-white/50">posting streak on Threads</p>
        </div>
        <p className="text-[10px] text-white/25">Threadable.ai</p>
      </div>
      <ScreenshotButton targetRef={ref} />
    </div>
  );
}

function TopPostBadge({ data }: { data: BadgeData }) {
  const ref = useRef<HTMLDivElement>(null);
  if (!data.topPost) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} style={badgeStyle} className="p-6 text-center space-y-4">
        <ProfileAvatar src={data.profilePic} name={data.displayName} />
        <p className="text-xs text-white/60">{data.displayName} · {data.username}</p>
        <div>
          <p className="text-3xl font-bold">{data.topPost.views.toLocaleString()} views</p>
          <p className="text-xs text-white/50">on a single Threads post</p>
        </div>
        <p className="text-xs text-white/70 italic">
          "{data.topPost.text.slice(0, 80)}{data.topPost.text.length > 80 ? "..." : ""}"
        </p>
        <p className="text-[10px] text-white/25">Threadable.ai</p>
      </div>
      <ScreenshotButton targetRef={ref} />
    </div>
  );
}

function GrowthBadge({ data }: { data: BadgeData }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} style={badgeStyle} className="p-6 text-center space-y-4">
        <ProfileAvatar src={data.profilePic} name={data.displayName} />
        <p className="text-xs text-white/60">{data.displayName} · {data.username}</p>
        <div className="space-y-1">
          <p className="text-2xl font-bold">{data.followerCount.toLocaleString()} followers</p>
          <p className="text-sm text-white/70">{data.totalViews.toLocaleString()} total views</p>
          <p className="text-sm text-white/70">{data.totalPosts} posts</p>
        </div>
        <p className="text-[10px] text-white/25">Threadable.ai</p>
      </div>
      <ScreenshotButton targetRef={ref} />
    </div>
  );
}

export function ShareableBadges() {
  const data = useBadgeData();
  if (!data) return null;

  return (
    <div className="space-y-6">
      <h4 className="text-sm font-bold text-foreground">📤 Share Your Growth</h4>

      {/* Main badge */}
      <div className="flex justify-center">
        <DailyRecapBadge data={data} />
      </div>

      {/* 3 smaller badges in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StreakBadge data={data} />
        <TopPostBadge data={data} />
        <GrowthBadge data={data} />
      </div>
    </div>
  );
}
