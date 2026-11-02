const fanWatts = { Low: 35, Medium: 55, High: 75 };
const heaterWatts = { Low: 800, Medium: 1400, High: 2000 };
const washerWatts = { Quick: 400, Normal: 500, Heavy: 700 };
const washerMinutes = { Quick: 30, Normal: 60, Heavy: 90 };

export const FAMILY_LABELS = {
  light: 'Lights',
  fan: 'Fans',
  climate: 'Climate devices',
  appliance: 'Appliances',
  entertainment: 'Entertainment',
  security: 'Security',
};

export const DEVICE_TEMPLATES = {
  lamp: {
    label: 'Smart Lamp',
    icon: '💡',
    family: 'light',
    childSafe: true,
    maxRunHours: 48,
    defaults: { brightness: 70, colorMode: 'Warm' },
    fields: [
      { key: 'brightness', label: 'Brightness', kind: 'range', min: 0, max: 100, unit: '%' },
      { key: 'colorMode', label: 'Color mode', kind: 'choice', options: ['Warm', 'Cold'] },
    ],
    watts: (settings) => 1 + (settings.brightness / 100) * 9,
  },

  ceilingFan: {
    label: 'Ceiling Fan',
    icon: '🌀',
    family: 'fan',
    childSafe: true,
    maxRunHours: 36,
    defaults: { speed: 'Medium' },
    fields: [{ key: 'speed', label: 'Speed', kind: 'choice', options: ['Low', 'Medium', 'High'] }],
    watts: (settings) => fanWatts[settings.speed],
  },

  thermostat: {
    label: 'Thermostat',
    icon: '🌡️',
    family: 'climate',
    maxRunHours: null,
    configurable: [
      { key: 'minTemp', label: 'Lowest allowed (°C)', default: 18, min: 10, max: 25 },
      { key: 'maxTemp', label: 'Highest allowed (°C)', default: 30, min: 20, max: 40 },
    ],
    defaults: { targetTemp: 24, mode: 'Auto' },
    fields: [
      { key: 'targetTemp', label: 'Target temperature', kind: 'range', minFrom: 'minTemp', maxFrom: 'maxTemp', unit: '°C' },
      { key: 'mode', label: 'Mode', kind: 'choice', options: ['Heat', 'Cool', 'Auto'] },
    ],
    watts: (settings) => (settings.mode === 'Heat' ? 1000 : settings.mode === 'Cool' ? 900 : 700),
  },

  airConditioner: {
    label: 'Smart AC',
    icon: '❄️',
    family: 'climate',
    maxRunHours: 20,
    configurable: [
      { key: 'minTemp', label: 'Lowest allowed (°C)', default: 16, min: 10, max: 24 },
      { key: 'maxTemp', label: 'Highest allowed (°C)', default: 30, min: 22, max: 35 },
    ],
    defaults: { targetTemp: 24, mode: 'Cool', fanSpeed: 'Medium' },
    fields: [
      { key: 'targetTemp', label: 'Target temperature', kind: 'range', minFrom: 'minTemp', maxFrom: 'maxTemp', unit: '°C' },
      { key: 'mode', label: 'Mode', kind: 'choice', options: ['Cool', 'Dry', 'Fan Only'] },
      { key: 'fanSpeed', label: 'Fan speed', kind: 'choice', options: ['Low', 'Medium', 'High'] },
    ],
    // every degree below 24 °C costs roughly 6% more power
    watts: (settings) => {
      const base = settings.mode === 'Fan Only' ? 120 : settings.mode === 'Dry' ? 900 : 1500;
      const colderPenalty = 1 + (24 - settings.targetTemp) * 0.06;
      return base * Math.min(1.4, Math.max(0.7, colderPenalty));
    },
  },

  heater: {
    label: 'Room Heater',
    icon: '🔥',
    family: 'climate',
    maxRunHours: 24,
    defaults: { level: 'Medium' },
    fields: [{ key: 'level', label: 'Heat level', kind: 'choice', options: ['Low', 'Medium', 'High'] }],
    watts: (settings) => heaterWatts[settings.level],
  },

  washingMachine: {
    label: 'Washing Machine',
    icon: '🧺',
    family: 'appliance',
    failChance: 0.15,
    autoStopMinutes: (settings) => washerMinutes[settings.cycle],
    defaults: { cycle: 'Normal', spin: 'Medium' },
    fields: [
      { key: 'cycle', label: 'Wash cycle', kind: 'choice', options: ['Quick', 'Normal', 'Heavy'] },
      { key: 'spin', label: 'Spin speed', kind: 'choice', options: ['Low', 'Medium', 'High'] },
    ],
    watts: (settings) => washerWatts[settings.cycle],
  },

  television: {
    label: 'Smart TV',
    icon: '📺',
    family: 'entertainment',
    childSafe: true,
    maxRunHours: 16,
    defaults: { volume: 25, input: 'HDMI 1' },
    fields: [
      { key: 'volume', label: 'Volume', kind: 'range', min: 0, max: 100, unit: '' },
      { key: 'input', label: 'Input', kind: 'choice', options: ['HDMI 1', 'HDMI 2', 'Streaming'] },
    ],
    watts: () => 100,
  },

  coffeeMaker: {
    label: 'Coffee Maker',
    icon: '☕',
    family: 'appliance',
    autoStopMinutes: () => 8,
    defaults: { strength: 'Medium' },
    fields: [{ key: 'strength', label: 'Strength', kind: 'choice', options: ['Mild', 'Medium', 'Strong'] }],
    watts: () => 900,
  },

  doorLock: {
    label: 'Door Lock',
    icon: '🔒',
    family: 'security',
    alwaysOn: true,
    defaults: { lockState: 'Locked' },
    fields: [{ key: 'lockState', label: 'Lock', kind: 'choice', options: ['Locked', 'Unlocked'] }],
    watts: () => 2,
  },
};

export function getTemplate(device) {
  return DEVICE_TEMPLATES[device.type];
}

export function getFieldRange(device, field) {
  return {
    min: field.minFrom ? device.limits[field.minFrom] : field.min,
    max: field.maxFrom ? device.limits[field.maxFrom] : field.max,
  };
}

export function isDrawingPower(device) {
  return device.connected && device.power && !device.fault;
}

export function getWatts(device) {
  return isDrawingPower(device) ? getTemplate(device).watts(device.settings) : 0;
}

// The four states a person sees on the dashboard
export function getDeviceStatus(device) {
  if (!device.connected) return 'Disconnected';
  if (device.fault) return 'Malfunctioning';
  return device.power ? 'On' : 'In Standby';
}

export function labelForSettingKey(key) {
  for (const template of Object.values(DEVICE_TEMPLATES)) {
    const match = template.fields.find((field) => field.key === key);
    if (match) return match.label;
  }
  return key;
}
