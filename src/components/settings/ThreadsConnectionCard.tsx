import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Unplug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";

interface ThreadsConnectionCardProps {
  threadsUsername: string | null;
  tokenExpiresAt: string | null;
  onDisconnect: () => void;
}

export function ThreadsConnectionCard({ threadsUsername, tokenExpiresAt, onDisconnect }: ThreadsConnectionCardProps) {
  const { user } = useAuth();
  const [reconnecting, setReconnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const isConnected = !!threadsUsername;
  const expiresDate = tokenExpiresAt ? parseISO(tokenExpiresAt) : null;
  const daysUntilExpiry = expiresDate ? differenceInDays(expiresDate, new Date()) : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7;

  const handleReconnect = async () => {
    if (!user) return;
    setReconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("threads-auth-url", {
        body: null,
        headers: {},
      });

      // Build URL with query param
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/threads-auth-url?user_id=${user.id}`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
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
      </CardContent>
    </Card>
  );
}
