import { AppLayout } from "@/components/AppLayout";

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Your Threads analytics at a glance.</p>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
