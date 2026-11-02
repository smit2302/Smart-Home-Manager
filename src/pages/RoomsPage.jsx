import { useState } from 'react';
import { useHome } from '../context/HomeContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { getTemplate } from '../utils/deviceTemplates.js';
import { hasAbility } from '../utils/permissions.js';

export default function RoomsPage() {
  const { home, role, addRoom, deleteRoom, assignDevice } = useHome();
  const [roomName, setRoomName] = useState('');
  const canManage = hasAbility(role, 'room.manage');
  const unassigned = home.devices.filter((device) => !device.roomId);

  return (
    <>
      <header className="page-head">
        <h2>Rooms</h2>
        <p>Group devices by where they live. Move a device between rooms from its dropdown.</p>
      </header>

      {canManage && (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (addRoom(roomName).ok) setRoomName('');
          }}
        >
          <input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="e.g. Bedroom" aria-label="Room name" />
          <button className="btn btn-primary">Add room</button>
        </form>
      )}

      <div className="room-grid">
        {home.rooms.map((room) => {
          const devices = home.devices.filter((device) => device.roomId === room.id);
          return (
            <section className="panel" key={room.id}>
              <header className="panel-head">
                <h3>{room.name}</h3>
                {canManage && (
                  <button className="btn btn-quiet btn-quiet-danger" onClick={() => deleteRoom(room.id)}>Remove room</button>
                )}
              </header>
              {devices.length === 0 && <p className="muted">No devices yet. Assign one from the list below or create a new device.</p>}
              <ul className="plain-list">
                {devices.map((device) => (
                  <li key={device.id}>
                    <span>{getTemplate(device).icon} {device.name}</span>
                    <StatusBadge device={device} />
                    {canManage && (
                      <select value={device.roomId || ''} onChange={(event) => assignDevice(device.id, event.target.value)} aria-label={`Room for ${device.name}`}>
                        <option value="">Unassigned</option>
                        {home.rooms.map((choice) => (
                          <option key={choice.id} value={choice.id}>{choice.name}</option>
                        ))}
                      </select>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {unassigned.length > 0 && (
          <section className="panel panel-dashed">
            <header className="panel-head"><h3>Not in a room</h3></header>
            <ul className="plain-list">
              {unassigned.map((device) => (
                <li key={device.id}>
                  <span>{getTemplate(device).icon} {device.name}</span>
                  <StatusBadge device={device} />
                  {canManage && (
                    <select value="" onChange={(event) => assignDevice(device.id, event.target.value)} aria-label={`Assign ${device.name} to a room`}>
                      <option value="">Assign to…</option>
                      {home.rooms.map((choice) => (
                        <option key={choice.id} value={choice.id}>{choice.name}</option>
                      ))}
                    </select>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {home.rooms.length === 0 && <p className="muted">No rooms yet. Add your first one above.</p>}
    </>
  );
}
