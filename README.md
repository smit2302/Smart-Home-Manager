# SmartHome Manager

A simulated smart-home management platform built with React + Vite. Users register, create a household,
add rooms, create virtual devices, connect them, schedule routines, track simulated energy use and react to
malfunction alerts. No real hardware is involved. All data is kept in the browser's `localStorage`.

## Run it

```powershell
cd C:\Users\R17\OneDrive\Desktop\SmartHome_Manager
npm install
npm run dev
```

Open http://localhost:5173. To reset everything, clear this site's localStorage in DevTools.

## Quick tour (2 minutes)

1. Register, then **Create a household** (you become Admin).
2. On the Dashboard press **Load demo home**: 3 rooms, 10 connected devices and a week of history.
3. Raise the **Clock speed** in the top bar to "1 hour per second", then switch on *Winter Heater*.
   After about 24 simulated hours it is flagged as malfunctioning and an alert appears. Press **Reset device**.
4. Use **+1 h / +6 h / +1 day** to skip ahead. The "Lights and fans off at 10 PM" routine fires on its own.
5. Open **Insights** for learned habits (e.g. thermostat adjusted every morning) and energy-saving advice.
6. Open **Voice control** and try "turn off all lights" or "set thermostat to 22".
7. Press **Emergency mode**: everything switches off and doors lock.
8. Log out, register a second account, join with the invite code (Members page), and let the Admin set the
   role to Guest or Child to see the permission differences.

## Requirement coverage

### L1 - minimum features
| Feature | Where |
|---|---|
| Register, log in, household setup, rooms | `AuthPage`, `HouseholdSetup`, `RoomsPage` |
| Appliance control dashboard | `DashboardPage`, `DeviceCard`, `DeviceControls` |
| Routine scheduling | `RoutinesPage`, `stepClock` in `homeEngine.js` |
| Energy usage tracking and report | `EnergyPage`, `getWeeklyReport` |
| Malfunction alerts (heater > 24 h etc.) | `AlertsPage`, `stepClock` + `maxRunHours` in `deviceTemplates.js` |

### L2 - device management
| Feature | Where |
|---|---|
| Create devices with own features | `DevicesPage` form, `DEVICE_TEMPLATES` |
| Configurable features (thermostat limits 18-30 C, fan Low/Medium/High, lamp dimmer + warm/cold) | `deviceTemplates.js` |
| "Connect" button before a device is usable | `DeviceCard`, `connectDevice` |
| Status: On / In Standby / Malfunctioning / Disconnected | `getDeviceStatus`, `StatusBadge` |

### Challenging features
| Feature | Where |
|---|---|
| Usage prediction | `utils/habitFinder.js`, `InsightsPage` |
| Emergency mode | `activateEmergency`, `TopBar`, `EmergencyBanner` |
| Text voice control | `utils/voiceParser.js`, `VoicePage` |
| Roles (Admin, Guest, Child) | `utils/permissions.js`, `MembersPage` |
| Device groups | `GroupsPage`, `switchGroup` |
| Energy recommendations | `utils/energyAdvisor.js`, `InsightsPage` |

## Roles

| Role | Can do |
|---|---|
| Admin | Everything |
| Guest | Switch any device on/off, use voice control, view everything |
| Child | Switch and adjust only child-safe devices (lamp, fan, TV) |

## Folder layout

```
SmartHome_Manager/
  index.html
  package.json
  vite.config.js
  src/
    main.jsx, App.jsx
    context/HomeContext.jsx      state, persistence, permission-checked actions, clock ticker
    utils/
      deviceTemplates.js         device types, features, wattage, status
      homeEngine.js              power/settings, routines, emergency, clock, energy, demo data
      habitFinder.js             usage prediction
      energyAdvisor.js           saving recommendations
      voiceParser.js             text voice commands
      permissions.js, storage.js, timeHelpers.js, idMaker.js
    components/                  AppShell, TopBar, DeviceCard, DeviceControls, ...
    pages/                       one file per screen
    styles/app.css
```

## Notes

- The home has its own simulated clock (top bar). Energy, routines and alerts all follow it, so a "24 hour"
  fault can be shown in seconds.
- The Washing Machine fails to start about 15% of the time to demonstrate the "device did not respond" alert.
- Passwords are SHA-256 hashed before storing. This is a browser-only simulation, not real security.
