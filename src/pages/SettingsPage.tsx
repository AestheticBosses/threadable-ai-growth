import { AppLayout } from "@/components/AppLayout";

const SettingsPage = () => {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your account and preferences.</p>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
