import { useState } from 'react';
import { useHome } from '../context/HomeContext.jsx';
import { FAMILY_LABELS, DEVICE_TEMPLATES } from '../utils/deviceTemplates.js';
import { describeAction } from '../utils/homeEngine.js';
import { hasAbility } from '../utils/permissions.js';
import { WEEKDAY_LABELS, prettyDateTime, prettyTime } from '../utils/timeHelpers.js';

const blankAction = () => ({ target: 'family:light', command: 'off', value: 24 });

export default function RoutinesPage() {
  const { home, role, saveRoutine, toggleRoutine, deleteRoutine, runRoutineNow } = useHome();
  const canManage = hasAbility(role, 'routine.manage');

  const [routineName, setRoutineName] = useState('');
  const [time, setTime] = useState('22:00');
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [actions, setActions] = useState([blankAction()]);

  const usedFamilies = [...new Set(Object.values(DEVICE_TEMPLATES).map((item) => item.family))];

  const flipDay = (day) => setDays(days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort());
  const editAction = (index, patch) => setActions(actions.map((item, position) => (position === index ? { ...item, ...patch } : item)));

  function submitRoutine(event) {
    event.preventDefault();
    const cleanActions = actions.map((item) =>
      item.command === 'set'
        ? { target: item.target, command: 'set', key: 'targetTemp', value: Number(item.value) }
        : { target: item.target, command: item.command },
    );
    const result = saveRoutine({ name: routineName, time, days, actions: cleanActions });
    if (result.ok) {
      setRoutineName('');
      setActions([blankAction()]);
    }
  }

  return (
    <>
      <header className="page-head">
        <h2>Routines</h2>
        <p>Schedule changes that run on their own. Routines follow the simulated home clock.</p>
      </header>

      {canManage && (
        <form className="panel" onSubmit={submitRoutine}>
          <h3>New routine</h3>
          <div className="form-grid">
            <label className="field">
              <span>Routine name</span>
              <input value={routineName} onChange={(event) => setRoutineName(event.target.value)} placeholder="Lights out at 10 PM" />
            </label>
            <label className="field">
              <span>Runs at</span>
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
            </label>
          </div>

          <div className="day-picker" role="group" aria-label="Days of the week">
            {WEEKDAY_LABELS.map((label, day) => (
              <button type="button" key={label} className={days.includes(day) ? 'segment segment-active' : 'segment'} onClick={() => flipDay(day)}>
                {label}
              </button>
            ))}
          </div>

          <div className="action-stack">
            {actions.map((item, index) => (
              <div className="action-row" key={index}>
                <select value={item.command} onChange={(event) => editAction(index, { command: event.target.value })} aria-label="What to do">
                  <option value="off">Turn off</option>
                  <option value="on">Turn on</option>
                  <option value="set">Set temperature to</option>
                </select>
                {item.command === 'set' && (
                  <input type="number" min="10" max="40" value={item.value} onChange={(event) => editAction(index, { value: event.target.value })} aria-label="Temperature in Celsius" />
                )}
                <select value={item.target} onChange={(event) => editAction(index, { target: event.target.value })} aria-label="Which devices">
                  <option value="everything">Every device</option>
                  <optgroup label="By kind">
                    {usedFamilies.map((family) => (
                      <option key={family} value={`family:${family}`}>All {FAMILY_LABELS[family].toLowerCase()}</option>
                    ))}
                  </optgroup>
                  {home.rooms.length > 0 && (
                    <optgroup label="Rooms">
                      {home.rooms.map((room) => (
                        <option key={room.id} value={`room:${room.id}`}>{room.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {home.groups.length > 0 && (
                    <optgroup label="Groups">
                      {home.groups.map((group) => (
                        <option key={group.id} value={`group:${group.id}`}>{group.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {home.devices.length > 0 && (
                    <optgroup label="Single device">
                      {home.devices.map((device) => (
                        <option key={device.id} value={`device:${device.id}`}>{device.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {actions.length > 1 && (
                  <button type="button" className="btn btn-quiet" onClick={() => setActions(actions.filter((_, position) => position !== index))}>Remove</button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-quiet" onClick={() => setActions([...actions, blankAction()])}>Add another action</button>
          </div>

          <button className="btn btn-primary">Save routine</button>
        </form>
      )}

      <div className="stack">
        {home.routines.length === 0 && <p className="muted">No routines yet.</p>}
        {home.routines.map((routine) => (
          <article className={`panel routine-card ${routine.enabled ? '' : 'routine-paused'}`} key={routine.id}>
            <header className="panel-head">
              <div>
                <h3>{routine.name}</h3>
                <p className="muted">
                  {prettyTime(routine.time)} · {routine.days.length === 7 ? 'Every day' : routine.days.map((day) => WEEKDAY_LABELS[day]).join(', ')}
                </p>
              </div>
              <span className={`badge ${routine.enabled ? 'badge-on' : 'badge-offline'}`}>{routine.enabled ? 'Active' : 'Paused'}</span>
            </header>
            <ul className="bullet-list">
              {routine.actions.map((action, index) => (
                <li key={index}>{describeAction(home, action)}</li>
              ))}
            </ul>
            <footer className="device-foot">
              <small className="muted">{routine.lastRunAt ? `Last ran ${prettyDateTime(routine.lastRunAt)}` : 'Has not run yet'}</small>
              {canManage && (
                <div className="row-gap">
                  <button className="btn btn-quiet" onClick={() => runRoutineNow(routine.id)}>Run now</button>
                  <button className="btn btn-quiet" onClick={() => toggleRoutine(routine.id)}>{routine.enabled ? 'Pause' : 'Resume'}</button>
                  <button className="btn btn-quiet btn-quiet-danger" onClick={() => deleteRoutine(routine.id)}>Delete</button>
                </div>
              )}
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}
