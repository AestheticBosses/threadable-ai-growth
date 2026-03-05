import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type GuardrailType = "never_say" | "never_reference" | "always_frame" | "voice_correction" | "offer_guardrail";

interface GuardrailConfig {
  type: GuardrailType;
  label: string;
  placeholder: string;
}

const GUARDRAIL_CONFIGS: GuardrailConfig[] = [
  {
    type: "never_say",
    label: "Phrases I'd never say",
    placeholder: 'e.g. Making parenting sound like an inconvenience to building',
  },
  {
    type: "never_reference",
    label: "Topics or stories I'd never reference",
    placeholder: "e.g. Implying I chose the app over my kids",
  },
  {
    type: "always_frame",
    label: "Always frame it this way",
    placeholder: "e.g. Dad identity = fuel, not sacrifice. Building is additive to family, not competing with it.",
  },
  {
    type: "voice_correction",
    label: "Voice corrections",
    placeholder: "e.g. I don't do self-deprecating humor. I'm confident, not corporate.",
  },
  {
    type: "offer_guardrail",
    label: "Offer & positioning guardrails",
    placeholder: "e.g. Threadable is a CMO, not a scheduler. Never position it as a posting tool.",
  },
];

export function GuardrailsTab() {
  const { user } = useAuth();
  const [values, setValues] = useState<Record<GuardrailType, string>>({
    never_say: "",
    never_reference: "",
    always_frame: "",
    voice_correction: "",
    offer_guardrail: "",
  });
  const [lastSaved, setLastSaved] = useState<Record<GuardrailType, Date | null>>({
    never_say: null,
    never_reference: null,
    always_frame: null,
    voice_correction: null,
    offer_guardrail: null,
  });
  const [loading, setLoading] = useState(true);
  const prevValues = useRef<Record<GuardrailType, string>>({ ...values });

  // Load existing guardrails on mount
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("user_content_guardrails")
        .select("guardrail_type, content, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load guardrails:", error);
        setLoading(false);
        return;
      }

      const grouped: Record<GuardrailType, string[]> = {
        never_say: [],
        never_reference: [],
        always_frame: [],
        voice_correction: [],
        offer_guardrail: [],
      };

      for (const row of data || []) {
        const t = row.guardrail_type as GuardrailType;
        if (grouped[t]) grouped[t].push(row.content);
      }

      const newValues: Record<GuardrailType, string> = {
        never_say: grouped.never_say.join("\n"),
        never_reference: grouped.never_reference.join("\n"),
        always_frame: grouped.always_frame.join("\n"),
        voice_correction: grouped.voice_correction.join("\n"),
        offer_guardrail: grouped.offer_guardrail.join("\n"),
      };

      setValues(newValues);
      prevValues.current = { ...newValues };
      setLoading(false);
    })();
  }, [user?.id]);

  const saveGuardrailType = useCallback(async (type: GuardrailType, text: string) => {
    if (!user?.id) return;
    // Skip if unchanged
    if (text === prevValues.current[type]) return;
    prevValues.current[type] = text;

    // Delete all existing entries for this type, then insert new ones
    await (supabase as any)
      .from("user_content_guardrails")
      .delete()
      .eq("user_id", user.id)
      .eq("guardrail_type", type)
      .eq("source", "manual");

    const lines = text
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);

    if (lines.length > 0) {
      const rows = lines.map((content: string) => ({
        user_id: user.id,
        guardrail_type: type,
        content,
        source: "manual" as const,
      }));

      const { error } = await (supabase as any)
        .from("user_content_guardrails")
        .insert(rows);

      if (error) {
        toast({ title: "Error saving guardrails", description: error.message, variant: "destructive" });
        return;
      }
    }

    setLastSaved((prev) => ({ ...prev, [type]: new Date() }));
  }, [user?.id]);

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return null;
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Saved just now";
    if (mins === 1) return "Saved 1 min ago";
    return `Saved ${mins} min ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading guardrails...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Brand Guardrails</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Hard rules that Threadable follows in every plan and draft. One rule per line.
        </p>
      </div>

      {GUARDRAIL_CONFIGS.map((config) => (
        <Card key={config.type}>
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">{config.label}</label>
              {lastSaved[config.type] && (
                <span className="text-[10px] text-muted-foreground">{formatTimeAgo(lastSaved[config.type])}</span>
              )}
            </div>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
              placeholder={config.placeholder}
              value={values[config.type]}
              onChange={(e) => setValues((prev) => ({ ...prev, [config.type]: e.target.value }))}
              onBlur={() => saveGuardrailType(config.type, values[config.type])}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
