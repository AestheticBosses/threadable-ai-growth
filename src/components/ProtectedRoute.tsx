import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, onboardingCompleted, hasStrategy } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (onboardingCompleted === false && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  if (onboardingCompleted === true && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  if (
    onboardingCompleted === true &&
    hasStrategy === false &&
    location.pathname === "/dashboard"
  ) {
    return <Navigate to="/analyze" replace />;
  }

  return <>{children}</>;
}
