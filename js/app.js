const API = '/api';
const elements = {
  addPlayerForm: document.querySelector('#add-player-form'),
  playerName: document.querySelector('#player-name'),
  matchForm: document.querySelector('#record-match-form'),
  winner: document.querySelector('#winner-select'),
  loser: document.querySelector('#loser-select'),
  note: document.querySelector('#match-note'),
  matches: document.querySelector('#matches-list'),
  leaderboard: document.querySelector('#leaderboard'),
  clear: document.querySelector('#clear-data'),
  exportJson: document.querySelector('#export-json'),
  importJson: document.querySelector('#import-json'),
  importJsonButton: document.querySelector('#import-json-btn'),
  status: document.querySelector('#status-message'),
  adminControls: document.querySelector('#admin-controls')
};

let state = { users: [], scores: [] };
const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';

elements.adminControls.hidden = !isAdmin;

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
}

function showStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('error', isError);
}

function escapeHtml(value = '') {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function renderPlayerOptions() {
  const options = ['<option value="">Select a player</option>', ...state.users.map(user =>
    `<option value="${user.id}">${escapeHtml(user.name)}</option>`
  )].join('');
  elements.winner.innerHTML = options;
  elements.loser.innerHTML = options;
}

function renderMatches() {
  if (!state.scores.length) {
    elements.matches.innerHTML = '<p class="empty">No matches recorded yet.</p>';
    return;
  }
  elements.matches.innerHTML = state.scores.map(match => `
    <article class="matches-item">
      <div><strong>${escapeHtml(match.winnerName)}</strong> beat <strong>${escapeHtml(match.loserName)}</strong>
        ${match.note ? `<div class="meta">${escapeHtml(match.note)}</div>` : ''}</div>
      <time class="meta" datetime="${match.recordedAt}">${new Date(match.recordedAt).toLocaleString()}</time>
    </article>`).join('');
}

function renderLeaderboard() {
  const totals = new Map(state.users.map(user => [user.id, { name: user.name, wins: 0, losses: 0 }]));
  state.scores.forEach(match => {
    const winner = totals.get(match.winnerId);
    const loser = totals.get(match.loserId);
    if (winner) winner.wins++;
    if (loser) loser.losses++;
  });
  const rows = [...totals.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
  elements.leaderboard.innerHTML = rows.length
    ? rows.map((player, index) => `<div class="leader-item"><span>${index + 1}. ${escapeHtml(player.name)}</span><span>${player.wins} W · ${player.losses} L</span></div>`).join('')
    : '<p class="empty">Add players to start the leaderboard.</p>';
}

function render() {
  renderPlayerOptions();
  renderMatches();
  renderLeaderboard();
}

async function loadData() {
  state = await request('/data');
  render();
}

elements.addPlayerForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    state = await request('/users', { method: 'POST', body: JSON.stringify({ name: elements.playerName.value }) });
    elements.playerName.value = '';
    render();
    showStatus('Player added.');
  } catch (error) { showStatus(error.message, true); }
});

elements.matchForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    state = await request('/scores', { method: 'POST', body: JSON.stringify({
      winnerId: elements.winner.value, loserId: elements.loser.value, note: elements.note.value
    }) });
    elements.matchForm.reset();
    render();
    showStatus('Match recorded.');
  } catch (error) { showStatus(error.message, true); }
});

elements.clear.addEventListener('click', async () => {
  if (!window.confirm('Delete all players and matches? This cannot be undone.')) return;
  try {
    state = await request('/data', { method: 'DELETE' });
    render();
    showStatus('All data has been reset.');
  } catch (error) { showStatus(error.message, true); }
});

elements.exportJson.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'score-tracker-backup.json' });
  link.click();
  URL.revokeObjectURL(link.href);
});

elements.importJsonButton.addEventListener('click', () => elements.importJson.click());
elements.importJson.addEventListener('change', async () => {
  const [file] = elements.importJson.files;
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    state = await request('/data', { method: 'PUT', body: JSON.stringify(imported) });
    render();
    showStatus('Backup imported.');
  } catch (error) { showStatus(`Import failed: ${error.message}`, true); }
  elements.importJson.value = '';
});

loadData().catch(error => {
  const help = window.location.protocol === 'file:'
    ? ' Open this app at http://localhost:3000 after running node server.js.'
    : '';
  showStatus(`Could not load saved data: ${error.message}.${help}`, true);
});
