import { useAuth } from '@/context/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';

export function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="bidi-app-loading" role="status" aria-live="polite">
        <div className="bidi-spinner" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
