import type { RoleName } from '@/context/AuthContext';
import { useAuth } from '@/context/AuthContext';
import { NavLink, Outlet } from 'react-router-dom';

type TabDef = {
  to: string;
  label: string;
  icon: string;
};

const DRIVER_TABS: TabDef[] = [
  { to: '/app/driver', label: 'Buy Token', icon: 'local_gas_station' },
  { to: '/app/tokens', label: 'My Tokens', icon: 'confirmation_number' },
  { to: '/app/ledger', label: 'Activity', icon: 'receipt_long' },
  { to: '/app/profile', label: 'Profile', icon: 'person' },
];

const ATTENDANT_BASE: TabDef[] = [
  { to: '/app/sell', label: 'Sell Fuel', icon: 'point_of_sale' },
  { to: '/app/sales', label: 'Sales', icon: 'history' },
  { to: '/app/profile', label: 'Profile', icon: 'person' },
];

const EXPLORE_TAB: TabDef = {
  to: '/app/explore',
  label: 'Explore',
  icon: 'explore',
};

function canSeeExplore(role: RoleName): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OMC_ADMIN';
}

function tabsForRole(role: RoleName): TabDef[] {
  if (role === 'DRIVER') return DRIVER_TABS;
  if (
    role === 'FUEL_ATTENDANT' ||
    role === 'STATION_MANAGER' ||
    role === 'ADMIN' ||
    role === 'SUPER_ADMIN' ||
    role === 'OMC_ADMIN'
  ) {
    const base = [...ATTENDANT_BASE];
    if (canSeeExplore(role)) {
      base.splice(2, 0, EXPLORE_TAB);
    }
    return base;
  }
  return [{ to: '/app/profile', label: 'Profile', icon: 'person' }];
}

export function AppShell() {
  const { role } = useAuth();
  const tabs = tabsForRole(role);

  return (
    <div className="bidi-phone-shell bidi-app-stage">
      <main className="bidi-phone-shell__main">
        <Outlet />
      </main>
      <nav className="bidi-tab-bar" aria-label="Main navigation">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `bidi-tab-bar__item${isActive ? ' bidi-tab-bar__item--active' : ''}`
            }
          >
            <span className="material-symbols-outlined bidi-tab-bar__icon" aria-hidden>
              {t.icon}
            </span>
            <span className="bidi-tab-bar__label">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
