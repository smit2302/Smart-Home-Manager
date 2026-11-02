import {
  DEVICE_TEMPLATES,
  FAMILY_LABELS,
  getTemplate,
  getFieldRange,
  getWatts,
  isDrawingPower,
  labelForSettingKey,
} from './deviceTemplates.js';
import { makeId, makeInviteCode } from './idMaker.js';
import { MINUTE, HOUR, DAY, startOfDay, dateKey, lastSevenDays } from './timeHelpers.js';

const MAX_ALERTS = 120;
const MAX_EVENTS = 600;
const SIM_STEP = 30 * MINUTE;
export const NIGHT_ENDS_AT_HOUR = 5;
export const COST_PER_KWH = 8; // rupees, used only for the estimated bill

/* ------------------------------------------------------------------ */
/* Household + device creation                                         */
/* ------------------------------------------------------------------ */

export function createEmptyHousehold(name, ownerId) {
  return {
    id: makeId('home'),
    name,
    ownerId,
    inviteCode: makeInviteCode(),
    simNow: Date.now(),
    clockSpeed: 60,
    rooms: [],
    devices: [],
    routines: [],
    groups: [],
    usageByDay: {},
    eventLog: [],
    alerts: [],
    commandHistory: [],
    emergency: { active: false, since: null, by: null },
  };
}

export function buildDevice(typeKey, name, roomId, limitOverrides = {}) {
  const template = DEVICE_TEMPLATES[typeKey];
  const limitDefaults = {};
  (template.configurable || []).forEach((item) => {
    limitDefaults[item.key] = item.default;
  });
  return {
    id: makeId('dev'),
    type: typeKey,
    name,
    roomId: roomId || null,
    connected: false,
    power: false,
    fault: null,
    settings: { ...template.defaults },
    limits: { ...limitDefaults, ...limitOverrides },
    runMs: 0,
    lifetimeKwh: 0,
  };
}

export function findDevice(home, deviceId) {
  return home.devices.find((device) => device.id === deviceId);
}

export function pushAlert(home, { level = 'info', title, message, deviceId = null }) {
  home.alerts.unshift({
    id: makeId('alert'),
    at: home.simNow,
    level,
    title,
    message,
    deviceId,
    acknowledged: false,
  });
  if (home.alerts.length > MAX_ALERTS) home.alerts.length = MAX_ALERTS;
}

export function logEvent(home, entry) {
  home.eventLog.push({ id: makeId('evt'), at: home.simNow, ...entry });
  if (home.eventLog.length > MAX_EVENTS) home.eventLog.shift();
}

/* ------------------------------------------------------------------ */
/* Device control                                                      */
/* ------------------------------------------------------------------ */

function refuse(message) {
  return { ok: false, message };
}

function accept(message) {
  return { ok: true, message };
}

export function connectDevice(home, deviceId) {
  const device = findDevice(home, deviceId);
  if (!device) return refuse('That device no longer exists.');
  if (device.connected) return accept(`${device.name} is already connected.`);
  device.connected = true;
  if (getTemplate(device).alwaysOn) device.power = true;
  return accept(`${device.name} connected and ready to control.`);
}

export function powerDevice(home, deviceId, wantOn, source = 'manual') {
  const device = findDevice(home, deviceId);
  if (!device) return refuse('That device no longer exists.');
  if (!device.connected) return refuse(`${device.name} is not connected yet. Press Connect first.`);
  if (device.fault) return refuse(`${device.name} is malfunctioning. Reset it before using it.`);
  if (home.emergency.active && wantOn) return refuse('Emergency mode is on. Turn it off before switching devices on.');
  if (device.power === wantOn) return accept(`${device.name} is already ${wantOn ? 'on' : 'off'}.`);

  const template = getTemplate(device);
  if (wantOn && template.failChance && source !== 'demo' && Math.random() < template.failChance) {
    device.fault = { reason: `${device.name} did not respond to the start command.`, at: home.simNow };
    pushAlert(home, {
      level: 'critical',
      title: `${device.name} failed to respond`,
      message: 'The start command timed out. Reset the device and try again.',
      deviceId: device.id,
    });
    return refuse(`${device.name} did not respond. A malfunction alert was raised.`);
  }

  device.power = wantOn;
  device.runMs = 0;
  logEvent(home, { deviceId: device.id, kind: 'power', value: wantOn, source });
  return accept(`${device.name} turned ${wantOn ? 'on' : 'off'}.`);
}

