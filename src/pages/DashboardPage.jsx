import { Link } from 'react-router-dom';
import { useHome } from '../context/HomeContext.jsx';
import DeviceCard from '../components/DeviceCard.jsx';
import { currentLoadWatts, getWeeklyReport } from '../utils/homeEngine.js';
import { hasAbility } from '../utils/permissions.js';
import { getWatts } from '../utils/deviceTemplates.js';

export default function DashboardPage() {
  const { home, role, loadDemo } = useHome();
  const report = getWeeklyReport(home);
  const todayKwh = report.daily[report.daily.length - 1].kwh;
  const connectedCount = home.devices.filter((device) => device.connected).length;
  const runningCount = home.devices.filter((device) => getWatts(device) > 0 && device.type !== 'doorLock').length;
  const openAlerts = home.alerts.filter((alert) => !alert.acknowledged && alert.level !== 'info');

  if (!home.devices.length) {
    return (
      <section className="empty-block">
        <h2>Your home is empty</h2>
        <p>Start by adding a room, then create your first device. You can also load a ready-made demo home to explore.</p>
        <div className="row-gap">
          <Link className="btn btn-primary" to="/rooms">Add a room</Link>
          <Link className="btn btn-quiet" to="/devices">Create a device</Link>
          {hasAbility(role, 'demo.load') && (
            <button className="btn btn-quiet" onClick={loadDemo}>Load demo home</button>
          )}
        </div>
      </section>
    );
  }

  const roomSections = [...home.rooms, { id: null, name: 'Unassigned' }]
    .map((room) => ({ room, devices: home.devices.filter((device) => device.roomId === room.id) }))
    .filter((section) => section.devices.length);

  return (
    <>
      <section className="stat-row">
        <div className="stat">
          <span>Running now</span>
          <strong>{runningCount}</strong>
          <small>{connectedCount} of {home.devices.length} devices connected</small>
        </div>
        <div className="stat">
          <span>Current load</span>
          <strong>{Math.round(currentLoadWatts(home))} W</strong>
          <small>Live draw across the house</small>
        </div>
        <div className="stat">
          <span>Used today</span>
          <strong>{todayKwh.toFixed(2)} kWh</strong>
          <small>{report.totalKwh.toFixed(1)} kWh over 7 days</small>
        </div>
        <Link className={`stat stat-link ${openAlerts.length ? 'stat-warn' : ''}`} to="/alerts">
          <span>Open alerts</span>
          <strong>{openAlerts.length}</strong>
          <small>{openAlerts.length ? openAlerts[0].title : 'Everything looks normal'}</small>
        </Link>
      </section>

      {roomSections.map(({ room, devices }) => (
        <section key={room.id || 'none'} className="room-block">
          <h2>{room.name}</h2>
          <div className="device-grid">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
