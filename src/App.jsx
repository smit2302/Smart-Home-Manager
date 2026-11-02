import { Navigate, Route, Routes } from 'react-router-dom';
import { useHome } from './context/HomeContext.jsx';
import AppShell from './components/AppShell.jsx';
import AuthPage from './pages/AuthPage.jsx';
import HouseholdSetup from './pages/HouseholdSetup.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import RoomsPage from './pages/RoomsPage.jsx';
import DevicesPage from './pages/DevicesPage.jsx';
import RoutinesPage from './pages/RoutinesPage.jsx';
import GroupsPage from './pages/GroupsPage.jsx';
import EnergyPage from './pages/EnergyPage.jsx';
import AlertsPage from './pages/AlertsPage.jsx';
import VoicePage from './pages/VoicePage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';
import MembersPage from './pages/MembersPage.jsx';
import Toasts from './components/Toasts.jsx';

export default function App() {
  const { account, home } = useHome();

  let screen;
  if (!account) {
    screen = <AuthPage />;
  } else if (!home) {
    screen = <HouseholdSetup />;
  } else {
    screen = (
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="routines" element={<RoutinesPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="energy" element={<EnergyPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="voice" element={<VoicePage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <>
      {screen}
      <Toasts />
    </>
  );
}