export function changeSetting(home, deviceId, key, rawValue, source = 'manual') {
  const device = findDevice(home, deviceId);
  if (!device) return refuse('That device no longer exists.');
  if (!device.connected) return refuse(`${device.name} is not connected yet.`);
  if (device.fault) return refuse(`${device.name} is malfunctioning. Reset it first.`);
  if (home.emergency.active) return refuse('Emergency mode is on. Settings are locked.');

  const field = getTemplate(device).fields.find((item) => item.key === key);
  if (!field) return refuse(`${device.name} has no "${key}" setting.`);

  let value = rawValue;
  if (field.kind === 'range') {
    const { min, max } = getFieldRange(device, field);
    value = Math.min(max, Math.max(min, Math.round(Number(rawValue))));
    if (Number.isNaN(value)) return refuse('That value is not a number.');
  } else if (!field.options.includes(value)) {
    return refuse(`${value} is not an option for ${field.label}.`);
  }

  if (device.settings[key] === value) return accept(`${device.name} already uses that setting.`);
  device.settings[key] = value;
  logEvent(home, { deviceId: device.id, kind: 'setting', key, value, source });
  return accept(`${device.name}: ${field.label} is now ${value}${field.unit || ''}.`);
}

export function raiseFault(home, deviceId, reason, title) {
  const device = findDevice(home, deviceId);
  if (!device) return;
  device.fault = { reason, at: home.simNow };
  device.power = false;
  device.runMs = 0;
  pushAlert(home, {
    level: 'critical',
    title: title || `${device.name} is malfunctioning`,
    message: reason,
    deviceId: device.id,
  });
}

export function resetDevice(home, deviceId) {
  const device = findDevice(home, deviceId);
  if (!device) return refuse('That device no longer exists.');
  device.fault = null;
  device.runMs = 0;
  pushAlert(home, { level: 'info', title: `${device.name} was reset`, message: 'The device is back in standby.', deviceId });
  return accept(`${device.name} was reset.`);
}

export function removeDevice(home, deviceId) {
  home.devices = home.devices.filter((device) => device.id !== deviceId);
  home.groups.forEach((group) => {
    group.deviceIds = group.deviceIds.filter((id) => id !== deviceId);
  });
}

/* ------------------------------------------------------------------ */
/* Targets, routines, groups                                           */
/* ------------------------------------------------------------------ */

export function resolveTargets(home, target) {
  const [kind, id] = target.split(':');
  const controllable = home.devices.filter((device) => !getTemplate(device).alwaysOn);
  if (kind === 'everything') return controllable;
  if (kind === 'family') return home.devices.filter((device) => getTemplate(device).family === id);
  if (kind === 'room') return home.devices.filter((device) => device.roomId === id);
  if (kind === 'device') return home.devices.filter((device) => device.id === id);
  if (kind === 'group') {
    const group = home.groups.find((item) => item.id === id);
    return group ? home.devices.filter((device) => group.deviceIds.includes(device.id)) : [];
  }
  return [];
}

export function describeTarget(home, target) {
  const [kind, id] = target.split(':');
  if (kind === 'everything') return 'Every device';
  if (kind === 'family') return `All ${(FAMILY_LABELS[id] || id).toLowerCase()}`;
  if (kind === 'room') return `Room: ${home.rooms.find((room) => room.id === id)?.name || 'removed room'}`;
  if (kind === 'device') return home.devices.find((device) => device.id === id)?.name || 'removed device';
  if (kind === 'group') return `Group: ${home.groups.find((group) => group.id === id)?.name || 'removed group'}`;
  return target;
}

export function describeAction(home, action) {
  const what =
    action.command === 'on'
      ? 'Turn on'
      : action.command === 'off'
        ? 'Turn off'
        : `Set ${labelForSettingKey(action.key).toLowerCase()} to ${action.value}`;
  return `${what} · ${describeTarget(home, action.target)}`;
}

