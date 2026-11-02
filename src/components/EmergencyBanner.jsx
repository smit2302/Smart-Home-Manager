import { useHome } from '../context/HomeContext.jsx';
import { prettyDateTime } from '../utils/timeHelpers.js';

export default function EmergencyBanner() {
  const { home } = useHome();
  if (!home.emergency.active) return null;
  return (
    <div className="emergency-banner" role="alert">
      <strong>Emergency mode is on.</strong> All appliances are switched off and the virtual doors are locked.
      Started {prettyDateTime(home.emergency.since)} by {home.emergency.by}.
    </div>
  );
}
