import { getDeviceStatus } from '../utils/deviceTemplates.js';

const STATUS_CLASS = {
  On: 'badge-on',
  'In Standby': 'badge-standby',
  Malfunctioning: 'badge-fault',
  Disconnected: 'badge-offline',
};

export default function StatusBadge({ device }) {
  const status = getDeviceStatus(device);
  return <span className={`badge ${STATUS_CLASS[status]}`}>{status}</span>;
}