export function applyAction(home, action, source) {
  const devices = resolveTargets(home, action.target);
  let touched = 0;
  devices.forEach((device) => {
    let result;
    if (action.command === 'on' || action.command === 'off') {
      result = powerDevice(home, device.id, action.command === 'on', source);
    } else if (getTemplate(device).fields.some((field) => field.key === action.key)) {
      result = changeSetting(home, device.id, action.key, action.value, source);
    }
    if (result && result.ok) touched += 1;
  });
  return touched;
}

export function runRoutine(home, routine, source = 'routine') {
  if (home.emergency.active) return 0;
  let touched = 0;
  routine.actions.forEach((action) => {
    touched += applyAction(home, action, source);
  });
  routine.lastRunAt = home.simNow;
  pushAlert(home, {
    level: 'info',
    title: `Routine ran: ${routine.name}`,
    message: `${touched} device change${touched === 1 ? '' : 's'} applied.`,
  });
  return touched;
}

export function switchGroup(home, groupId, wantOn, canTouch = () => true) {
  const group = home.groups.find((item) => item.id === groupId);
  if (!group) return refuse('That group no longer exists.');
  let changed = 0;
  let skipped = 0;
  home.devices
    .filter((device) => group.deviceIds.includes(device.id))
    .forEach((device) => {
      if (!canTouch(device)) {
        skipped += 1;
        return;
      }
      const result = powerDevice(home, device.id, wantOn, 'group');
      if (result.ok) changed += 1;
      else skipped += 1;
    });
  const note = skipped ? ` ${skipped} skipped (disconnected, faulty or not allowed).` : '';
  return accept(`${group.name}: ${changed} device${changed === 1 ? '' : 's'} switched ${wantOn ? 'on' : 'off'}.${note}`);
}

/* ------------------------------------------------------------------ */
/* Emergency mode                                                      */
/* ------------------------------------------------------------------ */

export function activateEmergency(home, byName) {
  let switchedOff = 0;
  let locked = 0;
  home.devices.forEach((device) => {
    const template = getTemplate(device);
    if (device.connected && template.alwaysOn) {
      if (device.settings.lockState !== 'Locked') {
        device.settings.lockState = 'Locked';
        locked += 1;
      }
    } else if (device.connected && device.power) {
      device.power = false;
      device.runMs = 0;
      switchedOff += 1;
      logEvent(home, { deviceId: device.id, kind: 'power', value: false, source: 'emergency' });
    }
  });
  home.emergency = { active: true, since: home.simNow, by: byName };
  pushAlert(home, {
    level: 'critical',
    title: 'Emergency mode activated',
    message: `${switchedOff} appliance${switchedOff === 1 ? '' : 's'} switched off and all virtual doors locked.`,
  });
  return accept('Emergency mode on. All appliances are off and the doors are locked.');
}

export function deactivateEmergency(home) {
  home.emergency = { active: false, since: null, by: null };
  pushAlert(home, { level: 'info', title: 'Emergency mode ended', message: 'Devices can be switched on again.' });
  return accept('Emergency mode is off. Devices are available again.');
}

/* ------------------------------------------------------------------ */
/* Simulation clock                                                    */
/* ------------------------------------------------------------------ */

function bucketFor(home, dayKey, deviceId) {
  if (!home.usageByDay[dayKey]) home.usageByDay[dayKey] = {};
  if (!home.usageByDay[dayKey][deviceId]) {
    home.usageByDay[dayKey][deviceId] = { kwh: 0, minutes: 0, nightKwh: 0, nightMinutes: 0 };
  }
  return home.usageByDay[dayKey][deviceId];
}

