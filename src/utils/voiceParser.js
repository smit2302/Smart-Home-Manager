import { getTemplate, getWatts } from './deviceTemplates.js';
import {
  activateEmergency,
  deactivateEmergency,
  changeSetting,
  currentLoadWatts,
  getWeeklyReport,
  powerDevice,
  switchGroup,
} from './homeEngine.js';
import { canControlDevice, hasAbility } from './permissions.js';
import { makeId } from './idMaker.js';

const DEVICE_WORDS = [
  { words: ['light', 'lights', 'lamp', 'lamps', 'bulb', 'bulbs'], test: (d) => getTemplate(d).family === 'light' },
  { words: ['fan', 'fans'], test: (d) => getTemplate(d).family === 'fan' },
  { words: ['thermostat'], test: (d) => d.type === 'thermostat' },
  { words: ['ac', 'air conditioner', 'air conditioning', 'aircon'], test: (d) => d.type === 'airConditioner' },
  { words: ['heater', 'heaters'], test: (d) => d.type === 'heater' },
  { words: ['tv', 'television'], test: (d) => d.type === 'television' },
  { words: ['washer', 'washing machine', 'laundry'], test: (d) => d.type === 'washingMachine' },
  { words: ['coffee', 'coffee maker'], test: (d) => d.type === 'coffeeMaker' },
];

const mentions = (text, word) => new RegExp(`\\b${word}\\b`).test(text);

function findTargets(home, text) {
  const byName = home.devices.filter((device) => device.name.length >= 3 && text.includes(device.name.toLowerCase()));
  if (byName.length) return byName;

  const rooms = home.rooms.filter((room) => text.includes(room.name.toLowerCase()));
  const matchedKinds = DEVICE_WORDS.filter((entry) => entry.words.some((word) => mentions(text, word)));
  const inRooms = (device) => (rooms.length ? rooms.some((room) => room.id === device.roomId) : true);

  if (matchedKinds.length) {
    return home.devices.filter((device) => matchedKinds.some((entry) => entry.test(device)) && inRooms(device));
  }
  if (rooms.length) return home.devices.filter((device) => inRooms(device) && !getTemplate(device).alwaysOn);
  if (/\b(everything|all devices|all appliances|whole house|entire house)\b/.test(text)) {
    return home.devices.filter((device) => !getTemplate(device).alwaysOn);
  }
  return [];
}

