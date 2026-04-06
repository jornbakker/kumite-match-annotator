let ytPlayer = null;
let currentVideoSourceType = null;
let currentVideoSourceValue = null;
let currentLocalVideoObjectUrl = null;
let timestampInterval = null;
let currentMatchEvents = [];
let currentAnnotator = null;
let selectedPlayerId = 0;
let selectedPlayerName = '';

const authPanel = document.getElementById('authPanel');
const appContent = document.getElementById('appContent');
const workflowPanel = document.getElementById('workflowPanel');
const workspaceContent = document.getElementById('workspaceContent');
const annotatorNameInput = document.getElementById('annotatorName');
const registerAnnotatorBtn = document.getElementById('registerAnnotatorBtn');
const loginAnnotatorBtn = document.getElementById('loginAnnotatorBtn');
const annotatorStatus = document.getElementById('annotatorStatus');

const videoSourceTypeSelect = document.getElementById('videoSourceType');
const youtubeUrlRow = document.getElementById('youtubeUrlRow');
const mp4FileRow = document.getElementById('mp4FileRow');
const youtubeUrlInput = document.getElementById('youtubeUrl');
const mp4FileInput = document.getElementById('mp4File');
const loadVideoBtn = document.getElementById('loadVideoBtn');
const matchNameInput = document.getElementById('matchName');
const matchLocationInput = document.getElementById('matchLocation');
const matchDateInput = document.getElementById('matchDate');
const opponentNameInput = document.getElementById('opponentName');
const selectedPlayerSideSelect = document.getElementById('selectedPlayerSide');
const aoPlayerNameInput = document.getElementById('aoPlayerName');
const akaPlayerNameInput = document.getElementById('akaPlayerName');

const playerNameInput = document.getElementById('playerName');
const createPlayerBtn = document.getElementById('createPlayerBtn');
const playerSelect = document.getElementById('playerSelect');
const selectPlayerBtn = document.getElementById('selectPlayerBtn');
const deletePlayerBtn = document.getElementById('deletePlayerBtn');
const viewPlayerOverviewBtn = document.getElementById('viewPlayerOverviewBtn');
const viewAllPlayersOverviewBtn = document.getElementById('viewAllPlayersOverviewBtn');
const selectedPlayerStatus = document.getElementById('selectedPlayerStatus');
const matchStep = document.getElementById('matchStep');
const createNewMatchBtn = document.getElementById('createNewMatchBtn');

const overviewContent = document.getElementById('overviewContent');
const overviewTitle = document.getElementById('overviewTitle');
const overviewSummary = document.getElementById('overviewSummary');
const overviewMatchesBody = document.getElementById('overviewMatchesBody');
const techniqueStatsBody = document.getElementById('techniqueStatsBody');
const pointsAgainstStatsBody = document.getElementById('pointsAgainstStatsBody');
const backToSelectionBtn = document.getElementById('backToSelectionBtn');

const allPlayersOverviewContent = document.getElementById('allPlayersOverviewContent');
const allPlayersOverviewSummary = document.getElementById('allPlayersOverviewSummary');
const allPlayersOverviewHead = document.getElementById('allPlayersOverviewHead');
const allPlayersOverviewBody = document.getElementById('allPlayersOverviewBody');
const backToSelectionFromAllPlayersBtn = document.getElementById('backToSelectionFromAllPlayersBtn');

const videoStatus = document.getElementById('videoStatus');

const eventTypeAoSelect = document.getElementById('eventTypeAo');
const scoreTypeRowAo = document.getElementById('scoreTypeRowAo');
const scoreTypeAoSelect = document.getElementById('scoreTypeAo');
const techniqueRowAo = document.getElementById('techniqueRowAo');
const techniqueAoSelect = document.getElementById('techniqueAo');
const defendedByDefenderAoCheckbox = document.getElementById('defendedByDefenderAo');
const noteAoInput = document.getElementById('noteAo');
const addAnnotationBtnAo = document.getElementById('addAnnotationBtnAo');

const eventTypeAkaSelect = document.getElementById('eventTypeAka');
const scoreTypeRowAka = document.getElementById('scoreTypeRowAka');
const scoreTypeAkaSelect = document.getElementById('scoreTypeAka');
const techniqueRowAka = document.getElementById('techniqueRowAka');
const techniqueAkaSelect = document.getElementById('techniqueAka');
const defendedByDefenderAkaCheckbox = document.getElementById('defendedByDefenderAka');
const noteAkaInput = document.getElementById('noteAka');
const addAnnotationBtnAka = document.getElementById('addAnnotationBtnAka');

const saveMatchBtn = document.getElementById('saveMatchBtn');
const annotationsBody = document.getElementById('annotationsBody');
const savedMatchesBody = document.getElementById('savedMatchesBody');
const currentTimestampEl = document.getElementById('currentTimestamp');
const totalsSummary = document.getElementById('totalsSummary');
const timelineInfo = document.getElementById('timelineInfo');
const timelineTrack = document.getElementById('timelineTrack');
const youtubePlayerContainer = document.getElementById('player');
const localVideo = document.getElementById('localVideo');

function revokeCurrentLocalVideoObjectUrl() {
  if (currentLocalVideoObjectUrl) {
    URL.revokeObjectURL(currentLocalVideoObjectUrl);
    currentLocalVideoObjectUrl = null;
  }
}

