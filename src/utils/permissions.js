import { getTemplate } from './deviceTemplates.js';

export const ROLES = ['Admin', 'Guest', 'Child'];

export const ROLE_NOTES = {
  Admin: 'Full control: devices, rooms, routines, groups, emergency mode and members.',
  Guest: 'Can switch any device on or off. Cannot change settings, routines or delete anything.',
  Child: 'Can switch on/off and adjust only child-safe devices (lamp, fan, TV).',
};

const abilitiesByRole = {
  Admin: ['*'],
  Guest: ['device.power', 'voice.use'],
  Child: ['device.power', 'device.adjust', 'voice.use'],
};

export function hasAbility(role, ability) {
  const list = abilitiesByRole[role] || [];
  return list.includes('*') || list.includes(ability);
}

// kind is "power" or "adjust"
export function canControlDevice(role, device, kind) {
  if (!hasAbility(role, `device.${kind}`)) return false;
  if (role === 'Child' && !getTemplate(device).childSafe) return false;
  return true;
}
