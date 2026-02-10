import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Unplug, ChevronDown, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, differenceInDays, parseISO, addDays } from "date-fns";

interface ThreadsConnectionCardProps {
  threadsUsername: string | null;
  tokenExpiresAt: string | null;
  onDisconnect: () => void;
}

export function ThreadsConnectionCard({ threadsUsername, tokenExpiresAt, onDisconnect }: ThreadsConnectionCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reconnecting, setReconnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUserId, setManualUserId] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const handleSaveManualToken = async () => {
    if (!manualUserId.trim() || !manualToken.trim()) {
      toast.error("Please enter both User ID and Access Token");
      return;
    }
    setSavingManual(true);
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        console.error("Auth error:", authError);
        toast.error("Not authenticated. Please log in again.");
        return;
      }
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .update({
          threads_user_id: manualUserId.trim(),
          threads_access_token: manualToken.trim(),
          threads_token_expires_at: expiresAt,
          onboarding_complete: true,
        })
        .eq("id", authUser.id)
        .select();
      if (error) {
        console.error("Supabase update error:", error);
        throw error;
      }
      console.log("Profile updated successfully:", data);
      toast.success("Token saved successfully!");
      navigate("/dashboard");
    } catch (err) {
      console.error("Failed to save token:", err);
      toast.error("Failed to save token");
    } finally {
      setSavingManual(false);
    }
  };

  const isConnected = !!threadsUsername;
  const expiresDate = tokenExpiresAt ? parseISO(tokenExpiresAt) : null;
  const daysUntilExpiry = expiresDate ? differenceInDays(expiresDate, new Date()) : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7;

  const handleReconnect = async () => {
    if (!user) return;
    setReconnecting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/threads-auth-url?user_id=${user.id}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        toast.error("Failed to get authorization URL");
      }
    } catch {
      toast.error("Failed to initiate reconnection");
    } finally {
      setReconnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          threads_access_token: null,
          threads_user_id: null,
          threads_username: null,
          threads_token_expires_at: null,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Threads account disconnected");
      onDisconnect();
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {isConnected ? <Wifi className="h-5 w-5 text-primary" /> : <WifiOff className="h-5 w-5 text-muted-foreground" />}
          Threads Connection
        </CardTitle>
        <CardDescription>Manage your Threads account integration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {isConnected ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">Connected</Badge>
                  <span className="text-sm font-medium">@{threadsUsername}</span>
                </div>
                {expiresDate && (
                  <div className={`flex items-center gap-1.5 text-xs ${isExpiringSoon ? "text-destructive" : "text-muted-foreground"}`}>
                    {isExpiringSoon && <AlertTriangle className="h-3 w-3" />}
                    Token expires {format(expiresDate, "MMM d, yyyy")}
                    {isExpiringSoon && ` (${daysUntilExpiry} days left)`}
                  </div>
                )}
              </>
            ) : (
              <Badge variant="secondary">Not connected</Badge>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReconnect} disabled={reconnecting}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${reconnecting ? "animate-spin" : ""}`} />
            {isConnected ? "Reconnect" : "Connect"}
          </Button>
          {isConnected && (
            <Button variant="ghost" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="text-destructive hover:text-destructive">
              <Unplug className="h-4 w-4 mr-1.5" />
              Disconnect
            </Button>
          )}
        </div>

        <Collapsible open={manualOpen} onOpenChange={setManualOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Settings2 className="h-4 w-4" />
                Advanced: Manual Token Setup
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${manualOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="manual-user-id">Threads User ID</Label>
              <Input id="manual-user-id" placeholder="Enter your Threads user ID" value={manualUserId} onChange={(e) => setManualUserId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual-token">Threads Access Token</Label>
              <Input id="manual-token" placeholder="Paste your long-lived access token" value={manualToken} onChange={(e) => setManualToken(e.target.value)} />
            </div>
            <Button onClick={handleSaveManualToken} disabled={savingManual} size="sm">
              {savingManual ? "Saving…" : "Save Token"}
            </Button>
            <p className="text-xs text-muted-foreground">
              You can get a test token from the Meta Graph API Explorer at{" "}
              <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">developers.facebook.com</a>
              {" → Tools → API Explorer → select Threads API"}
            </p>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