function nameList(devices) {
  const names = devices.map((device) => device.name);
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

export const VOICE_EXAMPLES = [
  'Turn off all lights',
  'Turn on the bedroom lamp',
  'Set thermostat to 22',
  'Set fan speed to high',
  'Activate Morning Routine',
  'Lock the doors',
  'What is on right now?',
  'How much energy did I use today?',
  'Emergency mode on',
];

// Runs a typed command against the household. Returns { ok, reply }.
export function executeVoiceCommand(home, rawText, { role }) {
  const text = rawText.toLowerCase().replace(/[.!?,]/g, ' ').replace(/\s+/g, ' ').trim();
  const wantsOff = /\b(off|stop|shut|disable|deactivate|end|cancel)\b/.test(text);
  const wantsOn = /\b(on|start|enable|activate|run|launch)\b/.test(text);

  const finish = (ok, reply) => {
    home.commandHistory.push({ id: makeId('cmd'), at: home.simNow, text: rawText.trim(), reply, ok });
    if (home.commandHistory.length > 40) home.commandHistory.shift();
    return { ok, reply };
  };

  if (!text) return { ok: false, reply: 'Type a command first.' };

  // Emergency mode
  if (/\bemergency\b/.test(text)) {
    if (!hasAbility(role, 'emergency.toggle')) return finish(false, 'Only an Admin can change emergency mode.');
    if (wantsOff && !/\bon\b/.test(text)) {
      return finish(true, deactivateEmergency(home).message);
    }
    return finish(true, activateEmergency(home, 'Voice command').message);
  }

  // Energy questions
  if (/(energy|electricity|power|kwh|consum)/.test(text) && /(how much|usage|used|use|report|total)/.test(text)) {
    const report = getWeeklyReport(home);
    const todayTotal = report.daily[report.daily.length - 1].kwh;
    return finish(
      true,
      `Today so far: ${todayTotal.toFixed(2)} kWh. Past seven days: ${report.totalKwh.toFixed(1)} kWh. Right now the house draws ${Math.round(currentLoadWatts(home))} W.`,
    );
  }

  // Status questions
  if (/(what|which|status|list)/.test(text) && /(on|running|status|active)/.test(text) && !wantsOff) {
    const running = home.devices.filter((device) => getWatts(device) > 0 && !getTemplate(device).alwaysOn);
    return finish(true, running.length ? `${running.length} running: ${nameList(running)}.` : 'Nothing is running right now.');
  }

  // Door locks
  if (/\b(lock|unlock)\b/.test(text) && /\b(door|doors|house|home)\b/.test(text)) {
    if (!hasAbility(role, 'device.adjust') || role === 'Child') return finish(false, 'Your role cannot change door locks.');
    const locks = home.devices.filter((device) => device.type === 'doorLock' && device.connected);
    if (!locks.length) return finish(false, 'No connected door locks were found.');
    const wantState = /\bunlock\b/.test(text) ? 'Unlocked' : 'Locked';
    locks.forEach((lock) => changeSetting(home, lock.id, 'lockState', wantState, 'voice'));
    return finish(true, `${wantState === 'Locked' ? 'Locked' : 'Unlocked'} ${nameList(locks)}.`);
  }

  // Device groups
  const group = home.groups.find((item) => text.includes(item.name.toLowerCase()));
  if (group) {
    const wantOn = !wantsOff;
    const result = switchGroup(home, group.id, wantOn, (device) => canControlDevice(role, device, 'power'));
    return finish(result.ok, result.message);
  }

  // Level words (fan speed, heater level)
  const levelWord = text.match(/\b(low|medium|high)\b/);
  if (levelWord && /(speed|fan|heater|level|heat)/.test(text)) {
    const level = levelWord[1][0].toUpperCase() + levelWord[1].slice(1);
    const targets = findTargets(home, text).filter((device) =>
      getTemplate(device).fields.some((field) => field.key === 'speed' || field.key === 'level'),
    );
    if (!targets.length) return finish(false, 'I could not find a fan or heater to change.');
    const allowed = targets.filter((device) => canControlDevice(role, device, 'adjust'));
    if (!allowed.length) return finish(false, 'Your role cannot adjust those devices.');
    allowed.forEach((device) => {
      const key = getTemplate(device).fields.find((field) => field.key === 'speed' || field.key === 'level').key;
      changeSetting(home, device.id, key, level, 'voice');
    });
    return finish(true, `Set ${nameList(allowed)} to ${level}.`);
  }

  // Numeric settings
  const number = text.match(/\b(\d{1,3})\b/);
  if (number && /\b(set|change|adjust|make|dim|raise|lower|turn)\b/.test(text) && !/\b(on|off)\b/.test(text.replace(/\bto\b/, ''))) {
    const value = Number(number[1]);
    let key = 'targetTemp';
    if (/(brightness|dim|lamp|light)/.test(text)) key = 'brightness';
    if (/(volume|tv|television)/.test(text)) key = 'volume';

    let targets = findTargets(home, text);
    if (!targets.length && key === 'targetTemp') targets = home.devices.filter((device) => device.settings.targetTemp !== undefined);
    targets = targets.filter((device) => getTemplate(device).fields.some((field) => field.key === key));
    if (!targets.length) return finish(false, 'I could not find a device with that setting.');

    const allowed = targets.filter((device) => canControlDevice(role, device, 'adjust'));
    if (!allowed.length) return finish(false, 'Your role cannot adjust those devices.');
    const results = allowed.map((device) => changeSetting(home, device.id, key, value, 'voice'));
    const worked = allowed.filter((_, index) => results[index].ok);
    if (!worked.length) return finish(false, results[0].message);
    return finish(true, `Updated ${nameList(worked)} to ${value}.`);
  }

  // Plain on / off
  if (wantsOff || wantsOn) {
    const turnOn = wantsOff ? false : true;
    const targets = findTargets(home, text);
    if (!targets.length) return finish(false, 'I could not tell which device you meant. Try naming a room or device.');
    const allowed = targets.filter((device) => canControlDevice(role, device, 'power'));
    if (!allowed.length) return finish(false, 'Your role is not allowed to switch those devices.');

    const done = [];
    let firstProblem = '';
    allowed.forEach((device) => {
      const result = powerDevice(home, device.id, turnOn, 'voice');
      if (result.ok) done.push(device);
      else if (!firstProblem) firstProblem = result.message;
    });
    if (!done.length) return finish(false, firstProblem);
    const skipped = targets.length - done.length;
    const tail = skipped ? ` (${skipped} skipped)` : '';
    return finish(true, `Turned ${turnOn ? 'on' : 'off'} ${nameList(done)}${tail}.`);
  }

  return finish(false, 'Sorry, I did not understand that. Try "turn off all lights" or "set thermostat to 22".');
}
