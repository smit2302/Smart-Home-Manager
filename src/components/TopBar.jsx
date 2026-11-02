import { useHome } from '../context/HomeContext.jsx';
import { hasAbility } from '../utils/permissions.js';
import { prettyDateTime } from '../utils/timeHelpers.js';

const SPEED_CHOICES = [
  { value: 0, label: 'Paused' },
  { value: 1, label: 'Real time' },
  { value: 60, label: '1 min per second' },
  { value: 600, label: '10 min per second' },
  { value: 3600, label: '1 hour per second' },
];

export default function TopBar() {
  const { home, account, role, logout, setClockSpeed, skipAhead, setEmergency } = useHome();
  const isAdmin = hasAbility(role, 'clock.control');

  return (
    <header className="topbar">
      <div className="topbar-home">
        <h1>{home.name}</h1>
        <span className="clock-chip" title="Simulated time inside your home">
          {prettyDateTime(home.simNow)}
        </span>
      </div>

      <div className="topbar-tools">
        {isAdmin && (
          <>
            <label className="inline-field">
              <span>Clock speed</span>
              <select value={home.clockSpeed} onChange={(event) => setClockSpeed(event.target.value)}>
                {SPEED_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="skip-group" role="group" aria-label="Skip ahead">
              <button className="btn btn-quiet" onClick={() => skipAhead(60)}>+1 h</button>
              <button className="btn btn-quiet" onClick={() => skipAhead(360)}>+6 h</button>
              <button className="btn btn-quiet" onClick={() => skipAhead(1440)}>+1 day</button>
            </div>
            <button
              className={`btn ${home.emergency.active ? 'btn-good' : 'btn-danger'}`}
              onClick={() => setEmergency(!home.emergency.active)}
            >
              {home.emergency.active ? 'End emergency' : 'Emergency mode'}
            </button>
          </>
        )}
        <div className="who">
          <span>
            {account.name}
            <small>{role}</small>
          </span>
          <button className="btn btn-quiet" onClick={logout}>Log out</button>
        </div>
      </div>
    </header>
  );
}