function showSelectionView() {
  overviewContent.classList.add('hidden');
  allPlayersOverviewContent.classList.add('hidden');
  workspaceContent.classList.add('hidden');
}

function showOverviewView() {
  overviewContent.classList.remove('hidden');
  allPlayersOverviewContent.classList.add('hidden');
  workspaceContent.classList.add('hidden');
}

function showAllPlayersOverviewView() {
  overviewContent.classList.add('hidden');
  allPlayersOverviewContent.classList.remove('hidden');
  workspaceContent.classList.add('hidden');
}

function showWorkspaceView() {
  overviewContent.classList.add('hidden');
  allPlayersOverviewContent.classList.add('hidden');
  workspaceContent.classList.remove('hidden');
}

function setAnnotatorState(annotator) {
  currentAnnotator = annotator;

  if (annotator) {
    annotatorStatus.textContent = `Logged in as: ${annotator.name}`;
    appContent.classList.remove('hidden');
    workflowPanel.classList.remove('hidden');
    showSelectionView();
    localStorage.setItem('kumiteAnnotator', JSON.stringify(annotator));
  } else {
    annotatorStatus.textContent = 'Not logged in.';
    appContent.classList.add('hidden');
    workflowPanel.classList.add('hidden');
    showSelectionView();
    localStorage.removeItem('kumiteAnnotator');
    selectedPlayerId = 0;
    selectedPlayerName = '';
    selectedPlayerStatus.textContent = 'No player selected.';
    matchStep.classList.add('hidden');
  }
}

function getAnnotatorId() {
  return currentAnnotator ? Number(currentAnnotator.id) : 0;
}

function scoreTypeToPoints(scoreType) {
  if (scoreType === 'Yuko') {
    return 1;
  }

  if (scoreType === 'Wasari') {
    return 2;
  }

  if (scoreType === 'Ippon') {
    return 3;
  }

  return 0;
}

function formatTime(seconds) {
  const totalSeconds = Math.floor(seconds || 0);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function extractVideoId(url) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1);
    }

    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v');
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeSide(value) {
  return value === 'aka' ? 'aka' : 'ao';
}

function isEventAgainstSelectedPlayer(playerSide) {
  const selectedSide = normalizeSide(selectedPlayerSideSelect.value);
  const eventSide = normalizeSide(playerSide);
  return selectedSide !== eventSide;
}

function sideLabel(playerSide) {
  return normalizeSide(playerSide) === 'aka' ? 'Aka' : 'Ao';
}

function getSideElements(playerSide) {
  if (normalizeSide(playerSide) === 'aka') {
    return {
      eventTypeSelect: eventTypeAkaSelect,
      scoreTypeRow: scoreTypeRowAka,
      scoreTypeSelect: scoreTypeAkaSelect,
      techniqueRow: techniqueRowAka,
      techniqueSelect: techniqueAkaSelect,
      defendedCheckbox: defendedByDefenderAkaCheckbox,
      noteInput: noteAkaInput,
    };
  }

  return {
    eventTypeSelect: eventTypeAoSelect,
    scoreTypeRow: scoreTypeRowAo,
    scoreTypeSelect: scoreTypeAoSelect,
    techniqueRow: techniqueRowAo,
    techniqueSelect: techniqueAoSelect,
    defendedCheckbox: defendedByDefenderAoCheckbox,
    noteInput: noteAoInput,
  };
}

