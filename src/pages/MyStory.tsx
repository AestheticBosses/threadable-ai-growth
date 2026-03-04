import { useState, useEffect, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { AboutYouSection } from "@/components/identity/AboutYouSection";
import { OffersSection } from "@/components/identity/OffersSection";
import { AudiencesSection } from "@/components/identity/AudiencesSection";
import { PersonalInfoSection } from "@/components/identity/PersonalInfoSection";
import { NumbersSection } from "@/components/identity/NumbersSection";
import { StoriesSection } from "@/components/identity/StoriesSection";
import { IdentityReviewModal } from "@/components/identity/IdentityReviewModal";
import { useExtractIdentity } from "@/hooks/useExtractIdentity";
import { usePostsAnalyzed } from "@/hooks/usePostsAnalyzed";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Check } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import threadableIcon from "@/assets/threadable-icon.png";
import { IdentityCompleteness } from "@/components/identity/IdentityCompleteness";

const PROGRESS_STEPS = [
  "Fetching your posts...",
  "Extracting your professional identity...",
  "Finding your stories and experiences...",
  "Identifying your offers and audience...",
  "Extracting knowledge base & numbers...",
];

function ExtractionOverlay({ postCount }: { postCount: number }) {
  const [completedSteps, setCompletedSteps] = useState(0);

  useEffect(() => {
    const steps = [
      setTimeout(() => setCompletedSteps(1), 800),
      setTimeout(() => setCompletedSteps(2), 3500),
      setTimeout(() => setCompletedSteps(3), 6500),
      setTimeout(() => setCompletedSteps(4), 9500),
    ];
    return () => steps.forEach(clearTimeout);
  }, []);

  const displaySteps = [...PROGRESS_STEPS];
  displaySteps[0] = `Fetched ${postCount} posts`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="max-w-sm w-full mx-4 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <img
            src={threadableIcon}
            alt="Threadable"
            className="h-14 w-14 rounded-xl mb-4 animate-pulse"
          />
          <h3 className="text-lg font-bold text-foreground">Analyzing your posts</h3>
          <p className="text-sm text-muted-foreground mt-1">Building your Identity profile...</p>
        </div>
        <div className="space-y-3">
          {displaySteps.map((step, i) => {
            const isDone = i < completedSteps;
            const isActive = i === completedSteps;
            return (
              <div key={i} className="flex items-center gap-3">
                {isDone ? (
                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded-full border border-border shrink-0" />
                )}
                <span
                  className={`text-sm ${isDone ? "text-foreground" : isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const MyStory = () => {
  usePageTitle("Identity", "Your real data vault for AI content generation");
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: posts } = usePostsAnalyzed();
  const hasPosts = (posts?.length ?? 0) > 0;
  const {
    extract,
    isExtracting,
    saveAll,
    isSaving,
    extractedData,
    postCount,
    showReview,
    setShowReview,
  } = useExtractIdentity();
  const { extract: extractVault, isExtracting: isExtractingVault } = useExtractVaultEntries();

  // Handle autofill query param
  const autofillTriggeredRef = useCallback((node: null) => {}, []);
  const [autofillHandled, setAutofillHandled] = useState(false);

  useEffect(() => {
    if (autofillHandled) return;
    const shouldAutofill = searchParams.get("autofill") === "true";
    if (shouldAutofill && hasPosts && !isExtracting) {
      setAutofillHandled(true);
      // Remove the query param
      setSearchParams({}, { replace: true });
      // Trigger extraction
      extract();
    }
  }, [searchParams, hasPosts, isExtracting, autofillHandled, setSearchParams, extract]);

  return (
    <AppLayout>
      {isExtracting && <ExtractionOverlay postCount={posts?.length ?? 0} />}
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Identity</h1>
            <p className="mt-1 text-muted-foreground">
              Your real data vault. The AI uses ONLY these facts — never makes anything up.
            </p>
          </div>
          {hasPosts && (
            <Button
              onClick={extract}
              disabled={isExtracting}
              className="shrink-0 gap-2 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
            >
              {isExtracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isExtracting ? `Analyzing ${posts?.length ?? 0} posts...` : "Auto-Fill Identity"}
            </Button>
          )}
        </div>

        {!hasPosts && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-medium text-foreground">Starter Identity</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your identity was generated from your onboarding inputs. Start posting on Threads, then come back and click <strong>Auto-Fill Identity</strong> to extract your real voice, stories, and experiences from your content.
            </p>
          </div>
        )}

        <IdentityCompleteness />

        <div id="about-you"><AboutYouSection /></div>
        <div id="stories">
          <div className="flex items-center justify-between mb-2">
            <div />
            {hasPosts && (
              <Button
                onClick={extractVault}
                disabled={isExtractingVault}
                variant="outline"
                size="sm"
                className="gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                {isExtractingVault ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {isExtractingVault ? "Analyzing posts..." : "Auto-Fill from Posts"}
              </Button>
            )}
          </div>
          <StoriesSection />
        </div>
        <div id="numbers"><NumbersSection /></div>
        <div id="offers"><OffersSection /></div>
        <div id="audiences"><AudiencesSection /></div>
        <div id="personal-info"><PersonalInfoSection /></div>
      </div>

      {extractedData && (
        <IdentityReviewModal
          open={showReview}
          onClose={() => setShowReview(false)}
          data={extractedData}
          onSave={saveAll}
          onReanalyze={extract}
          isSaving={isSaving}
        />
      )}
    </AppLayout>
  );
};

export default MyStory;
