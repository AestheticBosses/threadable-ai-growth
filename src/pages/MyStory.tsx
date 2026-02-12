import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { AboutYouSection } from "@/components/identity/AboutYouSection";
import { OffersSection } from "@/components/identity/OffersSection";
import { AudiencesSection } from "@/components/identity/AudiencesSection";
import { PersonalInfoSection } from "@/components/identity/PersonalInfoSection";
import { NumbersSection } from "@/components/identity/NumbersSection";
import { StoriesSection } from "@/components/identity/StoriesSection";
import { DesiredPerceptionSection, MainGoalSection } from "@/components/identity/ExtendedIdentitySections";
import { IdentityReviewModal } from "@/components/identity/IdentityReviewModal";
import { useExtractIdentity } from "@/hooks/useExtractIdentity";
import { usePostsAnalyzed } from "@/hooks/usePostsAnalyzed";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

const MyStory = () => {
  usePageTitle("Identity", "Your real data vault for AI content generation");
  const { data: posts } = usePostsAnalyzed();
  const hasPosts = (posts?.length ?? 0) > 0;
  const {
    extract,
    isExtracting,
    saveAll,
    isSaving,
    extractedData,
    showReview,
    setShowReview,
  } = useExtractIdentity();

  return (
    <AppLayout>
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

        <AboutYouSection />
        <StoriesSection />
        <NumbersSection />
        <OffersSection />
        <AudiencesSection />
        <PersonalInfoSection />
        <DesiredPerceptionSection />
        <MainGoalSection />
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
