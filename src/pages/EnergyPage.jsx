import { useHome } from '../context/HomeContext.jsx';
import { COST_PER_KWH, currentLoadWatts, getWeeklyReport } from '../utils/homeEngine.js';
import { getTemplate, getWatts } from '../utils/deviceTemplates.js';
import { prettyDuration } from '../utils/timeHelpers.js';

export default function EnergyPage() {
  const { home } = useHome();
  const report = getWeeklyReport(home);
  const tallestDay = Math.max(0.1, ...report.daily.map((day) => day.kwh));
  const topDevice = report.perDevice[0];

  return (
    <>
      <header className="page-head">
        <h2>Energy usage</h2>
        <p>Simulated consumption for the past seven days of home time. Hours are counted while a device is on and connected.</p>
      </header>

      <section className="stat-row">
        <div className="stat">
          <span>Past 7 days</span>
          <strong>{report.totalKwh.toFixed(1)} kWh</strong>
          <small>Estimated bill ₹{Math.round(report.totalKwh * COST_PER_KWH)} at ₹{COST_PER_KWH}/kWh</small>
        </div>
        <div className="stat">
          <span>Right now</span>
          <strong>{Math.round(currentLoadWatts(home))} W</strong>
          <small>{home.devices.filter((device) => getWatts(device) > 0).length} devices drawing power</small>
        </div>
        <div className="stat">
          <span>Biggest consumer</span>
          <strong className="stat-text">{topDevice && topDevice.kwh > 0 ? topDevice.device.name : 'None yet'}</strong>
          <small>{topDevice && topDevice.kwh > 0 ? `${topDevice.kwh.toFixed(1)} kWh this week` : 'Turn something on to start tracking'}</small>
        </div>
      </section>

      <section className="panel">
        <h3>Daily consumption</h3>
        <div className="day-bars">
          {report.daily.map((day) => (
            <div className="day-bar" key={day.key}>
              <span className="day-bar-value">{day.kwh.toFixed(1)}</span>
              <div className="day-bar-track">
                <div className="day-bar-fill" style={{ height: `${(day.kwh / tallestDay) * 100}%` }} />
              </div>
              <span>{day.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel table-panel">
        <h3>By device</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Time on</th>
              <th>Energy</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {report.perDevice.map((row) => {
              const share = report.totalKwh ? (row.kwh / report.totalKwh) * 100 : 0;
              return (
                <tr key={row.device.id}>
                  <td>{getTemplate(row.device).icon} {row.device.name}</td>
                  <td>{prettyDuration(row.minutes)}</td>
                  <td>{row.kwh.toFixed(2)} kWh</td>
                  <td>
                    <div className="share-bar"><span style={{ width: `${share}%` }} /></div>
                    <small>{share.toFixed(0)}%</small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {report.perDevice.length === 0 && <p className="muted">No devices yet.</p>}
      </section>
    </>
  );
}
