import { useHome } from '../context/HomeContext.jsx';
import { getTemplate, getWatts } from '../utils/deviceTemplates.js';
import { canControlDevice, hasAbility } from '../utils/permissions.js';
import { prettyDuration, MINUTE } from '../utils/timeHelpers.js';
import DeviceControls from './DeviceControls.jsx';
import StatusBadge from './StatusBadge.jsx';

export default function DeviceCard({ device, showDelete = false }) {
  const { home, role, togglePower, adjustSetting, connect, reset, simulateFault, deleteDevice } = useHome();
  const template = getTemplate(device);
  const room = home.rooms.find((item) => item.id === device.roomId);

  const canPower = canControlDevice(role, device, 'power');
  const canAdjust = canControlDevice(role, device, 'adjust');
  const isAdmin = hasAbility(role, 'device.connect');
  const usable = device.connected && !device.fault && !home.emergency.active;
  const watts = Math.round(getWatts(device));

  const cardClass = ['device-card'];
  if (device.connected && device.power && !device.fault) cardClass.push('device-card-lit');
  if (device.fault) cardClass.push('device-card-fault');
  if (!device.connected) cardClass.push('device-card-offline');

  return (
    <article className={cardClass.join(' ')}>
      <header className="device-head">
        <span className="device-icon" aria-hidden="true">{template.icon}</span>
        <div className="device-title">
          <h3>{device.name}</h3>
          <p>
            {template.label} · {room ? room.name : 'No room'}
          </p>
        </div>
        <StatusBadge device={device} />
      </header>

      {device.fault && (
        <div className="fault-note">
          <p>{device.fault.reason}</p>
          {isAdmin ? (
            <button className="btn btn-primary" onClick={() => reset(device.id)}>Reset device</button>
          ) : (
            <small>Ask an Admin to reset it.</small>
          )}
        </div>
      )}

      {!device.connected && (
        <div className="connect-note">
          <p>This device is created but not linked to your home yet.</p>
          {isAdmin ? (
            <button className="btn btn-primary" onClick={() => connect(device.id)}>Connect</button>
          ) : (
            <small>Waiting for an Admin to connect it.</small>
          )}
        </div>
      )}

      {device.connected && (
        <>
          {!template.alwaysOn && (
            <div className="power-row">
              <button
                className={`power-switch ${device.power ? 'power-switch-on' : ''}`}
                role="switch"
                aria-checked={device.power}
                disabled={!canPower || !usable}
                onClick={() => togglePower(device.id, !device.power)}
              >
                <span className="power-knob" />
              </button>
              <span className="power-text">
                {device.power ? `${watts} W` : 'Off'}
                {device.power && template.autoStopMinutes && (
                  <small>
                    {' '}
                    · {prettyDuration(Math.max(0, template.autoStopMinutes(device.settings) - device.runMs / MINUTE))} left
                  </small>
                )}
              </span>
            </div>
          )}
          <DeviceControls
            device={device}
            template={template}
            disabled={!canAdjust || !device.connected || Boolean(device.fault) || home.emergency.active}
            onChange={(key, value) => adjustSetting(device.id, key, value)}
          />
        </>
      )}

      {isAdmin && (
        <footer className="device-foot">
          {device.connected && !device.fault && (
            <button className="btn btn-quiet" onClick={() => simulateFault(device.id)}>Simulate fault</button>
          )}
          {showDelete && (
            <button className="btn btn-quiet btn-quiet-danger" onClick={() => deleteDevice(device.id)}>Delete</button>
          )}
        </footer>
      )}
    </article>
  );
}
