import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { AboutYouSection } from "@/components/identity/AboutYouSection";
import { OffersSection } from "@/components/identity/OffersSection";
import { AudiencesSection } from "@/components/identity/AudiencesSection";
import { PersonalInfoSection } from "@/components/identity/PersonalInfoSection";
import { NumbersSection } from "@/components/identity/NumbersSection";
import { StoriesSection } from "@/components/identity/StoriesSection";

const MyStory = () => {
  usePageTitle("Identity", "Your real data vault for AI content generation");

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Identity</h1>
          <p className="mt-1 text-muted-foreground">
            Your real data vault. The AI uses ONLY these facts — never makes anything up.
          </p>
        </div>

        <AboutYouSection />
        <StoriesSection />
        <NumbersSection />
        <OffersSection />
        <AudiencesSection />
        <PersonalInfoSection />
      </div>
    </AppLayout>
  );
};

export default MyStory;
