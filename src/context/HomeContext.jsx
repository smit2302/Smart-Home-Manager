import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loadStore, saveStore, hashPassword } from '../utils/storage.js';
import { makeId } from '../utils/idMaker.js';
import { canControlDevice, hasAbility } from '../utils/permissions.js';
import { MINUTE } from '../utils/timeHelpers.js';
import {
  activateEmergency,
  advanceClock,
  applyAction,
  buildDevice,
  changeSetting,
  connectDevice,
  createEmptyHousehold,
  deactivateEmergency,
  findDevice,
  loadDemoSetup,
  powerDevice,
  raiseFault,
  removeDevice,
  resetDevice,
  runRoutine,
  switchGroup,
} from '../utils/homeEngine.js';
import { executeVoiceCommand } from '../utils/voiceParser.js';

const HomeContext = createContext(null);

export function useHome() {
  return useContext(HomeContext);
}

const denied = (what) => ({ ok: false, message: `Your role is not allowed to ${what}.` });

export function HomeProvider({ children }) {
  const [store, setStore] = useState(loadStore);
  const [toasts, setToasts] = useState([]);
  const storeRef = useRef(store);

  const writeStore = useCallback((nextStore) => {
    storeRef.current = nextStore;
    setStore(nextStore);
    saveStore(nextStore);
  }, []);

  const notify = useCallback((message, ok = true) => {
    if (!message) return;
    const toastId = makeId('toast');
    setToasts((current) => [...current, { id: toastId, message, ok }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== toastId)), 3600);
  }, []);

  const account = store.accounts.find((item) => item.id === store.sessionUserId) || null;
  const home = account && account.householdId ? store.households[account.householdId] || null : null;
  const role = account ? account.role : null;

  /* ---------------- simulation clock ---------------- */
  useEffect(() => {
    const timer = setInterval(() => {
      const current = storeRef.current;
      const me = current.accounts.find((item) => item.id === current.sessionUserId);
      if (!me || !me.householdId) return;
      const household = current.households[me.householdId];
      if (!household || !household.clockSpeed) return;
      const next = structuredClone(current);
      advanceClock(next.households[me.householdId], 1000 * household.clockSpeed);
      writeStore(next);
    }, 1000);
    return () => clearInterval(timer);
  }, [writeStore]);

  /* ---------------- generic action runner ---------------- */
  // check: { ability } for household-wide actions, or { deviceId, kind } for one device.
  const perform = useCallback(
    (check, mutator, { quiet = false } = {}) => {
      const snapshot = storeRef.current;
      const me = snapshot.accounts.find((item) => item.id === snapshot.sessionUserId);
      const household = me && me.householdId ? snapshot.households[me.householdId] : null;
      if (!me || !household) return { ok: false, message: 'Sign in and join a household first.' };

      if (check.deviceId) {
        const device = findDevice(household, check.deviceId);
        if (!device) return { ok: false, message: 'That device no longer exists.' };
        if (!canControlDevice(me.role, device, check.kind)) {
          const result = denied(check.kind === 'power' ? 'switch this device' : 'change this device');
          notify(result.message, false);
          return result;
        }
      } else if (!hasAbility(me.role, check.ability)) {
        const result = denied(check.label || 'do that');
        notify(result.message, false);
        return result;
      }

      const next = structuredClone(snapshot);
      const draftHome = next.households[me.householdId];
      const outcome = mutator(draftHome, next, me) || { ok: true, message: '' };
      writeStore(next);
      if (!quiet) notify(outcome.message, outcome.ok);
      return outcome;
    },
    [notify, writeStore],
  );

  /* ---------------- account + household ---------------- */
  const register = useCallback(
    async (name, email, password) => {
      const cleanEmail = email.trim().toLowerCase();
      if (!name.trim() || !cleanEmail || password.length < 6) {
        return { ok: false, message: 'Enter your name, an email and a password of at least 6 characters.' };
      }
      const current = storeRef.current;
      if (current.accounts.some((item) => item.email === cleanEmail)) {
        return { ok: false, message: 'An account with this email already exists. Try logging in.' };
      }
      const passwordHash = await hashPassword(password);
      const fresh = structuredClone(storeRef.current);
      const newAccount = { id: makeId('user'), name: name.trim(), email: cleanEmail, passwordHash, householdId: null, role: null };
      fresh.accounts.push(newAccount);
      fresh.sessionUserId = newAccount.id;
      writeStore(fresh);
      return { ok: true };
    },
    [writeStore],
  );

  const login = useCallback(
    async (email, password) => {
      const cleanEmail = email.trim().toLowerCase();
      const passwordHash = await hashPassword(password);
      const current = storeRef.current;
      const match = current.accounts.find((item) => item.email === cleanEmail && item.passwordHash === passwordHash);
      if (!match) return { ok: false, message: 'Email or password is incorrect.' };
      writeStore({ ...current, sessionUserId: match.id });
      return { ok: true };
    },
    [writeStore],
  );

  const logout = useCallback(() => {
    writeStore({ ...storeRef.current, sessionUserId: null });
  }, [writeStore]);

  const createHousehold = useCallback(
    (name) => {
      if (!name.trim()) return { ok: false, message: 'Give your household a name.' };
      const next = structuredClone(storeRef.current);
      const me = next.accounts.find((item) => item.id === next.sessionUserId);
      const household = createEmptyHousehold(name.trim(), me.id);
      next.households[household.id] = household;
      me.householdId = household.id;
      me.role = 'Admin';
      writeStore(next);
      return { ok: true };
    },
    [writeStore],
  );

  const joinHousehold = useCallback(
    (code) => {
      const next = structuredClone(storeRef.current);
      const wanted = code.trim().toUpperCase();
      const household = Object.values(next.households).find((item) => item.inviteCode === wanted);
      if (!household) return { ok: false, message: 'No household uses that invite code.' };
      const me = next.accounts.find((item) => item.id === next.sessionUserId);
      me.householdId = household.id;
      me.role = 'Guest';
      writeStore(next);
      return { ok: true };
    },
    [writeStore],
  );

  /* ---------------- devices ---------------- */
  const togglePower = useCallback(
    (deviceId, wantOn) => perform({ deviceId, kind: 'power' }, (h) => powerDevice(h, deviceId, wantOn, 'manual')),
    [perform],
  );

  const adjustSetting = useCallback(
    (deviceId, key, value) => perform({ deviceId, kind: 'adjust' }, (h) => changeSetting(h, deviceId, key, value, 'manual')),
    [perform],
  );

  const createDevice = useCallback(
    ({ type, name, roomId, limits }) =>
      perform({ ability: 'device.create', label: 'create devices' }, (h) => {
        const cleanName = name.trim();
        if (!cleanName) return { ok: false, message: 'Give the device a name.' };
        if (limits && limits.minTemp !== undefined && Number(limits.minTemp) >= Number(limits.maxTemp)) {
          return { ok: false, message: 'The lowest allowed temperature must be below the highest.' };
        }
        const device = buildDevice(type, cleanName, roomId, limits ? { minTemp: Number(limits.minTemp), maxTemp: Number(limits.maxTemp) } : {});
        if (device.limits.minTemp !== undefined) {
          device.settings.targetTemp = Math.min(device.limits.maxTemp, Math.max(device.limits.minTemp, device.settings.targetTemp));
        }
        h.devices.push(device);
        return { ok: true, message: `${cleanName} created. Press Connect to link it.` };
      }),
    [perform],
  );

  const connect = useCallback(
    (deviceId) => perform({ ability: 'device.connect', label: 'connect devices' }, (h) => connectDevice(h, deviceId)),
    [perform],
  );

  const reset = useCallback(
    (deviceId) => perform({ ability: 'device.reset', label: 'reset devices' }, (h) => resetDevice(h, deviceId)),
    [perform],
  );

  const simulateFault = useCallback(
    (deviceId) =>
      perform({ ability: 'device.reset', label: 'simulate faults' }, (h) => {
        const device = findDevice(h, deviceId);
        if (!device || !device.connected) return { ok: false, message: 'Connect the device before simulating a fault.' };
        raiseFault(h, deviceId, `${device.name} stopped responding to commands (simulated fault).`, `${device.name} is not responding`);
        return { ok: true, message: `${device.name} now reports a malfunction.` };
      }),
    [perform],
  );

  const deleteDevice = useCallback(
    (deviceId) =>
      perform({ ability: 'device.delete', label: 'delete devices' }, (h) => {
        const device = findDevice(h, deviceId);
        removeDevice(h, deviceId);
        return { ok: true, message: `${device ? device.name : 'Device'} removed.` };
      }),
    [perform],
  );

  const assignDevice = useCallback(
    (deviceId, roomId) =>
      perform({ ability: 'room.manage', label: 'move devices between rooms' }, (h) => {
        const device = findDevice(h, deviceId);
        if (device) device.roomId = roomId || null;
        return { ok: true, message: `${device.name} moved.` };
      }),
    [perform],
  );

  /* ---------------- rooms ---------------- */
  const addRoom = useCallback(
    (name) =>
      perform({ ability: 'room.manage', label: 'manage rooms' }, (h) => {
        const cleanName = name.trim();
        if (!cleanName) return { ok: false, message: 'Give the room a name.' };
        if (h.rooms.some((room) => room.name.toLowerCase() === cleanName.toLowerCase())) {
          return { ok: false, message: `${cleanName} already exists.` };
        }
        h.rooms.push({ id: makeId('room'), name: cleanName });
        return { ok: true, message: `${cleanName} added.` };
      }),
    [perform],
  );

  const deleteRoom = useCallback(
    (roomId) =>
      perform({ ability: 'room.manage', label: 'manage rooms' }, (h) => {
        h.rooms = h.rooms.filter((room) => room.id !== roomId);
        h.devices.forEach((device) => {
          if (device.roomId === roomId) device.roomId = null;
        });
        return { ok: true, message: 'Room removed. Its devices are now unassigned.' };
      }),
    [perform],
  );

  /* ---------------- routines ---------------- */
  const saveRoutine = useCallback(
    (draft) =>
      perform({ ability: 'routine.manage', label: 'change routines' }, (h) => {
        if (!draft.name.trim()) return { ok: false, message: 'Give the routine a name.' };
        if (!draft.days.length) return { ok: false, message: 'Pick at least one day.' };
        if (!draft.actions.length) return { ok: false, message: 'Add at least one action.' };
        h.routines.push({ id: makeId('routine'), enabled: true, lastRunAt: null, ...draft, name: draft.name.trim() });
        return { ok: true, message: `Routine "${draft.name.trim()}" saved.` };
      }),
    [perform],
  );

  const toggleRoutine = useCallback(
    (routineId) =>
      perform({ ability: 'routine.manage', label: 'change routines' }, (h) => {
        const routine = h.routines.find((item) => item.id === routineId);
        routine.enabled = !routine.enabled;
        return { ok: true, message: `${routine.name} ${routine.enabled ? 'enabled' : 'paused'}.` };
      }),
    [perform],
  );

  const deleteRoutine = useCallback(
    (routineId) =>
      perform({ ability: 'routine.manage', label: 'change routines' }, (h) => {
        h.routines = h.routines.filter((item) => item.id !== routineId);
        return { ok: true, message: 'Routine deleted.' };
      }),
    [perform],
  );

  const runRoutineNow = useCallback(
    (routineId) =>
      perform({ ability: 'routine.manage', label: 'run routines' }, (h) => {
        const routine = h.routines.find((item) => item.id === routineId);
        if (h.emergency.active) return { ok: false, message: 'Emergency mode is on.' };
        const touched = runRoutine(h, routine, 'routine');
        return { ok: true, message: `${routine.name}: ${touched} device change${touched === 1 ? '' : 's'}.` };
      }),
    [perform],
  );

  /* ---------------- groups ---------------- */
  const saveGroup = useCallback(
    (name, deviceIds) =>
      perform({ ability: 'group.manage', label: 'manage groups' }, (h) => {
        if (!name.trim()) return { ok: false, message: 'Give the group a name.' };
        if (deviceIds.length < 2) return { ok: false, message: 'Pick at least two devices for a group.' };
        h.groups.push({ id: makeId('group'), name: name.trim(), deviceIds });
        return { ok: true, message: `Group "${name.trim()}" created.` };
      }),
    [perform],
  );

  const deleteGroup = useCallback(
    (groupId) =>
      perform({ ability: 'group.manage', label: 'manage groups' }, (h) => {
        h.groups = h.groups.filter((group) => group.id !== groupId);
        return { ok: true, message: 'Group deleted.' };
      }),
    [perform],
  );

  const switchDeviceGroup = useCallback(
    (groupId, wantOn) =>
      perform({ ability: 'device.power', label: 'switch devices' }, (h, _all, me) =>
        switchGroup(h, groupId, wantOn, (device) => canControlDevice(me.role, device, 'power')),
      ),
    [perform],
  );

  /* ---------------- emergency, alerts, voice ---------------- */
  const setEmergency = useCallback(
    (enable) =>
      perform({ ability: 'emergency.toggle', label: 'change emergency mode' }, (h, _all, me) =>
        enable ? activateEmergency(h, me.name) : deactivateEmergency(h),
      ),
    [perform],
  );

  const acknowledgeAlert = useCallback(
    (alertId) =>
      perform({ ability: 'alerts.manage', label: 'manage alerts' }, (h) => {
        const alert = h.alerts.find((item) => item.id === alertId);
        if (alert) alert.acknowledged = true;
      }, { quiet: true }),
    [perform],
  );

  const acknowledgeAllAlerts = useCallback(
    () =>
      perform({ ability: 'alerts.manage', label: 'manage alerts' }, (h) => {
        h.alerts.forEach((alert) => {
          alert.acknowledged = true;
        });
        return { ok: true, message: 'All alerts marked as read.' };
      }),
    [perform],
  );

  const clearAlerts = useCallback(
    () =>
      perform({ ability: 'alerts.manage', label: 'manage alerts' }, (h) => {
        h.alerts = [];
        return { ok: true, message: 'Alert history cleared.' };
      }),
    [perform],
  );

  const sendVoiceCommand = useCallback(
    (text) =>
      perform({ ability: 'voice.use', label: 'use voice control' }, (h, _all, me) => {
        const result = executeVoiceCommand(h, text, { role: me.role });
        return { ok: result.ok, message: '' };
      }, { quiet: true }),
    [perform],
  );

  /* ---------------- clock, demo, members, advice ---------------- */
  const setClockSpeed = useCallback(
    (speed) =>
      perform({ ability: 'clock.control', label: 'control the simulation clock' }, (h) => {
        h.clockSpeed = Number(speed);
      }, { quiet: true }),
    [perform],
  );

  const skipAhead = useCallback(
    (minutes) =>
      perform({ ability: 'clock.control', label: 'control the simulation clock' }, (h) => {
        advanceClock(h, minutes * MINUTE);
        return { ok: true, message: `Skipped ahead ${minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`}.` };
      }),
    [perform],
  );

  const loadDemo = useCallback(
    () =>
      perform({ ability: 'demo.load', label: 'load demo data' }, (h) => {
        if (h.devices.length || h.rooms.length) return { ok: false, message: 'Demo data only loads into an empty household.' };
        loadDemoSetup(h);
        return { ok: true, message: 'Demo home loaded.' };
      }),
    [perform],
  );

  const changeMemberRole = useCallback(
    (userId, newRole) =>
      perform({ ability: 'members.manage', label: 'manage members' }, (h, all) => {
        const member = all.accounts.find((item) => item.id === userId);
        const admins = all.accounts.filter((item) => item.householdId === h.id && item.role === 'Admin');
        if (member.role === 'Admin' && newRole !== 'Admin' && admins.length === 1) {
          return { ok: false, message: 'A household needs at least one Admin.' };
        }
        member.role = newRole;
        return { ok: true, message: `${member.name} is now ${newRole}.` };
      }),
    [perform],
  );

  const removeMember = useCallback(
    (userId) =>
      perform({ ability: 'members.manage', label: 'manage members' }, (h, all, me) => {
        if (userId === me.id) return { ok: false, message: 'You cannot remove yourself.' };
        const member = all.accounts.find((item) => item.id === userId);
        member.householdId = null;
        member.role = null;
        return { ok: true, message: `${member.name} was removed from the household.` };
      }),
    [perform],
  );

  const applyAdvice = useCallback(
    (fix) =>
      perform({ ability: 'routine.manage', label: 'apply suggestions' }, (h) => {
        if (fix.kind === 'routine') {
          h.routines.push({ id: makeId('routine'), enabled: true, lastRunAt: null, ...fix.draft });
          return { ok: true, message: `Routine "${fix.draft.name}" created.` };
        }
        if (fix.kind === 'setting') return changeSetting(h, fix.deviceId, fix.key, fix.value, 'advice');
        if (fix.kind === 'power') return powerDevice(h, fix.deviceId, fix.wantOn, 'advice');
        return { ok: false, message: 'Nothing to apply.' };
      }),
    [perform],
  );

  const value = useMemo(
    () => ({
      account,
      home,
      role,
      members: home ? store.accounts.filter((item) => item.householdId === home.id) : [],
      toasts,
      notify,
      register,
      login,
      logout,
      createHousehold,
      joinHousehold,
      togglePower,
      adjustSetting,
      createDevice,
      connect,
      reset,
      simulateFault,
      deleteDevice,
      assignDevice,
      addRoom,
      deleteRoom,
      saveRoutine,
      toggleRoutine,
      deleteRoutine,
      runRoutineNow,
      saveGroup,
      deleteGroup,
      switchDeviceGroup,
      setEmergency,
      acknowledgeAlert,
      acknowledgeAllAlerts,
      clearAlerts,
      sendVoiceCommand,
      setClockSpeed,
      skipAhead,
      loadDemo,
      changeMemberRole,
      removeMember,
      applyAdvice,
    }),
    // every action is stable, so only the data below needs to trigger a refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, toasts],
  );

  return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>;
}
