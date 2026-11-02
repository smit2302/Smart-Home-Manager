import { useState } from 'react';
import { useHome } from '../context/HomeContext.jsx';
import { hasAbility } from '../utils/permissions.js';
import { prettyDateTime } from '../utils/timeHelpers.js';

const FILTERS = [
  { id: 'open', label: 'Needs attention' },
  { id: 'all', label: 'Everything' },
];

export default function AlertsPage() {
  const { home, role, acknowledgeAlert, acknowledgeAllAlerts, clearAlerts } = useHome();
  const [filter, setFilter] = useState('open');
  const canManage = hasAbility(role, 'alerts.manage');

  const visible = home.alerts.filter((alert) => (filter === 'all' ? true : !alert.acknowledged && alert.level !== 'info'));

  return (
    <>
      <header className="page-head">
        <h2>Alerts</h2>
        <p>Warnings appear when a device runs abnormally long, stops responding, or when emergency mode changes.</p>
      </header>

      <div className="toolbar">
        <div className="segmented">
          {FILTERS.map((item) => (
            <button key={item.id} className={filter === item.id ? 'segment segment-active' : 'segment'} onClick={() => setFilter(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {canManage && (
          <div className="row-gap">
            <button className="btn btn-quiet" onClick={acknowledgeAllAlerts}>Mark all as read</button>
            <button className="btn btn-quiet btn-quiet-danger" onClick={clearAlerts}>Clear history</button>
          </div>
        )}
      </div>

      <div className="stack">
        {visible.length === 0 && <p className="muted">{filter === 'open' ? 'Nothing needs attention right now.' : 'No alerts recorded yet.'}</p>}
        {visible.map((alert) => (
          <article key={alert.id} className={`alert-item alert-${alert.level} ${alert.acknowledged ? 'alert-read' : ''}`}>
            <div>
              <h3>{alert.title}</h3>
              <p>{alert.message}</p>
              <small>{prettyDateTime(alert.at)}</small>
            </div>
            {canManage && !alert.acknowledged && (
              <button className="btn btn-quiet" onClick={() => acknowledgeAlert(alert.id)}>Mark as read</button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