function stepClock(home, stepMs) {
  const periodStart = home.simNow;
  const periodEnd = periodStart + stepMs;
  home.simNow = periodEnd;

  const hoursPassed = stepMs / HOUR;
  const minutesPassed = stepMs / MINUTE;
  const dayKey = dateKey(periodEnd);
  const isNight = new Date(periodEnd).getHours() < NIGHT_ENDS_AT_HOUR;

  home.devices.forEach((device) => {
    if (!isDrawingPower(device)) return;
    const template = getTemplate(device);
    const kwh = (template.watts(device.settings) / 1000) * hoursPassed;

    const bucket = bucketFor(home, dayKey, device.id);
    bucket.kwh += kwh;
    bucket.minutes += minutesPassed;
    if (isNight) {
      bucket.nightKwh += kwh;
      bucket.nightMinutes += minutesPassed;
    }
    device.lifetimeKwh = (device.lifetimeKwh || 0) + kwh;

    if (template.alwaysOn) return;
    device.runMs += stepMs;

    const cycleMinutes = template.autoStopMinutes ? template.autoStopMinutes(device.settings) : null;
    if (cycleMinutes && device.runMs >= cycleMinutes * MINUTE) {
      device.power = false;
      device.runMs = 0;
      logEvent(home, { deviceId: device.id, kind: 'power', value: false, source: 'auto' });
      pushAlert(home, { level: 'info', title: `${device.name} finished`, message: 'The cycle is complete.', deviceId: device.id });
      return;
    }

    if (template.maxRunHours && device.runMs >= template.maxRunHours * HOUR) {
      raiseFault(
        home,
        device.id,
        `${device.name} has been running for more than ${template.maxRunHours} hours without a break. This looks abnormal, so it was switched off. Please reset the device.`,
        `${device.name} ran too long`,
      );
    }
  });

  if (home.emergency.active) return;

  home.routines.forEach((routine) => {
    if (!routine.enabled) return;
    const [hour, minute] = routine.time.split(':').map(Number);
    const cursor = new Date(startOfDay(periodStart));
    while (cursor.getTime() <= periodEnd) {
      const triggerAt = cursor.getTime() + (hour * 60 + minute) * MINUTE;
      if (triggerAt > periodStart && triggerAt <= periodEnd && routine.days.includes(cursor.getDay())) {
        runRoutine(home, routine);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });
}

export function advanceClock(home, totalMs) {
  let remaining = totalMs;
  while (remaining > 0) {
    const slice = Math.min(SIM_STEP, remaining);
    stepClock(home, slice);
    remaining -= slice;
  }
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export function currentLoadWatts(home) {
  return home.devices.reduce((sum, device) => sum + getWatts(device), 0);
}

export function getWeeklyReport(home) {
  const days = lastSevenDays(home.simNow);
  const perDevice = home.devices.map((device) => {
    const totals = { kwh: 0, minutes: 0, nightKwh: 0, nightMinutes: 0 };
    days.forEach(({ key }) => {
      const bucket = home.usageByDay[key]?.[device.id];
      if (!bucket) return;
      totals.kwh += bucket.kwh;
      totals.minutes += bucket.minutes;
      totals.nightKwh += bucket.nightKwh;
      totals.nightMinutes += bucket.nightMinutes;
    });
    return { device, ...totals };
  });

  const daily = days.map(({ key, label }) => {
    const dayBuckets = home.usageByDay[key] || {};
    const kwh = Object.values(dayBuckets).reduce((sum, bucket) => sum + bucket.kwh, 0);
    return { key, label, kwh };
  });

  const totalKwh = perDevice.reduce((sum, row) => sum + row.kwh, 0);
  perDevice.sort((a, b) => b.kwh - a.kwh);
  return { perDevice, daily, totalKwh };
}

/* ------------------------------------------------------------------ */
/* Demo data                                                           */
/* ------------------------------------------------------------------ */

function seededRandom(seed) {
  let current = seed;
  return () => {
    current = (current * 9301 + 49297) % 233280;
    return current / 233280;
  };
}

export function loadDemoSetup(home) {
  const living = { id: makeId('room'), name: 'Living Room' };
  const bedroom = { id: makeId('room'), name: 'Bedroom' };
  const kitchen = { id: makeId('room'), name: 'Kitchen' };
  home.rooms.push(living, bedroom, kitchen);

  const bedsideLamp = buildDevice('lamp', 'Bedside Lamp', bedroom.id);
  const bedroomAc = buildDevice('airConditioner', 'Bedroom AC', bedroom.id);
  const winterHeater = buildDevice('heater', 'Winter Heater', bedroom.id);
  const hallFan = buildDevice('ceilingFan', 'Hall Ceiling Fan', living.id);
  const hallThermostat = buildDevice('thermostat', 'Hall Thermostat', living.id);
  const livingTv = buildDevice('television', 'Living Room TV', living.id);
  const frontDoor = buildDevice('doorLock', 'Front Door Lock', living.id);
  const washer = buildDevice('washingMachine', 'Washing Machine', kitchen.id);
  const coffee = buildDevice('coffeeMaker', 'Coffee Maker', kitchen.id);
  const kitchenLamp = buildDevice('lamp', 'Kitchen Lamp', kitchen.id);

  bedroomAc.settings.targetTemp = 22;
  hallThermostat.settings.targetTemp = 22;
  const everything = [bedsideLamp, bedroomAc, winterHeater, hallFan, hallThermostat, livingTv, frontDoor, washer, coffee, kitchenLamp];
  everything.forEach((device) => {
    device.connected = true;
    if (getTemplate(device).alwaysOn) device.power = true;
  });
  home.devices.push(...everything);

  home.groups.push({
    id: makeId('group'),
    name: 'Morning Routine',
    deviceIds: [coffee.id, kitchenLamp.id, livingTv.id],
  });

  home.routines.push(
    {
      id: makeId('routine'),
      name: 'Lights and fans off at 10 PM',
      time: '22:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      enabled: true,
      lastRunAt: null,
      actions: [
        { target: 'family:light', command: 'off' },
        { target: 'family:fan', command: 'off' },
      ],
    },
    {
      id: makeId('routine'),
      name: 'Lower thermostat at 8 AM',
      time: '08:00',
      days: [1, 2, 3, 4, 5],
      enabled: true,
      lastRunAt: null,
      actions: [{ target: `device:${hallThermostat.id}`, command: 'set', key: 'targetTemp', value: 21 }],
    },
  );

  // A week of simulated history so the energy report and predictions have something to read.
  const random = seededRandom(42);
  const habits = [
    { device: bedroomAc, avgMinutes: 190, nightShare: 0.4 },
    { device: hallFan, avgMinutes: 420, nightShare: 0.3 },
    { device: bedsideLamp, avgMinutes: 240, nightShare: 0.12 },
    { device: livingTv, avgMinutes: 150, nightShare: 0.06 },
    { device: hallThermostat, avgMinutes: 180, nightShare: 0 },
    { device: washer, avgMinutes: 45, nightShare: 0 },
    { device: coffee, avgMinutes: 8, nightShare: 0 },
    { device: kitchenLamp, avgMinutes: 200, nightShare: 0 },
  ];
  const today = startOfDay(home.simNow);
  for (let daysBack = 1; daysBack <= 6; daysBack += 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - daysBack);
    const key = dateKey(day.getTime());
    habits.forEach(({ device, avgMinutes, nightShare }) => {
      const minutes = Math.round(avgMinutes * (0.8 + random() * 0.4));
      const nightMinutes = Math.round(minutes * nightShare * (0.8 + random() * 0.4));
      const watts = getTemplate(device).watts(device.settings);
      const bucket = bucketFor(home, key, device.id);
      bucket.minutes = minutes;
      bucket.nightMinutes = nightMinutes;
      bucket.kwh = (watts / 60000) * minutes;
      bucket.nightKwh = (watts / 60000) * nightMinutes;
    });
  }

  // Repeating manual actions, so the habit finder has patterns to learn from.
  const pastEvent = (daysBack, minuteOfDay, entry) => {
    const day = new Date(today);
    day.setDate(day.getDate() - daysBack);
    home.eventLog.push({ id: makeId('evt'), at: day.getTime() + minuteOfDay * MINUTE, source: 'manual', ...entry });
  };
  for (let daysBack = 1; daysBack <= 6; daysBack += 1) {
    pastEvent(daysBack, 420 + Math.round(random() * 12), { deviceId: hallThermostat.id, kind: 'setting', key: 'targetTemp', value: 22 });
    if (daysBack <= 5) pastEvent(daysBack, 1380 + Math.round(random() * 18), { deviceId: bedsideLamp.id, kind: 'power', value: false });
    if (daysBack <= 4) pastEvent(daysBack, 1260 + Math.round(random() * 15), { deviceId: hallFan.id, kind: 'power', value: true });
  }
  home.eventLog.sort((a, b) => a.at - b.at);

  pushAlert(home, {
    level: 'info',
    title: 'Demo home loaded',
    message: 'Three rooms, ten connected devices and a week of simulated history are ready.',
  });
}
