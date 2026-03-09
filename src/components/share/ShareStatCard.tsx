import { forwardRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";

export interface ShareStatCardProps {
  variant: "streak" | "views" | "viral" | "growth" | "posts";
  value: number;
  user: { name: string; handle: string; avatarUrl?: string };
  meta?: { posts?: number; sevenDayViews?: number };
}

const VARIANT_CONFIG: Record<
  ShareStatCardProps["variant"],
  { accent: string; accentGlow: string; unit: string; status: string; subline: string; formatValue: (v: number, meta?: { posts?: number; sevenDayViews?: number }) => string }
> = {
  streak: {
    accent: "#FF7043",
    accentGlow: "rgba(255,112,67,0.15)",
    unit: "day streak",
    status: "Consistency compounds.",
    subline: "Show up. Stack days. Build trust.",
    formatValue: (v) => `${v}`,
  },
  views: {
    accent: "#5B9CF6",
    accentGlow: "rgba(91,156,246,0.15)",
    unit: "views in 7 days",
    status: "Organic reach. $0 ad spend.",
    subline: "",
    formatValue: (v, meta) => {
      if (meta?.sevenDayViews) return meta.sevenDayViews.toLocaleString();
      return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`;
    },
  },
  viral: {
    accent: "#F25C7C",
    accentGlow: "rgba(242,92,124,0.15)",
    unit: "engagement pattern",
    status: "Analyzed by Threadable AI.",
    subline: "Your content hits different.",
    formatValue: (v) => `Top ${v}%`,
  },
  growth: {
    accent: "#3DD68C",
    accentGlow: "rgba(61,214,140,0.15)",
    unit: "reach growth in 30 days",
    status: "Data, not guesswork.",
    subline: "The compound effect is real.",
    formatValue: (v) => `+${v}%`,
  },
  posts: {
    accent: "hsl(270, 91%, 65%)",
    accentGlow: "rgba(168,85,247,0.15)",
    unit: "posts published",
    status: "Not a content calendar. A CMO.",
    subline: "Every post backed by data.",
    formatValue: (v) => `${v}`,
  },
};

export const ShareStatCard = forwardRef<HTMLDivElement, ShareStatCardProps>(
  ({ variant, value, user, meta }, ref) => {
    const config = VARIANT_CONFIG[variant];
    const displayValue = config.formatValue(value, meta);
    const subline = config.subline;

    return (
      <div
        ref={ref}
        className="relative overflow-hidden rounded-xl"
        style={{ width: 300, background: "#0E1320", fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Dot grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Purple ambient glow top */}
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(168,85,247,0.15), transparent 70%)" }}
        />

        {/* Accent glow bottom-right */}
        <div
          className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${config.accentGlow}, transparent 70%)` }}
        />

        <div className="relative z-10 p-6 space-y-4">
          {/* Avatar + name */}
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 border border-white/10">
              <AvatarImage src={user.avatarUrl} />
              <AvatarFallback className="bg-white/5 text-white/60">
                <User className="h-3.5 w-3.5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{user.name}</p>
              <p className="text-xs text-white/40">@{user.handle}</p>
            </div>
          </div>

          {/* Big number */}
          <div className="pt-2">
            <p
              className="text-5xl font-bold leading-none tracking-tight"
              style={{ color: config.accent }}
            >
              {displayValue}
            </p>
            <p className="text-sm text-white/40 mt-1.5">{config.unit}</p>
          </div>

          {/* Status line */}
          <div className="pt-1 space-y-0.5">
            <p className="text-sm font-medium text-white/80">{config.status}</p>
            {subline && <p className="text-xs text-white/40">{subline}</p>}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-1.5 pt-3 border-t border-white/5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "hsl(270, 91%, 65%)" }}
            />
            <span className="text-[10px] text-white/30 tracking-wide">Powered by threadable.ai</span>
          </div>
        </div>
      </div>
    );
  },
);

ShareStatCard.displayName = "ShareStatCard";
