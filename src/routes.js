const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { all, get, run } = require('./db');

const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      const safeExt = extension === '.mp4' ? '.mp4' : '.mp4';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (file.mimetype === 'video/mp4' || extension === '.mp4') {
      cb(null, true);
      return;
    }
    cb(new Error('Only MP4 files are allowed.'));
  },
  limits: {
    fileSize: 1024 * 1024 * 500,
  },
});

function isValidScoreType(scoreType) {
  return ['Yuko', 'Wasari', 'Ippon'].includes(scoreType);
}

function isValidTechnique(technique) {
  return [
    'Kizami tsuki',
    'Gyaku tsuki',
    'Yoko geri',
    'Mawashi geri',
    'Ura mawashi geri',
    'Ashi barai',
  ].includes(technique);
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

function getMatchResult(pointsInFavor, pointsAgainst) {
  if (pointsInFavor > pointsAgainst) {
    return 'Win';
  }

  if (pointsInFavor < pointsAgainst) {
    return 'Loss';
  }

  return 'Draw';
}

function normalizePlayerSide(playerSide) {
  return playerSide === 'aka' ? 'aka' : 'ao';
}

function normalizeVideoSource(videoSourceType, videoSourceValue, youtubeVideoId) {
  if (videoSourceType === 'youtube') {
    const value = String(videoSourceValue || youtubeVideoId || '').trim();
    return {
      videoSourceType: 'youtube',
      videoSourceValue: value,
      youtubeVideoId: value,
    };
  }

  if (videoSourceType === 'mp4') {
    return {
      videoSourceType: 'mp4',
      videoSourceValue: String(videoSourceValue || '').trim(),
      youtubeVideoId: null,
    };
  }

  const fallbackYoutubeId = String(youtubeVideoId || '').trim();
  if (fallbackYoutubeId) {
    return {
      videoSourceType: 'youtube',
      videoSourceValue: fallbackYoutubeId,
      youtubeVideoId: fallbackYoutubeId,
    };
  }

  return {
    videoSourceType: '',
    videoSourceValue: '',
    youtubeVideoId: null,
  };
}

function registerRoutes(app) {
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/annotators/register', async (req, res) => {
    const name = (req.body.name || '').trim();

    if (!name) {
      res.status(400).json({ error: 'Annotator name is required.' });
      return;
    }

    await run('INSERT OR IGNORE INTO annotators(name) VALUES (?)', [name]);
    const annotator = await get('SELECT id, name FROM annotators WHERE name = ?', [name]);
    res.status(201).json(annotator);
  });

  app.post('/api/annotators/login', async (req, res) => {
    const name = (req.body.name || '').trim();

    if (!name) {
      res.status(400).json({ error: 'Annotator name is required.' });
      return;
    }

    const annotator = await get('SELECT id, name FROM annotators WHERE name = ?', [name]);
    if (!annotator) {
      res.status(404).json({ error: 'Annotator not found. Please register first.' });
      return;
    }

    res.json(annotator);
  });

  app.post('/api/videos/upload', upload.single('video'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No MP4 file uploaded.' });
      return;
    }

    res.status(201).json({
      videoUrl: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
      sizeBytes: req.file.size,
    });
  });

  app.get('/api/players', async (_req, res) => {
    const players = await all('SELECT id, name FROM players ORDER BY name ASC');
    res.json(players);
  });

  app.get('/api/players/overview', async (req, res) => {
    const annotatorId = Number(req.query.annotatorId);

    if (!annotatorId) {
      res.status(400).json({ error: 'Query parameter annotatorId is required.' });
      return;
    }

    const annotator = await get('SELECT id FROM annotators WHERE id = ?', [annotatorId]);
    if (!annotator) {
      res.status(404).json({ error: 'Annotator not found. Please log in again.' });
      return;
    }

    const techniques = [
      'Kizami tsuki',
      'Gyaku tsuki',
      'Yoko geri',
      'Mawashi geri',
      'Ura mawashi geri',
      'Ashi barai',
    ];

    const players = await all('SELECT id, name FROM players ORDER BY name ASC');

    const matchesByPlayerRows = await all(
      `
      SELECT
        m.player_id AS playerId,
        m.points_in_favor AS pointsInFavor,
        m.points_against AS pointsAgainst
      FROM matches m
      WHERE m.annotator_id = ?
      `,
      [annotatorId]
    );

    const eventsByPlayerRows = await all(
      `
      SELECT
        m.player_id AS playerId,
        me.technique,
        me.event_type AS eventType
      FROM match_events me
      INNER JOIN matches m ON m.id = me.match_id
      WHERE
        m.annotator_id = ?
        AND me.technique IS NOT NULL
        AND me.is_against = 0
        AND me.event_type IN ('score', 'technique')
      `,
      [annotatorId]
    );

    const playerStatsMap = new Map(
      players.map((player) => [
        player.id,
        {
          playerId: player.id,
          playerName: player.name,
          totalMatches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          techniqueStats: new Map(
            techniques.map((technique) => [
              technique,
              {
                technique,
                attempts: 0,
                scored: 0,
                scoredPercentage: 0,
              },
            ])
          ),
        },
      ])
    );

    for (const match of matchesByPlayerRows) {
      const playerStats = playerStatsMap.get(match.playerId);
      if (!playerStats) {
        continue;
      }

      playerStats.totalMatches += 1;
      const result = getMatchResult(match.pointsInFavor, match.pointsAgainst);
      if (result === 'Win') {
        playerStats.wins += 1;
      } else if (result === 'Loss') {
        playerStats.losses += 1;
      } else {
        playerStats.draws += 1;
      }
    }

    for (const event of eventsByPlayerRows) {
      const playerStats = playerStatsMap.get(event.playerId);
      if (!playerStats) {
        continue;
      }

      const techniqueStats = playerStats.techniqueStats.get(event.technique);
      if (!techniqueStats) {
        continue;
      }

      techniqueStats.attempts += 1;
      if (event.eventType === 'score') {
        techniqueStats.scored += 1;
      }
    }

    const overviewRows = players.map((player) => {
      const playerStats = playerStatsMap.get(player.id);
      const techniquePercentages = techniques.map((technique) => {
        const stats = playerStats.techniqueStats.get(technique);
        const percentage = stats.attempts > 0
          ? Number(((stats.scored / stats.attempts) * 100).toFixed(1))
          : 0;

        return {
          technique,
          scoredPercentage: percentage,
        };
      });

      return {
        playerId: playerStats.playerId,
        playerName: playerStats.playerName,
        totalMatches: playerStats.totalMatches,
        wins: playerStats.wins,
        losses: playerStats.losses,
        draws: playerStats.draws,
        techniquePercentages,
      };
    });

    res.json({
      techniques,
      players: overviewRows,
    });
  });

  app.post('/api/players', async (req, res) => {
    const name = (req.body.name || '').trim();

    if (!name) {
      res.status(400).json({ error: 'Player name is required.' });
      return;
    }

    await run('INSERT OR IGNORE INTO players(name) VALUES (?)', [name]);
    const player = await get('SELECT id, name FROM players WHERE name = ?', [name]);
    res.status(201).json(player);
  });

  app.delete('/api/players/:id', async (req, res) => {
    const playerId = Number(req.params.id);
    const annotatorId = Number(req.query.annotatorId);

    if (!playerId) {
      res.status(400).json({ error: 'Invalid player id.' });
      return;
    }

    if (!annotatorId) {
      res.status(400).json({ error: 'Query parameter annotatorId is required.' });
      return;
    }

    const annotator = await get('SELECT id FROM annotators WHERE id = ?', [annotatorId]);
    if (!annotator) {
      res.status(404).json({ error: 'Annotator not found. Please log in again.' });
      return;
    }

    const player = await get('SELECT id, name FROM players WHERE id = ?', [playerId]);
    if (!player) {
      res.status(404).json({ error: 'Player not found.' });
      return;
    }

    await run('BEGIN TRANSACTION');

    try {
      const deletedEvents = await run(
        `
        DELETE FROM match_events
        WHERE match_id IN (
          SELECT id FROM matches WHERE player_id = ?
        )
        `,
        [playerId]
      );

      const deletedMatches = await run('DELETE FROM matches WHERE player_id = ?', [playerId]);
      await run('DELETE FROM players WHERE id = ?', [playerId]);

      await run('COMMIT');

      res.json({
        playerId,
        playerName: player.name,
        deletedMatches: deletedMatches.changes,
        deletedEvents: deletedEvents.changes,
      });
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
  });

  app.get('/api/players/:id/overview', async (req, res) => {
    const playerId = Number(req.params.id);
    const annotatorId = Number(req.query.annotatorId);

    if (!playerId) {
      res.status(400).json({ error: 'Invalid player id.' });
      return;
    }

    if (!annotatorId) {
      res.status(400).json({ error: 'Query parameter annotatorId is required.' });
      return;
    }

    const player = await get('SELECT id, name FROM players WHERE id = ?', [playerId]);
    if (!player) {
      res.status(404).json({ error: 'Player not found.' });
      return;
    }

    const matches = await all(
      `
      SELECT
        m.id,
        m.match_date AS matchDate,
        m.match_name AS matchName,
        m.opponent_name AS opponentName,
        m.points_in_favor AS pointsInFavor,
        m.points_against AS pointsAgainst
      FROM matches m
      WHERE m.player_id = ? AND m.annotator_id = ?
      ORDER BY m.match_date DESC, m.id DESC
      `,
      [playerId, annotatorId]
    );

    const techniqueRows = await all(
      `
      SELECT
        me.technique,
        me.event_type AS eventType,
        me.points
      FROM match_events me
      INNER JOIN matches m ON m.id = me.match_id
      WHERE
        m.player_id = ?
        AND m.annotator_id = ?
        AND me.technique IS NOT NULL
        AND me.is_against = 0
        AND me.event_type IN ('score', 'technique')
      `,
      [playerId, annotatorId]
    );

    const pointsAgainstRows = await all(
      `
      SELECT
        me.technique,
        me.id
      FROM match_events me
      INNER JOIN matches m ON m.id = me.match_id
      WHERE
        m.player_id = ?
        AND m.annotator_id = ?
        AND me.event_type = 'score'
        AND me.is_against = 1
      `,
      [playerId, annotatorId]
    );

    const techniques = [
      'Kizami tsuki',
      'Gyaku tsuki',
      'Yoko geri',
      'Mawashi geri',
      'Ura mawashi geri',
      'Ashi barai',
    ];

    const techniqueStatsMap = new Map(
      techniques.map((technique) => [
        technique,
        {
          technique,
          attempts: 0,
          scored: 0,
          points: 0,
          scoredPercentage: 0,
        },
      ])
    );

    for (const row of techniqueRows) {
      const stats = techniqueStatsMap.get(row.technique);
      if (!stats) {
        continue;
      }

      stats.attempts += 1;
      if (row.eventType === 'score') {
        stats.scored += 1;
        stats.points += Number(row.points || 0);
      }
    }

    for (const stats of techniqueStatsMap.values()) {
      stats.scoredPercentage = stats.attempts > 0
        ? Number(((stats.scored / stats.attempts) * 100).toFixed(1))
        : 0;
    }

    const pointsAgainstByTechniqueMap = new Map(
      techniques.map((technique) => [
        technique,
        {
          technique,
          timesConceded: 0,
          concededPercentage: 0,
        },
      ])
    );

    let totalConcededScores = 0;

    for (const row of pointsAgainstRows) {
      const stats = pointsAgainstByTechniqueMap.get(row.technique);
      if (!stats) {
        continue;
      }

      stats.timesConceded += 1;
      totalConcededScores += 1;
    }

    for (const stats of pointsAgainstByTechniqueMap.values()) {
      stats.concededPercentage = totalConcededScores > 0
        ? Number(((stats.timesConceded / totalConcededScores) * 100).toFixed(1))
        : 0;
    }

    const resultSummary = {
      matches: matches.length,
      wins: 0,
      losses: 0,
      draws: 0,
    };

    const matchResults = matches.map((match) => {
      const result = getMatchResult(match.pointsInFavor, match.pointsAgainst);

      if (result === 'Win') {
        resultSummary.wins += 1;
      } else if (result === 'Loss') {
        resultSummary.losses += 1;
      } else {
        resultSummary.draws += 1;
      }

      return {
        ...match,
        result,
      };
    });

    res.json({
      player,
      resultSummary,
      matches: matchResults,
      techniqueStats: Array.from(techniqueStatsMap.values()),
      pointsAgainstStats: {
        totalConcededScores,
        byTechnique: Array.from(pointsAgainstByTechniqueMap.values()),
      },
    });
  });

  app.get('/api/matches', async (req, res) => {
    const playerId = Number(req.query.playerId);
    const annotatorId = Number(req.query.annotatorId);

    if (!playerId) {
      res.status(400).json({ error: 'Query parameter playerId is required.' });
      return;
    }

    if (!annotatorId) {
      res.status(400).json({ error: 'Query parameter annotatorId is required.' });
      return;
    }

    const rows = await all(
      `
      SELECT
        m.id,
        m.annotator_id AS annotatorId,
        a.name AS annotatorName,
        m.player_id AS playerId,
        p.name AS playerName,
        m.opponent_name AS opponentName,
        m.match_name AS matchName,
        m.location,
        m.match_date AS matchDate,
        m.selected_player_side AS selectedPlayerSide,
        m.ao_player_name AS aoPlayerName,
        m.aka_player_name AS akaPlayerName,
        m.video_source_type AS videoSourceType,
        m.video_source_value AS videoSourceValue,
        m.youtube_video_id AS youtubeVideoId,
        m.scores_in_favor AS scoresInFavor,
        m.scores_against AS scoresAgainst,
        m.warnings,
        m.points_in_favor AS pointsInFavor,
        m.points_against AS pointsAgainst,
        m.created_at AS createdAt
      FROM matches m
      INNER JOIN players p ON p.id = m.player_id
      INNER JOIN annotators a ON a.id = m.annotator_id
      WHERE m.player_id = ? AND m.annotator_id = ?
      ORDER BY m.match_date DESC, m.id DESC
      `,
      [playerId, annotatorId]
    );

    res.json(rows);
  });

  app.get('/api/matches/:id', async (req, res) => {
    const matchId = Number(req.params.id);

    if (!matchId) {
      res.status(400).json({ error: 'Invalid match id.' });
      return;
    }

    const match = await get(
      `
      SELECT
        m.id,
        m.annotator_id AS annotatorId,
        a.name AS annotatorName,
        m.player_id AS playerId,
        p.name AS playerName,
        m.opponent_name AS opponentName,
        m.match_name AS matchName,
        m.location,
        m.match_date AS matchDate,
        m.selected_player_side AS selectedPlayerSide,
        m.ao_player_name AS aoPlayerName,
        m.aka_player_name AS akaPlayerName,
        m.video_source_type AS videoSourceType,
        m.video_source_value AS videoSourceValue,
        m.youtube_video_id AS youtubeVideoId,
        m.scores_in_favor AS scoresInFavor,
        m.scores_against AS scoresAgainst,
        m.warnings,
        m.points_in_favor AS pointsInFavor,
        m.points_against AS pointsAgainst,
        m.created_at AS createdAt
      FROM matches m
      INNER JOIN players p ON p.id = m.player_id
      LEFT JOIN annotators a ON a.id = m.annotator_id
      WHERE m.id = ?
      `,
      [matchId]
    );

    if (!match) {
      res.status(404).json({ error: 'Match not found.' });
      return;
    }

    const events = await all(
      `
      SELECT
        id,
        match_id AS matchId,
        timestamp_seconds AS timestampSeconds,
        event_type AS eventType,
        score_type AS scoreType,
        technique,
        player_side AS playerSide,
        is_against AS isAgainst,
        defended_by_defender AS defendedByDefender,
        points,
        note,
        created_at AS createdAt
      FROM match_events
      WHERE match_id = ?
      ORDER BY timestamp_seconds ASC, id ASC
      `,
      [matchId]
    );

    res.json({
      ...match,
      events: events.map((event) => ({
        ...event,
        playerSide: normalizePlayerSide(event.playerSide),
        isAgainst: Boolean(event.isAgainst),
        defendedByDefender: Boolean(event.defendedByDefender),
      })),
    });
  });

  app.post('/api/matches/save', async (req, res) => {
    const {
      annotatorId,
      playerId,
      videoSourceType,
      videoSourceValue,
      youtubeVideoId,
      opponentName,
      matchName,
      location,
      matchDate,
      selectedPlayerSide,
      aoPlayerName,
      akaPlayerName,
      events = [],
    } = req.body;

    const normalizedVideoSource = normalizeVideoSource(videoSourceType, videoSourceValue, youtubeVideoId);

    if (
      !annotatorId
      || !playerId
      || !normalizedVideoSource.videoSourceType
      || !normalizedVideoSource.videoSourceValue
      || !opponentName
      || !matchName
      || !location
      || !matchDate
      || !aoPlayerName
      || !akaPlayerName
    ) {
      res.status(400).json({
        error: 'annotatorId, playerId, videoSourceType, videoSourceValue, opponentName, matchName, location, matchDate, aoPlayerName and akaPlayerName are required.',
      });
      return;
    }

    const normalizedSelectedPlayerSide = normalizePlayerSide(selectedPlayerSide);

    if (!Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: 'At least one event is required before saving.' });
      return;
    }

    const player = await get('SELECT id FROM players WHERE id = ?', [playerId]);
    if (!player) {
      res.status(404).json({ error: 'Player not found.' });
      return;
    }

    const annotator = await get('SELECT id FROM annotators WHERE id = ?', [annotatorId]);
    if (!annotator) {
      res.status(404).json({ error: 'Annotator not found. Please log in again.' });
      return;
    }

    let scoresInFavor = 0;
    let scoresAgainst = 0;
    let warnings = 0;
    let pointsInFavor = 0;
    let pointsAgainst = 0;

    for (const event of events) {
      if (!['score', 'warning', 'technique'].includes(event.eventType)) {
        res.status(400).json({ error: 'Each eventType must be score, warning or technique.' });
        return;
      }

      if (event.timestampSeconds === undefined || Number.isNaN(Number(event.timestampSeconds))) {
        res.status(400).json({ error: 'Each event requires a valid timestampSeconds.' });
        return;
      }

      if (event.eventType === 'score' && !isValidScoreType(event.scoreType)) {
        res.status(400).json({ error: 'Score events must include scoreType Yuko, Wasari, or Ippon.' });
        return;
      }

      if (event.eventType === 'score' && !isValidTechnique(event.technique)) {
        res.status(400).json({
          error: 'Score events must include technique: Kizami tsuki, Gyaku tsuki, Yoko geri, Mawashi geri, Ura mawashi geri, or Ashi barai.',
        });
        return;
      }

      if (event.eventType === 'technique' && !isValidTechnique(event.technique)) {
        res.status(400).json({
          error: 'Technique events must include technique: Kizami tsuki, Gyaku tsuki, Yoko geri, Mawashi geri, Ura mawashi geri, or Ashi barai.',
        });
        return;
      }

      if (event.eventType === 'warning') {
        warnings += 1;
      }

      const normalizedEventSide = normalizePlayerSide(event.playerSide);
      const isAgainst = normalizedSelectedPlayerSide !== normalizedEventSide;

      if (event.eventType === 'score') {
        const points = scoreTypeToPoints(event.scoreType);
        if (isAgainst) {
          scoresAgainst += 1;
          pointsAgainst += points;
        } else {
          scoresInFavor += 1;
          pointsInFavor += points;
        }
      }
    }

    await run('BEGIN TRANSACTION');

    try {
      const matchInsert = await run(
        `
        INSERT INTO matches(
          annotator_id,
          player_id,
          opponent_name,
          match_name,
          location,
          match_date,
          selected_player_side,
          ao_player_name,
          aka_player_name,
          youtube_video_id,
          video_source_type,
          video_source_value,
          scores_in_favor,
          scores_against,
          warnings,
          points_in_favor,
          points_against
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          annotatorId,
          playerId,
          String(opponentName).trim(),
          String(matchName).trim(),
          String(location).trim(),
          String(matchDate).trim(),
          normalizedSelectedPlayerSide,
          String(aoPlayerName).trim(),
          String(akaPlayerName).trim(),
          normalizedVideoSource.youtubeVideoId,
          normalizedVideoSource.videoSourceType,
          normalizedVideoSource.videoSourceValue,
          scoresInFavor,
          scoresAgainst,
          warnings,
          pointsInFavor,
          pointsAgainst,
        ]
      );

      for (const event of events) {
        const normalizedEventSide = normalizePlayerSide(event.playerSide);
        const isAgainst = normalizedSelectedPlayerSide !== normalizedEventSide;
        const points = event.eventType === 'score' ? scoreTypeToPoints(event.scoreType) : 0;
        await run(
          `
          INSERT INTO match_events(
            match_id,
            timestamp_seconds,
            event_type,
            score_type,
            technique,
            player_side,
            is_against,
            defended_by_defender,
            points,
            note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            matchInsert.id,
            Number(event.timestampSeconds),
            event.eventType,
            event.eventType === 'score' ? event.scoreType : null,
            event.eventType === 'score' || event.eventType === 'technique' ? event.technique : null,
            normalizedEventSide,
            isAgainst ? 1 : 0,
            event.defendedByDefender ? 1 : 0,
            points,
            event.note ? String(event.note).trim() : '',
          ]
        );
      }

      await run('COMMIT');

      res.status(201).json({
        matchId: matchInsert.id,
        annotatorId,
        playerId,
        opponentName: String(opponentName).trim(),
        matchName: String(matchName).trim(),
        location: String(location).trim(),
        matchDate: String(matchDate).trim(),
        selectedPlayerSide: normalizedSelectedPlayerSide,
        aoPlayerName: String(aoPlayerName).trim(),
        akaPlayerName: String(akaPlayerName).trim(),
        youtubeVideoId: normalizedVideoSource.youtubeVideoId,
        videoSourceType: normalizedVideoSource.videoSourceType,
        videoSourceValue: normalizedVideoSource.videoSourceValue,
        scoresInFavor,
        scoresAgainst,
        warnings,
        pointsInFavor,
        pointsAgainst,
        eventCount: events.length,
      });
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (error && error.message === 'Only MP4 files are allowed.') {
      res.status(400).json({ error: error.message });
      return;
    }

    console.error(error);
    res.status(500).json({ error: 'Unexpected server error.' });
  });
}

module.exports = {
  registerRoutes,
};
