import { AppLayout } from "@/components/AppLayout";

const Queue = () => {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Content Queue</h1>
        <p className="mt-1 text-muted-foreground">Schedule and manage your upcoming posts.</p>
      </div>
    </AppLayout>
  );
};

export default Queue;
