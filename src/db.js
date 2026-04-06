const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'data.sqlite3');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        id: this.lastID,
        changes: this.changes,
      });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

async function hasColumn(tableName, columnName) {
  const columns = await all(`PRAGMA table_info(${tableName})`);
  return columns.some((column) => column.name === columnName);
}

async function getCreateTableSql(tableName) {
  const row = await get(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName]
  );
  return row ? row.sql : '';
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS annotators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      annotator_id INTEGER,
      player_id INTEGER NOT NULL,
      opponent_name TEXT NOT NULL,
      match_name TEXT NOT NULL,
      location TEXT NOT NULL,
      match_date TEXT NOT NULL,
      selected_player_side TEXT NOT NULL DEFAULT 'ao' CHECK (selected_player_side IN ('ao', 'aka')),
      ao_player_name TEXT NOT NULL DEFAULT '',
      aka_player_name TEXT NOT NULL DEFAULT '',
      youtube_video_id TEXT,
      video_source_type TEXT NOT NULL DEFAULT 'youtube' CHECK (video_source_type IN ('youtube', 'mp4')),
      video_source_value TEXT NOT NULL,
      scores_in_favor INTEGER NOT NULL DEFAULT 0,
      scores_against INTEGER NOT NULL DEFAULT 0,
      warnings INTEGER NOT NULL DEFAULT 0,
      points_in_favor INTEGER NOT NULL DEFAULT 0,
      points_against INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (annotator_id) REFERENCES annotators(id),
      FOREIGN KEY (player_id) REFERENCES players(id)
    )
  `);

  const matchesHasAnnotatorId = await hasColumn('matches', 'annotator_id');
  if (!matchesHasAnnotatorId) {
    await run('ALTER TABLE matches ADD COLUMN annotator_id INTEGER');
  }

  const matchesHasVideoSourceType = await hasColumn('matches', 'video_source_type');
  const matchesHasVideoSourceValue = await hasColumn('matches', 'video_source_value');
  const matchesHasSelectedPlayerSide = await hasColumn('matches', 'selected_player_side');
  const matchesHasAoPlayerName = await hasColumn('matches', 'ao_player_name');
  const matchesHasAkaPlayerName = await hasColumn('matches', 'aka_player_name');
  const matchesSql = await getCreateTableSql('matches');
  const youtubeColumnIsNotNull = matchesSql.includes('youtube_video_id TEXT NOT NULL');

  if (!matchesHasVideoSourceType || !matchesHasVideoSourceValue || youtubeColumnIsNotNull) {
    const videoSourceTypeExpression = matchesHasVideoSourceType
      ? `
          CASE
            WHEN video_source_type IN ('youtube', 'mp4') THEN video_source_type
            WHEN youtube_video_id IS NOT NULL AND TRIM(youtube_video_id) <> '' THEN 'youtube'
            ELSE 'mp4'
          END
        `
      : `
          CASE
            WHEN youtube_video_id IS NOT NULL AND TRIM(youtube_video_id) <> '' THEN 'youtube'
            ELSE 'mp4'
          END
        `;

    const videoSourceValueExpression = matchesHasVideoSourceValue
      ? `
          CASE
            WHEN video_source_value IS NOT NULL AND TRIM(video_source_value) <> '' THEN TRIM(video_source_value)
            WHEN youtube_video_id IS NOT NULL AND TRIM(youtube_video_id) <> '' THEN TRIM(youtube_video_id)
            ELSE 'missing-source'
          END
        `
      : `
          CASE
            WHEN youtube_video_id IS NOT NULL AND TRIM(youtube_video_id) <> '' THEN TRIM(youtube_video_id)
            ELSE 'missing-source'
          END
        `;

    await run('BEGIN TRANSACTION');
    try {
      await run(`
        CREATE TABLE matches_migrated (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          annotator_id INTEGER,
          player_id INTEGER NOT NULL,
          opponent_name TEXT NOT NULL,
          match_name TEXT NOT NULL,
          location TEXT NOT NULL,
          match_date TEXT NOT NULL,
          youtube_video_id TEXT,
          video_source_type TEXT NOT NULL DEFAULT 'youtube' CHECK (video_source_type IN ('youtube', 'mp4')),
          video_source_value TEXT NOT NULL,
          scores_in_favor INTEGER NOT NULL DEFAULT 0,
          scores_against INTEGER NOT NULL DEFAULT 0,
          warnings INTEGER NOT NULL DEFAULT 0,
          points_in_favor INTEGER NOT NULL DEFAULT 0,
          points_against INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (annotator_id) REFERENCES annotators(id),
          FOREIGN KEY (player_id) REFERENCES players(id)
        )
      `);

      await run(`
        INSERT INTO matches_migrated (
          id,
          annotator_id,
          player_id,
          opponent_name,
          match_name,
          location,
          match_date,
          youtube_video_id,
          video_source_type,
          video_source_value,
          scores_in_favor,
          scores_against,
          warnings,
          points_in_favor,
          points_against,
          created_at
        )
        SELECT
          id,
          annotator_id,
          player_id,
          opponent_name,
          match_name,
          location,
          match_date,
          youtube_video_id,
          ${videoSourceTypeExpression},
          ${videoSourceValueExpression},
          scores_in_favor,
          scores_against,
          warnings,
          points_in_favor,
          points_against,
          created_at
        FROM matches
      `);

      await run('DROP TABLE matches');
      await run('ALTER TABLE matches_migrated RENAME TO matches');
      await run('COMMIT');
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
  }

  if (!matchesHasSelectedPlayerSide) {
    await run("ALTER TABLE matches ADD COLUMN selected_player_side TEXT NOT NULL DEFAULT 'ao'");
  }

  if (!matchesHasAoPlayerName) {
    await run("ALTER TABLE matches ADD COLUMN ao_player_name TEXT NOT NULL DEFAULT ''");
  }

  if (!matchesHasAkaPlayerName) {
    await run("ALTER TABLE matches ADD COLUMN aka_player_name TEXT NOT NULL DEFAULT ''");
  }

  await run(`
    CREATE TABLE IF NOT EXISTS match_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      timestamp_seconds REAL NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('score', 'warning')),
      score_type TEXT CHECK (score_type IN ('Yuko', 'Wasari', 'Ippon') OR score_type IS NULL),
      technique TEXT,
      player_side TEXT NOT NULL DEFAULT 'ao' CHECK (player_side IN ('ao', 'aka')),
      is_against INTEGER NOT NULL DEFAULT 0 CHECK (is_against IN (0, 1)),
      defended_by_defender INTEGER NOT NULL DEFAULT 0 CHECK (defended_by_defender IN (0, 1)),
      points INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES matches(id)
    )
  `);

  const matchEventsHasTechnique = await hasColumn('match_events', 'technique');
  const matchEventsHasPlayerSide = await hasColumn('match_events', 'player_side');
  const matchEventsHasDefendedByDefender = await hasColumn('match_events', 'defended_by_defender');
  if (!matchEventsHasTechnique) {
    await run('ALTER TABLE match_events ADD COLUMN technique TEXT');
  }

  if (!matchEventsHasPlayerSide) {
    await run("ALTER TABLE match_events ADD COLUMN player_side TEXT NOT NULL DEFAULT 'ao'");
  }

  if (!matchEventsHasDefendedByDefender) {
    await run("ALTER TABLE match_events ADD COLUMN defended_by_defender INTEGER NOT NULL DEFAULT 0");
  }

  const matchEventsSql = await getCreateTableSql('match_events');
  if (matchEventsSql && !matchEventsSql.includes("'technique'")) {
    await run('BEGIN TRANSACTION');
    try {
      await run(`
        CREATE TABLE match_events_migrated (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          match_id INTEGER NOT NULL,
          timestamp_seconds REAL NOT NULL,
          event_type TEXT NOT NULL CHECK (event_type IN ('score', 'warning', 'technique')),
          score_type TEXT CHECK (score_type IN ('Yuko', 'Wasari', 'Ippon') OR score_type IS NULL),
          technique TEXT,
          player_side TEXT NOT NULL DEFAULT 'ao' CHECK (player_side IN ('ao', 'aka')),
          is_against INTEGER NOT NULL DEFAULT 0 CHECK (is_against IN (0, 1)),
          defended_by_defender INTEGER NOT NULL DEFAULT 0 CHECK (defended_by_defender IN (0, 1)),
          points INTEGER NOT NULL DEFAULT 0,
          note TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (match_id) REFERENCES matches(id)
        )
      `);

      await run(`
        INSERT INTO match_events_migrated (
          id,
          match_id,
          timestamp_seconds,
          event_type,
          score_type,
          technique,
          player_side,
          is_against,
          defended_by_defender,
          points,
          note,
          created_at
        )
        SELECT
          id,
          match_id,
          timestamp_seconds,
          event_type,
          score_type,
          technique,
          CASE
            WHEN player_side IN ('ao', 'aka') THEN player_side
            WHEN is_against = 1 THEN 'aka'
            ELSE 'ao'
          END,
          is_against,
          defended_by_defender,
          points,
          note,
          created_at
        FROM match_events
      `);

      await run('DROP TABLE match_events');
      await run('ALTER TABLE match_events_migrated RENAME TO match_events');
      await run('COMMIT');
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
  }
}

module.exports = {
  db,
  run,
  all,
  get,
  initDb,
};
