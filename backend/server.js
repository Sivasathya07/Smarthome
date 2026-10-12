import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';

const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(express.json());

// Demo in-memory store. Replace with PostgreSQL/MongoDB and Redis in production.
let devices = [
  { id: 'D-1001', name: 'Living Room Lights', type: 'Light', room: 'Living Room', online: true, status: 'ON', power: 82, updatedAt: new Date().toISOString() },
  { id: 'D-1002', name: 'Bedroom AC', type: 'Climate', room: 'Bedroom', online: true, status: 'ON', power: 65, temperature: 22, updatedAt: new Date().toISOString() },
  { id: 'D-1003', name: 'Kitchen Motion Sensor', type: 'Sensor', room: 'Kitchen', online: true, status: 'ACTIVE', power: 4, updatedAt: new Date().toISOString() },
  { id: 'D-1004', name: 'Front Door Lock', type: 'Security', room: 'Entrance', online: false, status: 'LOCKED', power: 0, updatedAt: new Date().toISOString() },
  { id: 'D-1005', name: 'Desk Lamp', type: 'Light', room: 'Study', online: true, status: 'OFF', power: 0, updatedAt: new Date().toISOString() },
  { id: 'D-1006', name: 'Garden Sprinkler', type: 'Appliance', room: 'Garden', online: true, status: 'OFF', power: 0, updatedAt: new Date().toISOString() }
];
let activities = [
  { id: randomUUID(), deviceId: 'D-1001', deviceName: 'Living Room Lights', action: 'Turned on', detail: 'Command executed successfully', time: new Date(Date.now() - 2 * 60000).toISOString(), kind: 'success' },
  { id: randomUUID(), deviceId: 'D-1002', deviceName: 'Bedroom AC', action: 'Temperature changed', detail: 'Set to 22°C', time: new Date(Date.now() - 14 * 60000).toISOString(), kind: 'info' },
  { id: randomUUID(), deviceId: 'D-1004', deviceName: 'Front Door Lock', action: 'Device disconnected', detail: 'Last heartbeat missed', time: new Date(Date.now() - 35 * 60000).toISOString(), kind: 'warning' }
];
const addActivity = (device, action, detail, kind = 'success') => {
  activities.unshift({ id: randomUUID(), deviceId: device.id, deviceName: device.name, action, detail, time: new Date().toISOString(), kind });
  activities = activities.slice(0, 100);
};

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Smart Home API', timestamp: new Date().toISOString() }));
app.get('/api/metrics', (_req, res) => res.json({ total: devices.length, online: devices.filter(d => d.online).length, offline: devices.filter(d => !d.online).length, active: devices.filter(d => d.status === 'ON' || d.status === 'ACTIVE').length, energy: devices.reduce((sum, d) => sum + d.power, 0) }));
app.get('/api/devices', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const filtered = devices.filter(d => `${d.name} ${d.type} ${d.room} ${d.id}`.toLowerCase().includes(q));
  res.json(filtered);
});
app.post('/api/devices', (req, res) => {
  const { name, type, room } = req.body || {};
  if (!name?.trim() || !type || !room?.trim()) return res.status(400).json({ error: 'name, type and room are required' });
  const device = { id: `D-${Math.floor(1000 + Math.random() * 9000)}`, name: name.trim(), type, room: room.trim(), online: true, status: type === 'Security' ? 'LOCKED' : 'OFF', power: 0, updatedAt: new Date().toISOString() };
  devices.unshift(device); addActivity(device, 'Device registered', 'New device added to your home');
  res.status(201).json(device);
});
app.get('/api/devices/:id/status', (req, res) => {
  const d = devices.find(x => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Device not found' });
  res.json({ id: d.id, online: d.online, status: d.status, updatedAt: d.updatedAt });
});
app.post('/api/devices/:id/commands', (req, res) => {
  const d = devices.find(x => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Device not found' });
  if (!d.online) return res.status(503).json({ error: 'Device is offline; command was not sent' });
  const command = String(req.body?.command || '').toUpperCase();
  const allowed = ['TURN_ON', 'TURN_OFF', 'LOCK', 'UNLOCK', 'ACTIVATE', 'DEACTIVATE'];
  if (!allowed.includes(command)) return res.status(400).json({ error: `Unsupported command. Allowed: ${allowed.join(', ')}` });
  if (command === 'TURN_ON' || command === 'ACTIVATE' || command === 'UNLOCK') { d.status = command === 'UNLOCK' ? 'UNLOCKED' : 'ON'; d.power = d.type === 'Light' ? 75 : d.type === 'Climate' ? 60 : 10; }
  if (command === 'TURN_OFF' || command === 'DEACTIVATE' || command === 'LOCK') { d.status = command === 'LOCK' ? 'LOCKED' : 'OFF'; d.power = 0; }
  d.updatedAt = new Date().toISOString(); addActivity(d, command.replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase()), 'Command executed successfully');
  res.status(202).json({ deviceId: d.id, command, commandStatus: 'ACCEPTED', deviceStatus: d.status, message: 'Command executed in demo simulator' });
});
app.get('/api/devices/:id/activity', (req, res) => {
  if (!devices.some(d => d.id === req.params.id)) return res.status(404).json({ error: 'Device not found' });
  res.json(activities.filter(a => a.deviceId === req.params.id));
});
app.delete('/api/devices/:id', (req, res) => {
  const index = devices.findIndex(d => d.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Device not found' });
  const [removed] = devices.splice(index, 1); addActivity(removed, 'Device removed', 'Device removed from your home', 'warning');
  res.status(204).end();
});
app.get('/api/activity', (_req, res) => res.json(activities));

app.listen(PORT, () => console.log(`Smart Home API running at http://localhost:${PORT}`));
