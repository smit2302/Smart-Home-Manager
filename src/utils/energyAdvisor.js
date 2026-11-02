import { getTemplate, getWatts } from './deviceTemplates.js';
import { getWeeklyReport } from './homeEngine.js';
import { prettyDuration } from './timeHelpers.js';

const round1 = (value) => Math.round(value * 10) / 10;

// Turns the weekly usage numbers into plain-language saving ideas.
export function buildEfficiencyAdvice(home) {
  const report = getWeeklyReport(home);
  const advice = [];

  // 1. Appliances left running through the small hours
  const nightRuns = report.perDevice.filter(
    (row) => row.nightMinutes >= 120 && !getTemplate(row.device).alwaysOn,
  );
  if (nightRuns.length) {
    const saving = nightRuns.reduce((sum, row) => sum + row.nightKwh, 0);
    const names = nightRuns.map((row) => row.device.name).join(', ');
    advice.push({
      id: 'sleep-mode',
      title: 'Add a "Sleep mode" routine for the night',
      detail: `${names} kept running between midnight and 5 AM (about ${prettyDuration(
        nightRuns.reduce((sum, row) => sum + row.nightMinutes, 0),
      )} this week). Switching them off at 11:30 PM would save around ${round1(saving)} kWh a week.`,
      saving,
      fix: {
        kind: 'routine',
        label: 'Create Sleep mode',
        draft: {
          name: 'Sleep mode',
          time: '23:30',
          days: [0, 1, 2, 3, 4, 5, 6],
          actions: nightRuns.map((row) => ({ target: `device:${row.device.id}`, command: 'off' })),
        },
      },
    });
  }

  // 2. Air conditioners set colder than they need to be
  home.devices
    .filter((device) => device.type === 'airConditioner' && device.settings.targetTemp < 24)
    .forEach((device) => {
      const row = report.perDevice.find((item) => item.device.id === device.id);
      const colderBy = 24 - device.settings.targetTemp;
      const saving = row ? row.kwh * Math.min(0.4, colderBy * 0.06) / (1 + colderBy * 0.06) : 0;
      advice.push({
        id: `ac-setpoint-${device.id}`,
        title: `Raise ${device.name} to 24°C`,
        detail: `It is set to ${device.settings.targetTemp}°C. Each degree below 24°C adds roughly 6% to its power draw.`,
        saving,
        fix: { kind: 'setting', label: 'Set to 24°C', deviceId: device.id, key: 'targetTemp', value: 24 },
      });
    });

  // 3. Lamps burning at full blast
  report.perDevice
    .filter((row) => row.device.type === 'lamp' && row.device.settings.brightness > 80 && row.minutes > 600)
    .forEach((row) => {
      const saving = row.kwh * ((row.device.settings.brightness - 70) / row.device.settings.brightness);
      advice.push({
        id: `dim-${row.device.id}`,
        title: `Dim ${row.device.name} to 70%`,
        detail: 'It spent most of the week at high brightness. 70% is still comfortable and uses less power.',
        saving,
        fix: { kind: 'setting', label: 'Dim to 70%', deviceId: row.device.id, key: 'brightness', value: 70 },
      });
    });

  // 4. Heating and cooling at the same time in one room
  home.rooms.forEach((room) => {
    const inRoom = home.devices.filter((device) => device.roomId === room.id && getWatts(device) > 0);
    const heater = inRoom.find((device) => device.type === 'heater');
    const cooler = inRoom.find((device) => device.type === 'airConditioner' && device.settings.mode === 'Cool');
    if (heater && cooler) {
      advice.push({
        id: `conflict-${room.id}`,
        title: `${room.name}: heater and AC are both running`,
        detail: `${heater.name} and ${cooler.name} are working against each other. Turn one of them off.`,
        saving: 0,
        fix: { kind: 'power', label: `Turn off ${heater.name}`, deviceId: heater.id, wantOn: false },
      });
    }
  });

  // 5. One device dominating the bill
  const heaviest = report.perDevice[0];
  if (heaviest && report.totalKwh > 5 && heaviest.kwh / report.totalKwh >= 0.4) {
    advice.push({
      id: 'top-consumer',
      title: `${heaviest.device.name} uses most of your power`,
      detail: `${Math.round((heaviest.kwh / report.totalKwh) * 100)}% of this week's ${round1(report.totalKwh)} kWh came from it. Shorter run times here will make the biggest difference.`,
      saving: 0,
      fix: null,
    });
  }

  return advice.sort((a, b) => b.saving - a.saving);
}
