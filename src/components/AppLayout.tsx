import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Lightbulb,
  CalendarClock,
  Mic2,
  Settings,
  Zap,
  LogOut,
  MoreHorizontal,
  BookOpen,
} from "lucide-react";
import threadableIcon from "@/assets/threadable-icon.png";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { title: "Insights", path: "/insights", icon: Lightbulb },
  { title: "Playbook", path: "/playbook", icon: Zap },
  { title: "Content Queue", path: "/queue", icon: CalendarClock },
  { title: "My Story", path: "/my-story", icon: BookOpen },
  { title: "Voice", path: "/voice", icon: Mic2 },
  { title: "Settings", path: "/settings", icon: Settings },
];

const mobileTabItems = [
  { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { title: "Queue", path: "/queue", icon: CalendarClock },
  { title: "Insights", path: "/insights", icon: Lightbulb },
];

const moreItems = [
  { title: "My Story", path: "/my-story", icon: BookOpen },
  { title: "Voice", path: "/voice", icon: Mic2 },
  { title: "Settings", path: "/settings", icon: Settings },
];

interface AppSidebarProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppSidebarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const userEmail = user?.email ?? "user@example.com";
  const userInitial = userEmail.charAt(0).toUpperCase();

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
        <img src={threadableIcon} alt="Threadable.ai" className="h-7 w-7 rounded-md" />
        <span className="text-sm font-semibold text-foreground tracking-tight">
          Threadable.ai
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => (
          <RouterNavLink
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.path)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </RouterNavLink>
        ))}
      </nav>

      {/* User + Sign Out */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {userEmail}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col bg-sidebar border-r border-sidebar-border">
        {sidebarContent}
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top header */}
        <header className="flex h-14 items-center border-b border-border px-4 md:hidden">
          <div className="flex items-center gap-2">
            <img src={threadableIcon} alt="Threadable.ai" className="h-6 w-6 rounded-md" />
            <span className="text-sm font-semibold tracking-tight text-foreground">Threadable.ai</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background pb-20 md:pb-0">
          {children}
        </main>

        {/* Mobile Bottom Tab Bar */}
        {isMobile && (
          <>
            {moreOpen && (
              <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
            )}
            {moreOpen && (
              <div className="fixed bottom-16 right-2 z-50 rounded-lg border border-border bg-card shadow-lg p-2 space-y-1 min-w-[180px]">
                {moreItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMoreOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive(item.path)
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </button>
                ))}
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => { handleSignOut(); setMoreOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}

            <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="flex items-center justify-around h-16">
                {mobileTabItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-1 px-3 rounded-md transition-colors min-w-[60px]",
                      isActive(item.path)
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{item.title}</span>
                  </button>
                ))}
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-1 px-3 rounded-md transition-colors min-w-[60px]",
                    moreOpen || moreItems.some((i) => isActive(i.path))
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <MoreHorizontal className="h-5 w-5" />
                  <span className="text-[10px] font-medium">More</span>
                </button>
              </div>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
