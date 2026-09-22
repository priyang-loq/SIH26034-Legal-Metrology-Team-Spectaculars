/**
 * Lightweight versioned migration runner.
 *
 * The original project created its schema inline in db.js with
 * CREATE TABLE IF NOT EXISTS, and added one column at runtime from inside a
 * route file (barcode.routes.js). That does not scale to the entities added
 * for inspections / complaints / feedback, so every new schema change now
 * lives here as a numbered migration, applied once and recorded in
 * schema_version. db.js still owns the original four tables so nothing that
 * already worked changes shape.
 */

const MIGRATIONS = [
  {
    version: 1,
    name: 'core_entities',
    up: (db) => {
      db.exec(`
        -- Canonical product identity. Scans of the same physical product now
        -- collapse onto one row so ratings and repeat-violation checks work.
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          normalizedKey TEXT NOT NULL UNIQUE,
          barcode TEXT,
          name TEXT NOT NULL,
          brand TEXT,
          manufacturer TEXT,
          category TEXT,
          imageUrl TEXT,
          isDemo INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Consumers and sellers. Consumers are identified by an anonymous
        -- device token held in the browser; sellers carry a display name.
        CREATE TABLE IF NOT EXISTS actors (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('CONSUMER', 'SELLER')),
          displayName TEXT,
          deviceToken TEXT,
          contact TEXT,
          isDemo INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS inspections (
          id TEXT PRIMARY KEY,
          scanId TEXT REFERENCES scans(id) ON DELETE SET NULL,
          productId TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          actorId TEXT REFERENCES actors(id) ON DELETE SET NULL,
          actorType TEXT NOT NULL DEFAULT 'CONSUMER',
          sourceLabel TEXT,
          complianceStatus TEXT NOT NULL,
          complianceScore INTEGER,
          compliantCount INTEGER NOT NULL DEFAULT 0,
          nonCompliantCount INTEGER NOT NULL DEFAULT 0,
          warningCount INTEGER NOT NULL DEFAULT 0,
          priority TEXT NOT NULL DEFAULT 'LOW',
          priorityReason TEXT,
          priorityOverridden INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'DETECTED',
          assignedAuthorityId TEXT REFERENCES authority_users(id) ON DELETE SET NULL,
          authorityNotes TEXT,
          imageUrl TEXT,
          reportPath TEXT,
          isDemo INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- One row per mandatory declaration checked, so the authority grid can
        -- be rendered without re-parsing the JSON blob on scans.
        CREATE TABLE IF NOT EXISTS inspection_findings (
          id TEXT PRIMARY KEY,
          inspectionId TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
          fieldId TEXT,
          fieldName TEXT NOT NULL,
          ruleReference TEXT,
          result TEXT NOT NULL,
          severity TEXT,
          description TEXT,
          detectedText TEXT,
          sortOrder INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS inspection_events (
          id TEXT PRIMARY KEY,
          inspectionId TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
          fromStatus TEXT,
          toStatus TEXT NOT NULL,
          priority TEXT,
          notes TEXT,
          actedBy TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_inspections_priority ON inspections(priority);
        CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
        CREATE INDEX IF NOT EXISTS idx_inspections_product ON inspections(productId);
        CREATE INDEX IF NOT EXISTS idx_inspections_actorType ON inspections(actorType);
        CREATE INDEX IF NOT EXISTS idx_inspections_createdAt ON inspections(createdAt);
        CREATE INDEX IF NOT EXISTS idx_findings_inspection ON inspection_findings(inspectionId);
      `);
    }
  },
  {
    version: 2,
    name: 'authority_invite_codes',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS authority_invite_codes (
          id TEXT PRIMARY KEY,
          codeHash TEXT NOT NULL,
          codePrefix TEXT NOT NULL,
          label TEXT,
          designation TEXT,
          district TEXT,
          role TEXT NOT NULL DEFAULT 'AUTHORITY',
          issuedBy TEXT REFERENCES authority_users(id) ON DELETE SET NULL,
          issuedByName TEXT,
          expiresAt TEXT,
          usedAt TEXT,
          usedBy TEXT REFERENCES authority_users(id) ON DELETE SET NULL,
          revokedAt TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_invite_prefix ON authority_invite_codes(codePrefix);
      `);

      // Extend the existing authority_users table rather than replacing it.
      addColumnIfMissing(db, 'authority_users', 'district', 'TEXT');
      addColumnIfMissing(db, 'authority_users', 'isActive', 'INTEGER NOT NULL DEFAULT 1');
      addColumnIfMissing(db, 'authority_users', 'createdVia', "TEXT NOT NULL DEFAULT 'SEED'");
      addColumnIfMissing(db, 'authority_users', 'inviteCodeId', 'TEXT');
    }
  },
  {
    version: 3,
    name: 'complaints_and_feedback',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS complaints (
          id TEXT PRIMARY KEY,
          inspectionId TEXT REFERENCES inspections(id) ON DELETE SET NULL,
          productId TEXT REFERENCES products(id) ON DELETE SET NULL,
          actorId TEXT REFERENCES actors(id) ON DELETE SET NULL,
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          supportingInfo TEXT,
          status TEXT NOT NULL DEFAULT 'SUBMITTED',
          priority TEXT NOT NULL DEFAULT 'MEDIUM',
          assignedAuthorityId TEXT REFERENCES authority_users(id) ON DELETE SET NULL,
          authorityNotes TEXT,
          isDemo INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS complaint_events (
          id TEXT PRIMARY KEY,
          complaintId TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
          fromStatus TEXT,
          toStatus TEXT NOT NULL,
          notes TEXT,
          actedBy TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS feedback (
          id TEXT PRIMARY KEY,
          productId TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          inspectionId TEXT REFERENCES inspections(id) ON DELETE SET NULL,
          actorId TEXT REFERENCES actors(id) ON DELETE SET NULL,
          rating REAL NOT NULL,
          qualityRating REAL,
          packagingRating REAL,
          labelClarityRating REAL,
          overallRating REAL,
          reviewText TEXT,
          displayName TEXT,
          isDemo INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
        CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
        CREATE INDEX IF NOT EXISTS idx_complaints_inspection ON complaints(inspectionId);
        CREATE INDEX IF NOT EXISTS idx_feedback_product ON feedback(productId);
        CREATE INDEX IF NOT EXISTS idx_feedback_createdAt ON feedback(createdAt);
      `);
    }
  },
  {
    version: 4,
    name: 'scans_link_inspection',
    up: (db) => {
      addColumnIfMissing(db, 'scans', 'inspectionId', 'TEXT');
      addColumnIfMissing(db, 'scans', 'isDemo', 'INTEGER NOT NULL DEFAULT 0');
    }
  }
];

function addColumnIfMissing(db, table, column, definition) {
  const columns = db.pragma(`table_info(${table})`);
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_version').all().map((r) => r.version)
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    const apply = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)')
        .run(migration.version, migration.name);
    });

    apply();
    console.log(`[migration] applied ${migration.version} - ${migration.name}`);
  }
}

module.exports = { runMigrations, addColumnIfMissing, MIGRATIONS };
