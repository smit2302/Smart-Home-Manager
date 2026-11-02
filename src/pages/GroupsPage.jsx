import { useState } from 'react';
import { useHome } from '../context/HomeContext.jsx';
import { getTemplate } from '../utils/deviceTemplates.js';
import { hasAbility } from '../utils/permissions.js';

export default function GroupsPage() {
  const { home, role, saveGroup, deleteGroup, switchDeviceGroup } = useHome();
  const [groupName, setGroupName] = useState('');
  const [picked, setPicked] = useState([]);
  const canManage = hasAbility(role, 'group.manage');

  const flipDevice = (deviceId) =>
    setPicked(picked.includes(deviceId) ? picked.filter((id) => id !== deviceId) : [...picked, deviceId]);

  return (
    <>
      <header className="page-head">
        <h2>Device groups</h2>
        <p>Bundle devices that belong together, like everything you start in the morning, and switch them with one tap.</p>
      </header>

      {canManage && (
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            if (saveGroup(groupName, picked).ok) {
              setGroupName('');
              setPicked([]);
            }
          }}
        >
          <h3>New group</h3>
          <label className="field">
            <span>Group name</span>
            <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Morning Routine" />
          </label>
          <fieldset className="check-grid">
            <legend>Devices in this group</legend>
            {home.devices
              .filter((device) => !getTemplate(device).alwaysOn)
              .map((device) => (
                <label key={device.id} className="check-item">
                  <input type="checkbox" checked={picked.includes(device.id)} onChange={() => flipDevice(device.id)} />
                  {getTemplate(device).icon} {device.name}
                </label>
              ))}
          </fieldset>
          <button className="btn btn-primary">Create group</button>
        </form>
      )}

      <div className="room-grid">
        {home.groups.length === 0 && <p className="muted">No groups yet.</p>}
        {home.groups.map((group) => {
          const members = home.devices.filter((device) => group.deviceIds.includes(device.id));
          return (
            <section className="panel" key={group.id}>
              <header className="panel-head">
                <h3>{group.name}</h3>
                {canManage && <button className="btn btn-quiet btn-quiet-danger" onClick={() => deleteGroup(group.id)}>Delete</button>}
              </header>
              <div className="chip-row">
                {members.map((device) => (
                  <span className="chip" key={device.id}>{getTemplate(device).icon} {device.name}</span>
                ))}
              </div>
              <div className="row-gap">
                <button className="btn btn-primary" onClick={() => switchDeviceGroup(group.id, true)}>Switch all on</button>
                <button className="btn btn-quiet" onClick={() => switchDeviceGroup(group.id, false)}>Switch all off</button>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
