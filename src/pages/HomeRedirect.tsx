import { useAuth } from '@/context/AuthContext';
import { useBidiTheme } from '@/context/ThemeContext';
import { Navigate } from 'react-router-dom';

export default function HomeRedirect() {
  const { user, role, loading } = useAuth();
  const { tokens } = useBidiTheme();

  if (loading) {
    return (
      <div
        className="bidi-app-loading"
        style={{ backgroundColor: tokens.surfaceBg }}
        role="status"
      >
        <div className="bidi-spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  switch (role) {
    case 'DRIVER':
      return <Navigate to="/app/driver" replace />;
    case 'FUEL_ATTENDANT':
    case 'STATION_MANAGER':
      return <Navigate to="/app/sell" replace />;
    case 'ADMIN':
    case 'SUPER_ADMIN':
    case 'OMC_ADMIN':
      return <Navigate to="/app/profile" replace />;
    default:
      return <Navigate to="/app/profile" replace />;
  }
}
