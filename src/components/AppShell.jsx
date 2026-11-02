import { NavLink, Outlet } from 'react-router-dom';
import { useHome } from '../context/HomeContext.jsx';
import TopBar from './TopBar.jsx';
import EmergencyBanner from './EmergencyBanner.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/rooms', label: 'Rooms' },
  { to: '/devices', label: 'Devices' },
  { to: '/routines', label: 'Routines' },
  { to: '/groups', label: 'Groups' },
  { to: '/energy', label: 'Energy' },
  { to: '/alerts', label: 'Alerts', alerts: true },
  { to: '/voice', label: 'Voice control' },
  { to: '/insights', label: 'Insights' },
  { to: '/members', label: 'Members' },
];

export default function AppShell() {
  const { home } = useHome();
  const openAlerts = home.alerts.filter((alert) => !alert.acknowledged && alert.level !== 'info').length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <strong>SmartHome</strong>
            <span>Manager</span>
          </div>
        </div>
        <nav className="nav-list">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}>
              {item.label}
              {item.alerts && openAlerts > 0 && <span className="nav-badge">{openAlerts}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-column">
        <TopBar />
        <EmergencyBanner />
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
