import { AppShell } from '@/components/AppShell';
import { AttendantRoutes, DriverRoutes, ExploreRoute } from '@/components/RoleGate';
import { RequireAuth } from '@/components/RequireAuth';
import DriverLoginPage from '@/pages/DriverLoginPage';
import DriverPage from '@/pages/DriverPage';
import DriverSetupPage from '@/pages/DriverSetupPage';
import ExplorePage from '@/pages/ExplorePage';
import HomeRedirect from '@/pages/HomeRedirect';
import LedgerPage from '@/pages/LedgerPage';
import LoginPage from '@/pages/LoginPage';
import ProfilePage from '@/pages/ProfilePage';
import SalesPage from '@/pages/SalesPage';
import SellPage from '@/pages/SellPage';
import TokenDetailPage from '@/pages/TokenDetailPage';
import TokensPage from '@/pages/TokensPage';
import { Navigate, Route, Routes } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<DriverLoginPage />} />
      <Route path="/login-staff" element={<LoginPage />} />
      <Route path="/login-driver" element={<Navigate to="/login" replace />} />
      <Route path="/app" element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<HomeRedirect />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route element={<DriverRoutes />}>
            <Route path="driver" element={<DriverPage />} />
            <Route path="setup" element={<DriverSetupPage />} />
            <Route path="tokens" element={<TokensPage />} />
            <Route path="tokens/:id" element={<TokenDetailPage />} />
            <Route path="ledger" element={<LedgerPage />} />
          </Route>
          <Route element={<AttendantRoutes />}>
            <Route path="sell" element={<SellPage />} />
            <Route path="sales" element={<SalesPage />} />
          </Route>
          <Route element={<ExploreRoute />}>
            <Route path="explore" element={<ExplorePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
