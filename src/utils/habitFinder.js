import { getTemplate, labelForSettingKey } from './deviceTemplates.js';
import { DAY, MINUTE, dateKey, minutesOfDay, toTimeString, prettyTime } from './timeHelpers.js';

const LOOK_BACK_DAYS = 14;
const CLUSTER_WINDOW_MINUTES = 45;
const MIN_DAYS_TO_SUGGEST = 3;

// Looks through manual actions and finds the ones a person repeats around the same time each day.
export function findRepeatingHabits(home) {
  const earliest = home.simNow - LOOK_BACK_DAYS * DAY;
  const groups = new Map();

  home.eventLog.forEach((event) => {
    if (event.source !== 'manual' || event.at < earliest) return;
    const device = home.devices.find((item) => item.id === event.deviceId);
    if (!device || getTemplate(device).alwaysOn) return;

    const what = event.kind === 'power' ? `power:${event.value}` : `set:${event.key}:${event.value}`;
    const groupKey = `${event.deviceId}|${what}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { device, event, hits: [] });
    groups.get(groupKey).hits.push({ minute: minutesOfDay(event.at), day: dateKey(event.at) });
  });

  const habits = [];
  groups.forEach(({ device, event, hits }) => {
    hits.sort((a, b) => a.minute - b.minute);
    let cluster = [];
    const closeCluster = () => {
      const days = new Set(cluster.map((hit) => hit.day));
      if (days.size >= MIN_DAYS_TO_SUGGEST) {
        const average = cluster.reduce((sum, hit) => sum + hit.minute, 0) / cluster.length;
        habits.push(buildHabit(home, device, event, Math.round(average / 5) * 5, days.size));
      }
      cluster = [];
    };
    hits.forEach((hit) => {
      if (cluster.length && hit.minute - cluster[0].minute > CLUSTER_WINDOW_MINUTES) closeCluster();
      cluster.push(hit);
    });
    if (cluster.length) closeCluster();
  });

  return habits
    .filter((habit) => !alreadyAutomated(home, habit))
    .sort((a, b) => b.daysSeen - a.daysSeen);
}

function buildHabit(home, device, event, minute, daysSeen) {
  const time = toTimeString(minute);
  let command;
  let sentence;
  let action;
  if (event.kind === 'power') {
    command = event.value ? 'on' : 'off';
    sentence = `You turn ${event.value ? 'on' : 'off'} ${device.name}`;
    action = { target: `device:${device.id}`, command };
  } else {
    sentence = `You set ${labelForSettingKey(event.key).toLowerCase()} of ${device.name} to ${event.value}`;
    action = { target: `device:${device.id}`, command: 'set', key: event.key, value: event.value };
  }
  return {
    id: `${device.id}-${command || event.key}-${time}`,
    deviceId: device.id,
    daysSeen,
    time,
    title: `${sentence} around ${prettyTime(time)}`,
    detail: `Seen on ${daysSeen} of the last ${LOOK_BACK_DAYS} days. Automate it so you don't have to.`,
    routineDraft: {
      name: `Auto: ${device.name} at ${prettyTime(time)}`,
      time,
      days: [0, 1, 2, 3, 4, 5, 6],
      actions: [action],
    },
  };
}

function alreadyAutomated(home, habit) {
  const [habitHour, habitMinute] = habit.time.split(':').map(Number);
  const habitMinutes = habitHour * 60 + habitMinute;
  const habitAction = habit.routineDraft.actions[0];
  return home.routines.some((routine) => {
    const [hour, minute] = routine.time.split(':').map(Number);
    if (Math.abs(hour * 60 + minute - habitMinutes) > 60) return false;
    return routine.actions.some(
      (action) =>
        action.target === habitAction.target &&
        action.command === habitAction.command &&
        (action.key || null) === (habitAction.key || null),
    );
  });
}
