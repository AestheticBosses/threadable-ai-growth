import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Sparkles,
  Mic,
} from "lucide-react";
import { WritingExamplesSection } from "@/components/voice/WritingExamplesSection";
import { ContentPreferencesSection } from "@/components/voice/ContentPreferencesSection";

type VoiceProfile = {
  tone: string[];
  sentence_style: string;
  vocabulary_level: string;
  common_phrases: string[];
  emoji_usage: string;
  formatting_patterns: string;
  opening_style: string;
  closing_style: string;
  unique_quirks: string[];
  overall_summary: string;
  include_credibility_markers?: boolean;
};


const TONE_COLORS = [
  "bg-primary/10 text-primary",
  "bg-orange-500/10 text-orange-600",
  "bg-emerald-500/10 text-emerald-600",
  "bg-violet-500/10 text-violet-600",
  "bg-rose-500/10 text-rose-600",
];

const Voice = () => {
  usePageTitle("Voice", "Train AI to match your unique voice, style, and preferences");
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  const [credibilityToggle, setCredibilityToggle] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;

    const [profileRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("voice_profile")
        .eq("id", user.id)
        .single(),
    ]);

    if (profileRes.data?.voice_profile) {
      const vp = profileRes.data.voice_profile as unknown as VoiceProfile;
      setVoiceProfile(vp);
      setCredibilityToggle(vp.include_credibility_markers !== false);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAnalyze = async () => {
    if (!session?.access_token) return;
    setAnalyzing(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-voice`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }
      const data = await res.json();
      setVoiceProfile(data);
      setCredibilityToggle(data.include_credibility_markers !== false);
      toast({ title: "Voice analyzed!", description: "Your writing style profile is ready." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleToggleCredibility = async (checked: boolean) => {
    setCredibilityToggle(checked);
    if (!user || !voiceProfile) return;
    const updated = { ...voiceProfile, include_credibility_markers: checked };
    setVoiceProfile(updated);
    await supabase
      .from("profiles")
      .update({ voice_profile: updated as any })
      .eq("id", user.id);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Voice</h1>
          <p className="mt-1 text-muted-foreground">Train AI to match your unique voice, style, and preferences.</p>
        </div>

        {/* Writing Examples (NEW) */}
        <WritingExamplesSection />

        <Separator />

        {/* Content Preferences (NEW) */}
        <ContentPreferencesSection />

        <Separator />

        {/* Voice Training (EXISTING) */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Voice Training</h2>
            <p className="text-sm text-muted-foreground">Analyze your writing to build a unique voice profile.</p>
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="gap-2"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {voiceProfile ? "Re-Analyze" : "Analyze My Voice"}
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Voice Profile */}
          <div className="space-y-6">
            {voiceProfile ? (
              <>
                {/* Summary */}
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Mic className="h-4 w-4 text-primary" />
                      Voice Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p className="text-sm text-foreground leading-relaxed font-medium">
                      {voiceProfile.overall_summary}
                    </p>

                    {/* Tone Tags */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tone</p>
                      <div className="flex flex-wrap gap-2">
                        {voiceProfile.tone?.map((t, i) => (
                          <Badge key={i} variant="secondary" className={`${TONE_COLORS[i % TONE_COLORS.length]} border-0`}>
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Attributes */}
                    <div className="space-y-3">
                      <ProfileRow label="Sentence Style" value={voiceProfile.sentence_style} />
                      <ProfileRow label="Vocabulary" value={voiceProfile.vocabulary_level} />
                      <ProfileRow label="Emoji Usage" value={voiceProfile.emoji_usage} />
                      <ProfileRow label="Formatting" value={voiceProfile.formatting_patterns} />
                      <ProfileRow label="Opening Style" value={voiceProfile.opening_style} />
                      <ProfileRow label="Closing Style" value={voiceProfile.closing_style} />
                    </div>

                    {/* Common Phrases */}
                    {voiceProfile.common_phrases?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Common Phrases</p>
                        <div className="flex flex-wrap gap-1.5">
                          {voiceProfile.common_phrases.map((p, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-normal font-mono">
                              "{p}"
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unique Quirks */}
                    {voiceProfile.unique_quirks?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unique Quirks</p>
                        <ul className="space-y-1">
                          {voiceProfile.unique_quirks.map((q, i) => (
                            <li key={i} className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Credibility Toggle */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">Include credibility markers</p>
                        <p className="text-xs text-muted-foreground">
                          Add social proof and authority signals in AI-generated posts
                        </p>
                      </div>
                      <Switch
                        checked={credibilityToggle}
                        onCheckedChange={handleToggleCredibility}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                  <Mic className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center space-y-1">
                    <p className="font-medium text-foreground">No Voice Profile Yet</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Click "Analyze My Voice" to generate a profile from your writing samples.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider w-28 shrink-0 pt-0.5">
        {label}
      </p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

export default Voice;
