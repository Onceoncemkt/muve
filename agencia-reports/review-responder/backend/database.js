const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT NOT NULL,
      business_type    TEXT NOT NULL,
      brand_personality TEXT NOT NULL,
      context          TEXT DEFAULT '',
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_credentials (
      id                          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id                   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      platform                    TEXT NOT NULL CHECK(platform IN ('google','facebook','instagram')),
      google_location_name        TEXT,
      google_access_token         TEXT,
      google_refresh_token        TEXT,
      google_token_expiry         TEXT,
      google_oauth_state          TEXT,
      meta_page_access_token      TEXT,
      meta_page_id                TEXT,
      meta_instagram_account_id   TEXT,
      UNIQUE(client_id, platform)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      platform      TEXT NOT NULL CHECK(platform IN ('google','facebook','instagram')),
      external_id   TEXT NOT NULL,
      author_name   TEXT,
      content       TEXT,
      star_rating   INTEGER,
      original_url  TEXT,
      fetched_at    TEXT DEFAULT (datetime('now')),
      ai_suggestion TEXT,
      status        TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','approved','published','ignored')),
      published_at  TEXT,
      UNIQUE(platform, external_id)
    );

    CREATE TABLE IF NOT EXISTS cron_log (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at           TEXT DEFAULT (datetime('now')),
      clients_checked  INTEGER DEFAULT 0,
      new_items        INTEGER DEFAULT 0,
      errors           TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_status    ON reviews(status);
    CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON reviews(client_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_platform  ON reviews(platform);
  `);
}

module.exports = { getDb };
