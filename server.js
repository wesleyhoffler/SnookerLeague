const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const root = __dirname;
const dataDirectory = path.join(root, 'data');
const usersFile = path.join(dataDirectory, 'users.json');
const scoresFile = path.join(dataDirectory, 'scores.json');
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

async function ensureDataFiles() {
  await fs.mkdir(dataDirectory, { recursive: true });
  for (const file of [usersFile, scoresFile]) {
    try { await fs.access(file); } catch { await fs.writeFile(file, '[]\n'); }
  }
}

async function readJson(file) {
  try {
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!Array.isArray(value)) throw new Error('Expected an array');
    return value;
  } catch (error) {
    throw new Error(`Saved data in ${path.basename(file)} is invalid: ${error.message}`);
  }
}
async function getData() { return { users: await readJson(usersFile), scores: await readJson(scoresFile) }; }
async function writeJson(file, data) { await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8'); }
function send(response, status, body) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(body)); }
async function bodyOf(request) {
  let raw = '';
  for await (const chunk of request) { raw += chunk; if (raw.length > 1_000_000) throw new Error('Request body is too large.'); }
  return raw ? JSON.parse(raw) : {};
}
function validData(data) {
  if (!data || !Array.isArray(data.users) || !Array.isArray(data.scores)) return false;
  const ids = new Set();
  return data.users.every(user => typeof user.id === 'string' && typeof user.name === 'string' && user.name.trim() && !ids.has(user.id) && ids.add(user.id))
    && data.scores.every(match => typeof match.id === 'string' && ids.has(match.winnerId) && ids.has(match.loserId) && match.winnerId !== match.loserId && typeof match.recordedAt === 'string');
}
async function api(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/data') return send(response, 200, await getData());
  if (request.method === 'POST' && url.pathname === '/api/users') {
    const { name } = await bodyOf(request); const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || cleanName.length > 60) return send(response, 400, { error: 'Player names must be between 1 and 60 characters.' });
    const data = await getData();
    if (data.users.some(user => user.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) return send(response, 409, { error: 'That player already exists.' });
    data.users.push({ id: randomUUID(), name: cleanName, createdAt: new Date().toISOString() }); await writeJson(usersFile, data.users); return send(response, 201, data);
  }
  if (request.method === 'POST' && url.pathname === '/api/scores') {
    const { winnerId, loserId, note } = await bodyOf(request); const data = await getData();
    const winner = data.users.find(user => user.id === winnerId), loser = data.users.find(user => user.id === loserId);
    if (!winner || !loser || winnerId === loserId) return send(response, 400, { error: 'Choose two different existing players.' });
    if (typeof note !== 'undefined' && (typeof note !== 'string' || note.length > 300)) return send(response, 400, { error: 'Notes can be up to 300 characters.' });
    data.scores.unshift({ id: randomUUID(), winnerId, loserId, winnerName: winner.name, loserName: loser.name, note: (note || '').trim(), recordedAt: new Date().toISOString() }); await writeJson(scoresFile, data.scores); return send(response, 201, data);
  }
  if (request.method === 'DELETE' && url.pathname === '/api/data') { await writeJson(usersFile, []); await writeJson(scoresFile, []); return send(response, 200, { users: [], scores: [] }); }
  if (request.method === 'PUT' && url.pathname === '/api/data') {
    const data = await bodyOf(request); if (!validData(data)) return send(response, 400, { error: 'The backup does not have valid users and scores.' });
    await writeJson(usersFile, data.users); await writeJson(scoresFile, data.scores); return send(response, 200, data);
  }
  send(response, 404, { error: 'API route not found.' });
}
async function serveFile(request, response, url) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403); return response.end('Forbidden'); }
  try { const data = await fs.readFile(file); response.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream' }); response.end(data); }
  catch { response.writeHead(404); response.end('Not found'); }
}

ensureDataFiles().then(() => http.createServer(async (request, response) => {
  try { const url = new URL(request.url, `http://${request.headers.host}`); if (url.pathname.startsWith('/api/')) await api(request, response, url); else await serveFile(request, response, url); }
  catch (error) { console.error(error); send(response, 500, { error: 'Unable to save or read data.' }); }
}).listen(process.env.PORT || 3000, () => console.log('Score Tracker running at http://localhost:3000'))).catch(error => { console.error(error); process.exit(1); });
