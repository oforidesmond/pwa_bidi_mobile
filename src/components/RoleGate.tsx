import type { RoleName } from '@/context/AuthContext';
import { useAuth } from '@/context/AuthContext';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

function attendantLike(role: RoleName): boolean {
  return (
    role === 'FUEL_ATTENDANT' ||
    role === 'STATION_MANAGER' ||
    role === 'ADMIN' ||
    role === 'SUPER_ADMIN' ||
    role === 'OMC_ADMIN'
  );
}

export function DriverRoutes() {
  const { role, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="bidi-app-loading" role="status">
        <div className="bidi-spinner" />
      </div>
    );
  }

  if (role !== 'DRIVER') {
    return <Navigate to="/app" replace state={{ from: loc.pathname }} />;
  }

  return <Outlet />;
}

export function AttendantRoutes() {
  const { role, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="bidi-app-loading" role="status">
        <div className="bidi-spinner" />
      </div>
    );
  }

  if (!attendantLike(role)) {
    return <Navigate to="/app" replace state={{ from: loc.pathname }} />;
  }

  return <Outlet />;
}

export function ExploreRoute() {
  const { role, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="bidi-app-loading" role="status">
        <div className="bidi-spinner" />
      </div>
    );
  }

  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'OMC_ADMIN') {
    return <Navigate to="/app" replace state={{ from: loc.pathname }} />;
  }

  return <Outlet />;
}
