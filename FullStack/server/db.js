const path = require('path');
const Database = require('better-sqlite3');
const { runMigrations } = require('./migrations');

const DB_PATH = path.join(__dirname, 'lmpc.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS authority_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    name TEXT NOT NULL,
    designation TEXT,
    role TEXT NOT NULL DEFAULT 'AUTHORITY',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    productTitle TEXT,
    brand TEXT,
    category TEXT,
    packType TEXT,
    batchNumber TEXT,
    barcode TEXT,
    imageUrl TEXT,
    overallStatus TEXT NOT NULL,
    complianceScore INTEGER,
    checkedFields TEXT NOT NULL,      -- JSON: FieldComplianceResult[]
    violations TEXT NOT NULL,          -- JSON: RuleClauseViolation[]
    principalDisplayAreaCm2 REAL,
    minimumFontHeightMm REAL,
    detectedFontHeightMm REAL,
    isFontCompliant INTEGER,
    inspectorNotes TEXT,
    inspectionMemoNumber TEXT,
    estimatedStatutoryFine TEXT,
    submittedBy TEXT NOT NULL DEFAULT 'seller',  -- 'seller' | 'consumer' | 'authority'
    reportPath TEXT,                    -- path to generated PDF, if non-compliant
    actionStatus TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | UNDER_REVIEW | NOTICE_ISSUED | RESOLVED
    actionNotes TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS action_log (
    id TEXT PRIMARY KEY,
    scanId TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    notes TEXT,
    actedBy TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS barcode_lookups (
    code TEXT PRIMARY KEY,
    found INTEGER NOT NULL,
    productTitle TEXT,
    brand TEXT,
    category TEXT,
    imageUrl TEXT,
    source TEXT,
    cachedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(overallStatus);
  CREATE INDEX IF NOT EXISTS idx_scans_actionStatus ON scans(actionStatus);
  CREATE INDEX IF NOT EXISTS idx_scans_createdAt ON scans(createdAt);
`);

runMigrations(db);

module.exports = db;