function refreshPaneVisibility(playerSide) {
  const elements = getSideElements(playerSide);
  const eventType = elements.eventTypeSelect.value;
  const isScore = eventType === 'score';
  const isTechnique = eventType === 'technique';

  elements.scoreTypeRow.style.display = isScore ? 'flex' : 'none';
  elements.techniqueRow.style.display = isScore || isTechnique ? 'flex' : 'none';
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function registerAnnotator() {
  const name = annotatorNameInput.value.trim();
  if (!name) {
    alert('Please enter an annotator name.');
    return;
  }

  try {
    const annotator = await requestJson('/api/annotators/register', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    setAnnotatorState(annotator);
    await loadPlayers();
  } catch (error) {
    alert(error.message);
  }
}

async function loginAnnotator() {
  const name = annotatorNameInput.value.trim();
  if (!name) {
    alert('Please enter an annotator name.');
    return;
  }

  try {
    const annotator = await requestJson('/api/annotators/login', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    setAnnotatorState(annotator);
    await loadPlayers();
  } catch (error) {
    alert(error.message);
  }
}

function getSelectedPlayerId() {
  return selectedPlayerId;
}

function setSelectedPlayer(playerId, playerName) {
  selectedPlayerId = Number(playerId || 0);
  selectedPlayerName = playerName || '';

  if (!selectedPlayerId) {
    selectedPlayerStatus.textContent = 'No player selected.';
    matchStep.classList.add('hidden');
    showSelectionView();
    savedMatchesBody.innerHTML = '';
    return;
  }

  selectedPlayerStatus.textContent = `Selected player: ${playerName}`;
  matchStep.classList.remove('hidden');
}

function setTimestampDisplay() {
  const currentTime = getCurrentVideoTimestamp();
  if (currentTime === null) {
    currentTimestampEl.textContent = 'Timestamp: --';
    return;
  }

  currentTimestampEl.textContent = `Timestamp: ${formatTime(currentTime)} (${currentTime.toFixed(2)}s)`;
}

function startTimestampTicker() {
  if (timestampInterval) {
    clearInterval(timestampInterval);
  }

  timestampInterval = setInterval(setTimestampDisplay, 300);
}

function ensureYouTubePlayer(videoId) {
  if (!window.YT || !window.YT.Player) {
    throw new Error('YouTube API not loaded yet. Please wait a moment and try again.');
  }

  if (!ytPlayer) {
    ytPlayer = new window.YT.Player('player', {
      height: '405',
      width: '720',
      videoId,
      playerVars: {
        rel: 0,
      },
      events: {
        onReady: () => {
          setTimestampDisplay();
        },
      },
    });
    return;
  }

  ytPlayer.loadVideoById(videoId);
}

function showYouTubePlayer() {
  youtubePlayerContainer.classList.remove('hidden');
  localVideo.classList.add('hidden');
}

function showLocalVideoPlayer() {
  youtubePlayerContainer.classList.add('hidden');
  localVideo.classList.remove('hidden');
}

function loadLocalVideoFromUrl(url) {
  localVideo.pause();
  localVideo.src = url;
  localVideo.load();
}

function updateVideoSourceInputs() {
  const sourceType = videoSourceTypeSelect.value;
  const isYouTube = sourceType === 'youtube';

  youtubeUrlRow.classList.toggle('hidden', !isYouTube);
  mp4FileRow.classList.toggle('hidden', isYouTube);
}

function seekVideoTo(seconds) {
  const timestamp = Number(seconds) || 0;

  if (currentVideoSourceType === 'youtube' && ytPlayer && typeof ytPlayer.seekTo === 'function') {
    ytPlayer.seekTo(timestamp, true);
    return;
  }

  if (currentVideoSourceType === 'mp4') {
    localVideo.currentTime = timestamp;
  }
}

function getCurrentVideoDurationSeconds() {
  if (currentVideoSourceType === 'youtube' && ytPlayer && typeof ytPlayer.getDuration === 'function') {
    const value = Number(ytPlayer.getDuration());
    if (!Number.isNaN(value) && value > 0) {
      return value;
    }
  }

  if (currentVideoSourceType === 'mp4') {
    const value = Number(localVideo.duration);
    if (!Number.isNaN(value) && value > 0) {
      return value;
    }
  }

  return 0;
}

async function uploadMp4File(file) {
  const formData = new FormData();
  formData.append('video', file);

  const response = await fetch('/api/videos/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

async function loadPlayers() {
  if (!getAnnotatorId()) {
    return;
  }

  const players = await requestJson('/api/players');

  playerSelect.innerHTML = '';
  for (const player of players) {
    const option = document.createElement('option');
    option.value = String(player.id);
    option.textContent = player.name;
    playerSelect.appendChild(option);
  }

  if (players.length === 0) {
    setSelectedPlayer(0, '');
    annotationsBody.innerHTML = '';
    savedMatchesBody.innerHTML = '';
    return;
  }

  const firstPlayer = players[0];
  playerSelect.value = String(firstPlayer.id);
  setSelectedPlayer(0, '');
}

function buildAnnotationLabel(event) {
  if (event.eventType === 'warning') {
    return 'Warning';
  }

  if (event.eventType === 'technique') {
    return 'Technique (no score)';
  }

  return `Score (${event.scoreType})`;
}

function createJumpButton(timestampSeconds) {
  const button = document.createElement('button');
  button.textContent = 'Jump';
  button.addEventListener('click', () => {
    seekVideoTo(timestampSeconds);
  });
  return button;
}

function computeTotals(events) {
  let scoresInFavor = 0;
  let scoresAgainst = 0;
  let warnings = 0;
  let pointsInFavor = 0;
  let pointsAgainst = 0;

  for (const event of events) {
    if (event.eventType === 'warning') {
      warnings += 1;
      continue;
    }

    const points = scoreTypeToPoints(event.scoreType);
    if (event.isAgainst) {
      scoresAgainst += 1;
      pointsAgainst += points;
    } else {
      scoresInFavor += 1;
      pointsInFavor += points;
    }
  }

  return {
    scoresInFavor,
    scoresAgainst,
    warnings,
    pointsInFavor,
    pointsAgainst,
  };
}

function renderTotals() {
  const totals = computeTotals(currentMatchEvents);
  totalsSummary.textContent = `Scores in favor: ${totals.scoresInFavor} | Scores against: ${totals.scoresAgainst} | Warnings: ${totals.warnings} | Points in favor: ${totals.pointsInFavor} | Points against: ${totals.pointsAgainst}`;
}

function getTimelineDurationSeconds() {
  const maxEventTime = currentMatchEvents.reduce((max, event) => {
    const timestamp = Number(event.timestampSeconds) || 0;
    return timestamp > max ? timestamp : max;
  }, 0);

  const playerDuration = getCurrentVideoDurationSeconds();

  const timelineDuration = Math.max(playerDuration, maxEventTime, 1);
  return timelineDuration;
}

function getTimelineMarkerClass(event) {
  if (event.eventType === 'warning') {
    return event.playerSide === 'aka'
      ? 'timeline-marker-score-against'
      : 'timeline-marker-warning';
  }

  if (event.eventType === 'technique') {
    return event.playerSide === 'aka'
      ? 'timeline-marker-score-against'
      : 'timeline-marker-technique';
  }

  if (event.playerSide === 'aka') {
    return 'timeline-marker-score-against';
  }

  return 'timeline-marker-score-for';
}

function renderTimeline() {
  timelineTrack.innerHTML = '';

  if (currentMatchEvents.length === 0) {
    timelineInfo.textContent = 'No events yet.';
    return;
  }

  const timelineDuration = getTimelineDurationSeconds();
  timelineInfo.textContent = `Timeline length: ${formatTime(timelineDuration)} (${timelineDuration.toFixed(2)}s)`;

  for (const event of currentMatchEvents) {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = `timeline-marker ${getTimelineMarkerClass(event)}`;

    const seconds = Number(event.timestampSeconds) || 0;
    const positionPct = Math.max(0, Math.min(100, (seconds / timelineDuration) * 100));
    marker.style.left = `${positionPct}%`;
    marker.title = `${formatTime(seconds)} - ${sideLabel(event.playerSide)} - ${buildAnnotationLabel(event)}${event.technique ? ` - ${event.technique}` : ''}`;

    marker.addEventListener('click', () => {
      seekVideoTo(seconds);
    });

    timelineTrack.appendChild(marker);
  }
}

function renderEventsTable() {
  annotationsBody.innerHTML = '';

  for (let index = 0; index < currentMatchEvents.length; index += 1) {
    const event = currentMatchEvents[index];
    const tr = document.createElement('tr');

    const timeTd = document.createElement('td');
    timeTd.textContent = `${formatTime(event.timestampSeconds)} (${Number(event.timestampSeconds).toFixed(2)}s)`;

    const eventTd = document.createElement('td');
    eventTd.textContent = buildAnnotationLabel(event);

    const techniqueTd = document.createElement('td');
    techniqueTd.textContent = event.technique || '-';

    const sideTd = document.createElement('td');
    sideTd.textContent = sideLabel(event.playerSide);

    const defendedTd = document.createElement('td');
    defendedTd.textContent = event.defendedByDefender ? 'Yes' : 'No';

    const pointsTd = document.createElement('td');
    pointsTd.textContent = String(event.points || 0);

    const noteTd = document.createElement('td');
    noteTd.textContent = event.note || '-';

    const actionsTd = document.createElement('td');

    const jumpBtn = createJumpButton(event.timestampSeconds);
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      currentMatchEvents.splice(index, 1);
      renderEventsTable();
      renderTotals();
    });

    actionsTd.appendChild(jumpBtn);
    actionsTd.appendChild(deleteBtn);

    tr.appendChild(timeTd);
    tr.appendChild(eventTd);
    tr.appendChild(techniqueTd);
    tr.appendChild(sideTd);
    tr.appendChild(defendedTd);
    tr.appendChild(pointsTd);
    tr.appendChild(noteTd);
    tr.appendChild(actionsTd);

    annotationsBody.appendChild(tr);
  }

  renderTimeline();
}

function getYouTubeUrlFromId(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function renderSavedMatchesTable(matches) {
  savedMatchesBody.innerHTML = '';

  for (const match of matches) {
    const tr = document.createElement('tr');

    const dateTd = document.createElement('td');
    dateTd.textContent = match.matchDate;

    const nameTd = document.createElement('td');
    nameTd.textContent = match.matchName;

    const opponentTd = document.createElement('td');
    opponentTd.textContent = match.opponentName;

    const locationTd = document.createElement('td');
    locationTd.textContent = match.location;

    const totalsTd = document.createElement('td');
    totalsTd.textContent = `${match.scoresInFavor}-${match.scoresAgainst}, W:${match.warnings}, P:${match.pointsInFavor}-${match.pointsAgainst}`;

    const actionsTd = document.createElement('td');
    const reopenBtn = document.createElement('button');
    reopenBtn.textContent = 'Select Match';
    reopenBtn.addEventListener('click', async () => {
      try {
        await reopenSavedMatch(match.id);
      } catch (error) {
        alert(error.message);
      }
    });

    actionsTd.appendChild(reopenBtn);

    tr.appendChild(dateTd);
    tr.appendChild(nameTd);
    tr.appendChild(opponentTd);
    tr.appendChild(locationTd);
    tr.appendChild(totalsTd);
    tr.appendChild(actionsTd);

    savedMatchesBody.appendChild(tr);
  }
}

async function loadSavedMatches() {
  const playerId = getSelectedPlayerId();
  const annotatorId = getAnnotatorId();

  if (!playerId) {
    savedMatchesBody.innerHTML = '';
    return;
  }

  if (!annotatorId) {
    savedMatchesBody.innerHTML = '';
    return;
  }

  const matches = await requestJson(`/api/matches?playerId=${playerId}&annotatorId=${annotatorId}`);
  renderSavedMatchesTable(matches);
}

function renderOverviewMatches(matches) {
  overviewMatchesBody.innerHTML = '';

  for (const match of matches) {
    const tr = document.createElement('tr');

    const dateTd = document.createElement('td');
    dateTd.textContent = match.matchDate;

    const nameTd = document.createElement('td');
    nameTd.textContent = match.matchName;

    const opponentTd = document.createElement('td');
    opponentTd.textContent = match.opponentName;

    const resultTd = document.createElement('td');
    resultTd.textContent = match.result;

    const pointsTd = document.createElement('td');
    pointsTd.textContent = `${match.pointsInFavor}-${match.pointsAgainst}`;

    tr.appendChild(dateTd);
    tr.appendChild(nameTd);
    tr.appendChild(opponentTd);
    tr.appendChild(resultTd);
    tr.appendChild(pointsTd);

    overviewMatchesBody.appendChild(tr);
  }
}

function renderTechniqueStats(statsRows) {
  techniqueStatsBody.innerHTML = '';

  for (const stats of statsRows) {
    const tr = document.createElement('tr');

    const techniqueTd = document.createElement('td');
    techniqueTd.textContent = stats.technique;

    const attemptsTd = document.createElement('td');
    attemptsTd.textContent = String(stats.attempts);

    const scoredTd = document.createElement('td');
    scoredTd.textContent = String(stats.scored);

    const percentageTd = document.createElement('td');
    percentageTd.textContent = `${Number(stats.scoredPercentage).toFixed(1)}%`;

    const pointsTd = document.createElement('td');
    pointsTd.textContent = String(stats.points);

    tr.appendChild(techniqueTd);
    tr.appendChild(attemptsTd);
    tr.appendChild(scoredTd);
    tr.appendChild(percentageTd);
    tr.appendChild(pointsTd);

    techniqueStatsBody.appendChild(tr);
  }
}

function renderPointsAgainstStats(pointsAgainstStats) {
  pointsAgainstStatsBody.innerHTML = '';

  const rows = pointsAgainstStats?.byTechnique || [];

  for (const stats of rows) {
    const tr = document.createElement('tr');

    const techniqueTd = document.createElement('td');
    techniqueTd.textContent = stats.technique || '-';

    const timesTd = document.createElement('td');
    timesTd.textContent = String(stats.timesConceded || 0);

    const percentageTd = document.createElement('td');
    percentageTd.textContent = `${Number(stats.concededPercentage || 0).toFixed(1)}%`;

    tr.appendChild(techniqueTd);
    tr.appendChild(timesTd);
    tr.appendChild(percentageTd);

    pointsAgainstStatsBody.appendChild(tr);
  }
}

function renderAllPlayersOverviewTable(techniques, players) {
  allPlayersOverviewHead.innerHTML = '';
  allPlayersOverviewBody.innerHTML = '';

  const staticHeaders = ['Player', 'Wins', 'Losses', 'Draws'];
  for (const headerText of staticHeaders) {
    const th = document.createElement('th');
    th.textContent = headerText;
    allPlayersOverviewHead.appendChild(th);
  }

  for (const technique of techniques) {
    const th = document.createElement('th');
    th.textContent = `${technique} %`;
    allPlayersOverviewHead.appendChild(th);
  }

  for (const player of players) {
    const tr = document.createElement('tr');
    const totalMatches = Number(player.totalMatches || 0);

    function formatResultCell(value) {
      const count = Number(value || 0);
      const percentage = totalMatches > 0
        ? ((count / totalMatches) * 100).toFixed(1)
        : '0.0';
      return `${count} (${percentage}%)`;
    }

    const playerTd = document.createElement('td');
    playerTd.textContent = player.playerName;

    const winsTd = document.createElement('td');
    winsTd.textContent = formatResultCell(player.wins);

    const lossesTd = document.createElement('td');
    lossesTd.textContent = formatResultCell(player.losses);

    const drawsTd = document.createElement('td');
    drawsTd.textContent = formatResultCell(player.draws);

    tr.appendChild(playerTd);
    tr.appendChild(winsTd);
    tr.appendChild(lossesTd);
    tr.appendChild(drawsTd);

    for (const technique of techniques) {
      const techniquePercentage = player.techniquePercentages.find((item) => item.technique === technique);
      const percentageTd = document.createElement('td');
      percentageTd.textContent = `${Number(techniquePercentage?.scoredPercentage || 0).toFixed(1)}%`;
      tr.appendChild(percentageTd);
    }

    allPlayersOverviewBody.appendChild(tr);
  }
}

async function loadPlayerOverview() {
  const playerId = getSelectedPlayerId();
  const annotatorId = getAnnotatorId();

  if (!playerId) {
    alert('Please select a player first.');
    return;
  }

  if (!annotatorId) {
    alert('Please login as an annotator first.');
    return;
  }

  const overview = await requestJson(`/api/players/${playerId}/overview?annotatorId=${annotatorId}`);

  overviewTitle.textContent = `Player Overview: ${overview.player.name}`;
  overviewSummary.textContent = `Matches: ${overview.resultSummary.matches} | Wins: ${overview.resultSummary.wins} | Losses: ${overview.resultSummary.losses} | Draws: ${overview.resultSummary.draws}`;

  renderOverviewMatches(overview.matches);
  renderTechniqueStats(overview.techniqueStats);
  renderPointsAgainstStats(overview.pointsAgainstStats);
  showOverviewView();
}

async function loadAllPlayersOverview() {
  const annotatorId = getAnnotatorId();

  if (!annotatorId) {
    alert('Please login as an annotator first.');
    return;
  }

  const overview = await requestJson(`/api/players/overview?annotatorId=${annotatorId}`);

  allPlayersOverviewSummary.textContent = `Players: ${overview.players.length} | Match results are shown as count (percentage of total matches)`;
  renderAllPlayersOverviewTable(overview.techniques, overview.players);
  showAllPlayersOverviewView();
}

function inferLegacyEventSide(isAgainstValue, selectedPlayerSideValue) {
  const selectedSide = normalizeSide(selectedPlayerSideValue);
  const isAgainst = Boolean(isAgainstValue);

  if (selectedSide === 'ao') {
    return isAgainst ? 'aka' : 'ao';
  }

  return isAgainst ? 'ao' : 'aka';
}

async function reopenSavedMatch(matchId) {
  const match = await requestJson(`/api/matches/${matchId}`);

  showWorkspaceView();

  matchNameInput.value = match.matchName;
  matchLocationInput.value = match.location;
  matchDateInput.value = match.matchDate;
  opponentNameInput.value = match.opponentName;

  const savedSelectedPlayerSide = normalizeSide(match.selectedPlayerSide || selectedPlayerSideSelect.value);
  selectedPlayerSideSelect.value = savedSelectedPlayerSide;

  aoPlayerNameInput.value = match.aoPlayerName || (savedSelectedPlayerSide === 'ao' ? selectedPlayerName : match.opponentName || '');
  akaPlayerNameInput.value = match.akaPlayerName || (savedSelectedPlayerSide === 'aka' ? selectedPlayerName : match.opponentName || '');

  const sourceType = match.videoSourceType || (match.youtubeVideoId ? 'youtube' : 'mp4');
  const sourceValue = match.videoSourceValue || match.youtubeVideoId || '';

  videoSourceTypeSelect.value = sourceType;
  updateVideoSourceInputs();

  if (sourceType === 'youtube') {
    youtubeUrlInput.value = getYouTubeUrlFromId(sourceValue);
    localVideo.pause();
    localVideo.removeAttribute('src');
    localVideo.load();
    revokeCurrentLocalVideoObjectUrl();
    ensureYouTubePlayer(sourceValue);
    currentVideoSourceType = 'youtube';
    currentVideoSourceValue = sourceValue;
    showYouTubePlayer();
    videoStatus.textContent = `Loaded YouTube video ID: ${sourceValue}`;
  } else {
    mp4FileInput.value = '';
    revokeCurrentLocalVideoObjectUrl();
    loadLocalVideoFromUrl(sourceValue);
    currentVideoSourceType = 'mp4';
    currentVideoSourceValue = sourceValue;
    showLocalVideoPlayer();
    videoStatus.textContent = `Loaded MP4 video: ${sourceValue}`;
  }

  currentMatchEvents = match.events.map((event) => {
    const playerSide = normalizeSide(
      event.playerSide || inferLegacyEventSide(event.isAgainst, savedSelectedPlayerSide)
    );

    return {
      timestampSeconds: Number(event.timestampSeconds),
      eventType: event.eventType,
      scoreType: event.scoreType,
      technique: event.technique,
      playerSide,
      defendedByDefender: Boolean(event.defendedByDefender),
      isAgainst: isEventAgainstSelectedPlayer(playerSide),
      points: Number(event.points || 0),
      note: event.note || '',
    };
  });

  renderEventsTable();
  renderTotals();
}

async function createOrSelectPlayer() {
  const name = playerNameInput.value.trim();
  if (!name) {
    alert('Please enter a player name.');
    return;
  }

  try {
    const player = await requestJson('/api/players', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });

    await loadPlayers();
    playerSelect.value = String(player.id);
    setSelectedPlayer(player.id, player.name);
    showSelectionView();
    playerNameInput.value = '';
    currentMatchEvents = [];
    renderEventsTable();
    renderTotals();
    await loadSavedMatches();
  } catch (error) {
    alert(error.message);
  }
}

async function selectExistingPlayer() {
  const playerId = Number(playerSelect.value || 0);
  if (!playerId) {
    alert('Please select a player.');
    return;
  }

  const playerName = playerSelect.options[playerSelect.selectedIndex]?.textContent || 'Unknown';
  setSelectedPlayer(playerId, playerName);
  showSelectionView();
  currentMatchEvents = [];
  renderEventsTable();
  renderTotals();
  await loadSavedMatches();
}

async function deleteSelectedPlayer() {
  const annotatorId = getAnnotatorId();
  if (!annotatorId) {
    alert('Please login as an annotator first.');
    return;
  }

  const playerId = Number(playerSelect.value || 0);
  if (!playerId) {
    alert('Please select a player to delete.');
    return;
  }

  const playerName = playerSelect.options[playerSelect.selectedIndex]?.textContent || 'Unknown';
  const confirmed = window.confirm(
    `Delete player "${playerName}" and all related matches/events? This cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  try {
    const result = await requestJson(`/api/players/${playerId}?annotatorId=${annotatorId}`, {
      method: 'DELETE',
    });

    currentMatchEvents = [];
    renderEventsTable();
    renderTotals();
    await loadPlayers();
    alert(
      `Deleted player: ${result.playerName}. Removed ${result.deletedMatches} matches and ${result.deletedEvents} events.`
    );
  } catch (error) {
    alert(error.message);
  }
}

function clearMatchEditorForNewMatch() {
  showWorkspaceView();
  currentMatchEvents = [];
  currentVideoSourceType = null;
  currentVideoSourceValue = null;
  videoSourceTypeSelect.value = 'youtube';
  updateVideoSourceInputs();
  youtubeUrlInput.value = '';
  mp4FileInput.value = '';
  revokeCurrentLocalVideoObjectUrl();
  localVideo.pause();
  localVideo.removeAttribute('src');
  localVideo.load();
  showYouTubePlayer();
  matchNameInput.value = '';
  matchLocationInput.value = '';
  matchDateInput.value = '';
  opponentNameInput.value = '';
  selectedPlayerSideSelect.value = 'ao';
  aoPlayerNameInput.value = selectedPlayerName;
  akaPlayerNameInput.value = '';
  noteAoInput.value = '';
  noteAkaInput.value = '';
  defendedByDefenderAoCheckbox.checked = false;
  defendedByDefenderAkaCheckbox.checked = false;
  videoStatus.textContent = 'No video loaded.';
  renderEventsTable();
  renderTotals();
}

function getCurrentVideoTimestamp() {
  if (currentVideoSourceType === 'youtube') {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') {
      return null;
    }

    return ytPlayer.getCurrentTime();
  }

  if (currentVideoSourceType === 'mp4') {
    const value = Number(localVideo.currentTime);
    return Number.isNaN(value) ? null : value;
  }

  return null;
}

function readEventFromPane(playerSide) {
  const elements = getSideElements(playerSide);
  const eventType = elements.eventTypeSelect.value;

  const event = {
    timestampSeconds: 0,
    eventType,
    scoreType: null,
    technique: null,
    playerSide: normalizeSide(playerSide),
    defendedByDefender: elements.defendedCheckbox.checked,
    note: elements.noteInput.value.trim(),
    points: 0,
    isAgainst: false,
  };

  if (eventType === 'score') {
    event.scoreType = elements.scoreTypeSelect.value;
    event.technique = elements.techniqueSelect.value;
    event.points = scoreTypeToPoints(event.scoreType);
  }

  if (eventType === 'technique') {
    event.technique = elements.techniqueSelect.value;
  }

  return event;
}

async function addAnnotation(playerSide) {
  const playerId = getSelectedPlayerId();
  if (!playerId) {
    alert('Please select a player.');
    return;
  }

  if (!currentVideoSourceType || !currentVideoSourceValue) {
    alert('Please load a video first.');
    return;
  }

  const timestampSeconds = getCurrentVideoTimestamp();
  if (timestampSeconds === null) {
    alert('YouTube player is not ready yet.');
    return;
  }

  const event = readEventFromPane(playerSide);
  event.timestampSeconds = timestampSeconds;
  event.isAgainst = isEventAgainstSelectedPlayer(event.playerSide);

  currentMatchEvents.push(event);

  const pane = getSideElements(playerSide);
  pane.noteInput.value = '';

  renderEventsTable();
  renderTotals();
}

async function saveMatchResults() {
  const annotatorId = getAnnotatorId();
  const playerId = getSelectedPlayerId();
  if (!annotatorId) {
    alert('Please login as an annotator first.');
    return;
  }

  if (!playerId) {
    alert('Please select a player.');
    return;
  }

  if (!currentVideoSourceType || !currentVideoSourceValue) {
    alert('Please load a video first.');
    return;
  }

  const matchName = matchNameInput.value.trim();
  const location = matchLocationInput.value.trim();
  const matchDate = matchDateInput.value;
  const opponentName = opponentNameInput.value.trim();
  const selectedPlayerSide = normalizeSide(selectedPlayerSideSelect.value);
  const aoPlayerName = aoPlayerNameInput.value.trim();
  const akaPlayerName = akaPlayerNameInput.value.trim();

  if (!matchName || !location || !matchDate || !opponentName) {
    alert('Match name, location, date and opponent name are required.');
    return;
  }

  if (!aoPlayerName || !akaPlayerName) {
    alert('Please fill in both Ao player name and Aka player name.');
    return;
  }

  if (currentMatchEvents.length === 0) {
    alert('Add at least one event before saving match results.');
    return;
  }

  try {
    const result = await requestJson('/api/matches/save', {
      method: 'POST',
      body: JSON.stringify({
        annotatorId,
        playerId,
        videoSourceType: currentVideoSourceType,
        videoSourceValue: currentVideoSourceValue,
        youtubeVideoId: currentVideoSourceType === 'youtube' ? currentVideoSourceValue : null,
        opponentName,
        matchName,
        location,
        matchDate,
        selectedPlayerSide,
        aoPlayerName,
        akaPlayerName,
        events: currentMatchEvents.map((event) => ({
          timestampSeconds: event.timestampSeconds,
          eventType: event.eventType,
          scoreType: event.scoreType,
          technique: event.technique,
          playerSide: normalizeSide(event.playerSide),
          defendedByDefender: Boolean(event.defendedByDefender),
          note: event.note || '',
        })),
      }),
    });

    currentMatchEvents = [];
    renderEventsTable();
    renderTotals();
    await loadSavedMatches();
    alert(`Match saved. Match ID: ${result.matchId}`);
  } catch (error) {
    alert(error.message);
  }
}

async function loadVideo() {
  const sourceType = videoSourceTypeSelect.value;

  if (sourceType === 'youtube') {
    const url = youtubeUrlInput.value.trim();
    const videoId = extractVideoId(url);

    if (!videoId) {
      alert('Please provide a valid YouTube URL.');
      return;
    }

    try {
      localVideo.pause();
      localVideo.removeAttribute('src');
      localVideo.load();
      revokeCurrentLocalVideoObjectUrl();
      ensureYouTubePlayer(videoId);
      currentVideoSourceType = 'youtube';
      currentVideoSourceValue = videoId;
      showYouTubePlayer();
      videoStatus.textContent = `Loaded YouTube video ID: ${videoId}`;
      setTimestampDisplay();
    } catch (error) {
      alert(error.message);
    }

    return;
  }

  const selectedFile = mp4FileInput.files && mp4FileInput.files[0];
  if (!selectedFile) {
    alert('Please choose an MP4 file first.');
    return;
  }

  if (selectedFile.type && selectedFile.type !== 'video/mp4') {
    alert('Only MP4 files are supported.');
    return;
  }

  revokeCurrentLocalVideoObjectUrl();
  currentLocalVideoObjectUrl = URL.createObjectURL(selectedFile);
  loadLocalVideoFromUrl(currentLocalVideoObjectUrl);
  showLocalVideoPlayer();
  videoStatus.textContent = `Loading MP4 video: ${selectedFile.name}`;

  currentVideoSourceType = null;
  currentVideoSourceValue = null;

  const uploadResult = await uploadMp4File(selectedFile);

  currentVideoSourceType = 'mp4';
  currentVideoSourceValue = uploadResult.videoUrl;
  videoStatus.textContent = `Loaded MP4 video: ${selectedFile.name}`;
  setTimestampDisplay();
}

localVideo.addEventListener('loadeddata', () => {
  if (currentVideoSourceType === 'mp4') {
    setTimestampDisplay();
    renderTimeline();
  }
});

localVideo.addEventListener('error', () => {
  const mediaError = localVideo.error;
  const code = mediaError ? mediaError.code : 'unknown';
  videoStatus.textContent = `Failed to play MP4 video (error code ${code}). Try another MP4 file.`;
});

window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
  startTimestampTicker();
};

registerAnnotatorBtn.addEventListener('click', registerAnnotator);
loginAnnotatorBtn.addEventListener('click', loginAnnotator);
videoSourceTypeSelect.addEventListener('change', updateVideoSourceInputs);
loadVideoBtn.addEventListener('click', () => {
  loadVideo().catch((error) => alert(error.message));
});
createPlayerBtn.addEventListener('click', createOrSelectPlayer);
selectPlayerBtn.addEventListener('click', () => {
  selectExistingPlayer().catch((error) => alert(error.message));
});
selectedPlayerSideSelect.addEventListener('change', () => {
  for (const event of currentMatchEvents) {
    event.isAgainst = isEventAgainstSelectedPlayer(event.playerSide);
  }
  renderTotals();
});
deletePlayerBtn.addEventListener('click', () => {
  deleteSelectedPlayer().catch((error) => alert(error.message));
});
viewPlayerOverviewBtn.addEventListener('click', () => {
  loadPlayerOverview().catch((error) => alert(error.message));
});
backToSelectionBtn.addEventListener('click', showSelectionView);
viewAllPlayersOverviewBtn.addEventListener('click', () => {
  loadAllPlayersOverview().catch((error) => alert(error.message));
});
backToSelectionFromAllPlayersBtn.addEventListener('click', showSelectionView);
createNewMatchBtn.addEventListener('click', clearMatchEditorForNewMatch);
addAnnotationBtnAo.addEventListener('click', () => {
  addAnnotation('ao').catch((error) => alert(error.message));
});
addAnnotationBtnAka.addEventListener('click', () => {
  addAnnotation('aka').catch((error) => alert(error.message));
});
saveMatchBtn.addEventListener('click', saveMatchResults);
eventTypeAoSelect.addEventListener('change', () => {
  refreshPaneVisibility('ao');
});
eventTypeAkaSelect.addEventListener('change', () => {
  refreshPaneVisibility('aka');
});

updateVideoSourceInputs();
startTimestampTicker();
refreshPaneVisibility('ao');
refreshPaneVisibility('aka');
renderTotals();

const savedAnnotator = localStorage.getItem('kumiteAnnotator');
if (savedAnnotator) {
  try {
    const parsedAnnotator = JSON.parse(savedAnnotator);
    if (parsedAnnotator && parsedAnnotator.id && parsedAnnotator.name) {
      setAnnotatorState(parsedAnnotator);
      annotatorNameInput.value = parsedAnnotator.name;
      loadPlayers().catch((error) => {
        setAnnotatorState(null);
        alert(`Session expired, please login again: ${error.message}`);
      });
    }
  } catch {
    setAnnotatorState(null);
  }
} else {
  setAnnotatorState(null);
}
