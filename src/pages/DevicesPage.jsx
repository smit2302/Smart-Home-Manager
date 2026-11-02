import { useMemo, useState } from 'react';
import { useHome } from '../context/HomeContext.jsx';
import DeviceCard from '../components/DeviceCard.jsx';
import { DEVICE_TEMPLATES } from '../utils/deviceTemplates.js';
import { hasAbility } from '../utils/permissions.js';

function limitDefaultsFor(typeKey) {
  const values = {};
  (DEVICE_TEMPLATES[typeKey].configurable || []).forEach((item) => {
    values[item.key] = item.default;
  });
  return values;
}

export default function DevicesPage() {
  const { home, role, createDevice } = useHome();
  const [typeKey, setTypeKey] = useState('lamp');
  const [deviceName, setDeviceName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [limits, setLimits] = useState(limitDefaultsFor('lamp'));

  const template = DEVICE_TEMPLATES[typeKey];
  const featureSummary = useMemo(() => template.fields.map((field) => field.label).join(', '), [template]);

  function pickType(nextType) {
    setTypeKey(nextType);
    setLimits(limitDefaultsFor(nextType));
  }

  function submitDevice(event) {
    event.preventDefault();
    const result = createDevice({
      type: typeKey,
      name: deviceName || template.label,
      roomId: roomId || null,
      limits: template.configurable ? limits : undefined,
    });
    if (result.ok) setDeviceName('');
  }

  return (
    <>
      <header className="page-head">
        <h2>Devices</h2>
        <p>Create a simulated device, then press Connect to link it to your home. Only connected devices can be controlled.</p>
      </header>

      {hasAbility(role, 'device.create') && (
        <form className="panel device-form" onSubmit={submitDevice}>
          <h3>Create a device</h3>
          <div className="form-grid">
            <label className="field">
              <span>Device type</span>
              <select value={typeKey} onChange={(event) => pickType(event.target.value)}>
                {Object.entries(DEVICE_TEMPLATES).map(([key, item]) => (
                  <option key={key} value={key}>{item.icon} {item.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Name</span>
              <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder={template.label} />
            </label>
            <label className="field">
              <span>Room</span>
              <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
                <option value="">Decide later</option>
                {home.rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </label>
            {(template.configurable || []).map((item) => (
              <label className="field" key={item.key}>
                <span>{item.label}</span>
                <input
                  type="number"
                  min={item.min}
                  max={item.max}
                  value={limits[item.key]}
                  onChange={(event) => setLimits({ ...limits, [item.key]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <p className="muted">Features on this device: {featureSummary}.</p>
          <button className="btn btn-primary">Create device</button>
        </form>
      )}

      {home.devices.length === 0 ? (
        <p className="muted">No devices yet.</p>
      ) : (
        <div className="device-grid">
          {home.devices.map((device) => (
            <DeviceCard key={device.id} device={device} showDelete />
          ))}
        </div>
      )}
    </>
  );
}
