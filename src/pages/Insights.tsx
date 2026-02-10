import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { RegressionAnalysis } from "@/components/strategy/RegressionAnalysis";
import { GrowthSignals } from "@/components/strategy/GrowthSignals";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "regression", label: "Regression Insights" },
  { id: "growth", label: "Top Performers" },
] as const;

type TabId = typeof TABS[number]["id"];

const Insights = () => {
  usePageTitle("Insights", "Data-driven analysis of your content performance");
  const [activeTab, setActiveTab] = useState<TabId>("regression");

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Insights</h1>
          <p className="mt-1 text-muted-foreground text-sm">Data-driven analysis of your content performance.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "regression" && <RegressionAnalysis />}
        {activeTab === "growth" && <GrowthSignals />}
      </div>
    </AppLayout>
  );
};

export default Insights;
