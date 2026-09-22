/**
 * Everything that turns a raw scan result into durable inspection history.
 *
 * The original `scans` table is left untouched (it still stores the raw OCR /
 * rule-engine payload exactly as before). This module writes the relational
 * view on top of it: product identity, actor, per-requirement findings,
 * priority and lifecycle status.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { computePriority } = require('./priority');

const FINDING_RESULTS = ['COMPLIANT', 'NON_COMPLIANT', 'WARNING', 'NOT_APPLICABLE', 'PENDING'];

const INSPECTION_STATUSES = [
  'DETECTED',
  'PRIORITIZED',
  'UNDER_REVIEW',
  'ACTION_REQUIRED',
  'RESOLVED'
];

// -----------------------------------------------------------------------------
// Products
// -----------------------------------------------------------------------------

function normalizeKey({ barcode, name, brand }) {
  if (barcode && String(barcode).trim()) return `bc:${String(barcode).trim()}`;
  const slug = [brand, name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `nm:${slug || 'unidentified-package'}`;
}

/**
 * Finds or creates the canonical product row. Repeated scans of the same
 * package update the stored metadata instead of creating duplicates.
 */
function upsertProduct(input = {}) {
  const key = normalizeKey(input);
  const existing = db.prepare('SELECT * FROM products WHERE normalizedKey = ?').get(key);

  if (existing) {
    db.prepare(`
      UPDATE products SET
        barcode      = COALESCE(?, barcode),
        name         = COALESCE(?, name),
        brand        = COALESCE(?, brand),
        manufacturer = COALESCE(?, manufacturer),
        category     = COALESCE(?, category),
        imageUrl     = COALESCE(?, imageUrl),
        updatedAt    = datetime('now')
      WHERE id = ?
    `).run(
      input.barcode || null,
      input.name || null,
      input.brand || null,
      input.manufacturer || null,
      input.category || null,
      input.imageUrl || null,
      existing.id
    );
    return db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id);
  }

  const id = `PRD-${uuidv4().slice(0, 8).toUpperCase()}`;
  db.prepare(`
    INSERT INTO products (id, normalizedKey, barcode, name, brand, manufacturer, category, imageUrl, isDemo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    key,
    input.barcode || null,
    input.name || 'Unidentified Package',
    input.brand || null,
    input.manufacturer || null,
    input.category || null,
    input.imageUrl || null,
    input.isDemo ? 1 : 0
  );

  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}

// -----------------------------------------------------------------------------
// Actors (consumer / seller)
// -----------------------------------------------------------------------------

function resolveActor({ type, deviceToken, displayName, contact, isDemo }) {
  const actorType = type === 'SELLER' ? 'SELLER' : 'CONSUMER';

  if (deviceToken) {
    const existing = db
      .prepare('SELECT * FROM actors WHERE type = ? AND deviceToken = ?')
      .get(actorType, deviceToken);
    if (existing) {
      if (displayName && displayName !== existing.displayName) {
        db.prepare('UPDATE actors SET displayName = ? WHERE id = ?').run(displayName, existing.id);
        existing.displayName = displayName;
      }
      return existing;
    }
  }

  const id = `ACT-${uuidv4().slice(0, 8).toUpperCase()}`;
  db.prepare(`
    INSERT INTO actors (id, type, displayName, deviceToken, contact, isDemo)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    actorType,
    displayName || (actorType === 'SELLER' ? 'Unnamed Seller' : 'Anonymous Consumer'),
    deviceToken || null,
    contact || null,
    isDemo ? 1 : 0
  );

  return db.prepare('SELECT * FROM actors WHERE id = ?').get(id);
}

// -----------------------------------------------------------------------------
// Findings
// -----------------------------------------------------------------------------

/** Maps the existing checkedFields status vocabulary onto grid results. */
function fieldToResult(field) {
  const status = field.status;
  if (status === 'FOUND') return 'COMPLIANT';
  if (status === 'NOT_FOUND') return 'NON_COMPLIANT';
  if (status === 'LOW_CONFIDENCE') return 'WARNING';
  if (status === 'AI_UNAVAILABLE') return 'PENDING';
  if (status === 'NOT_APPLICABLE') return 'NOT_APPLICABLE';

  // Legacy rows that predate the status field.
  if (field.isPresent && !field.isMalformed) return 'COMPLIANT';
  if (field.isPresent && field.isMalformed) return 'WARNING';
  return 'NON_COMPLIANT';
}

function buildFindings(checkedFields = []) {
  return checkedFields.map((f, index) => ({
    fieldId: f.fieldId || null,
    fieldName: f.fieldName || f.fieldId || 'Unnamed requirement',
    ruleReference: f.ruleReference || null,
    result: fieldToResult(f),
    severity: f.severity || 'MEDIUM',
    description: f.explanation || '',
    detectedText: f.detectedText || null,
    sortOrder: index
  }));
}

function countRepeatViolations(productId, excludeInspectionId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM inspections
    WHERE productId = ?
      AND complianceStatus = 'NON_COMPLIANT'
      AND id != COALESCE(?, '')
  `).get(productId, excludeInspectionId || null);
  return row.c;
}

// -----------------------------------------------------------------------------
// Inspections
// -----------------------------------------------------------------------------

/**
 * Persists one inspection with its findings. Idempotent per scanId: calling it
 * twice for the same scan updates the existing inspection rather than
 * duplicating it, so a retried request cannot corrupt history.
 */
function recordInspection({ scan, result, actor, product, isDemo = false, createdAt }) {
  const findings = buildFindings(result.checkedFields || []);

  const compliantCount = findings.filter((f) => f.result === 'COMPLIANT').length;
  const nonCompliantCount = findings.filter((f) => f.result === 'NON_COMPLIANT').length;
  const warningCount = findings.filter((f) => f.result === 'WARNING').length;
  const applicable = findings.filter((f) => f.result !== 'NOT_APPLICABLE').length;

  const complianceScore =
    result.complianceScore != null
      ? result.complianceScore
      : applicable > 0
        ? Math.round((compliantCount / applicable) * 100)
        : null;

  const existing = scan && scan.id
    ? db.prepare('SELECT * FROM inspections WHERE scanId = ?').get(scan.id)
    : null;

  const id = existing ? existing.id : `INS-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

  const repeatViolations = countRepeatViolations(product.id, id);
  const { priority, reason } = computePriority({ findings, repeatViolations });

  const row = {
    id,
    scanId: scan ? scan.id : null,
    productId: product.id,
    actorId: actor ? actor.id : null,
    actorType: actor ? actor.type : 'CONSUMER',
    sourceLabel: (scan && scan.submittedBy) || (actor && actor.type) || 'CONSUMER',
    complianceStatus: result.overallStatus || 'NEEDS_REVIEW',
    complianceScore,
    compliantCount,
    nonCompliantCount,
    warningCount,
    priority,
    priorityReason: reason,
    status: nonCompliantCount > 0 || warningCount > 0 ? 'PRIORITIZED' : 'DETECTED',
    imageUrl: (scan && scan.imageUrl) || result.imageUrl || null,
    reportPath: (scan && scan.reportPath) || null,
    isDemo: isDemo ? 1 : 0,
    createdAt: createdAt || new Date().toISOString()
  };

  const write = db.transaction(() => {
    if (existing) {
      db.prepare(`
        UPDATE inspections SET
          productId = @productId, actorId = @actorId, actorType = @actorType,
          sourceLabel = @sourceLabel, complianceStatus = @complianceStatus,
          complianceScore = @complianceScore, compliantCount = @compliantCount,
          nonCompliantCount = @nonCompliantCount, warningCount = @warningCount,
          priority = CASE WHEN priorityOverridden = 1 THEN priority ELSE @priority END,
          priorityReason = CASE WHEN priorityOverridden = 1 THEN priorityReason ELSE @priorityReason END,
          imageUrl = @imageUrl, reportPath = @reportPath,
          updatedAt = datetime('now')
        WHERE id = @id
      `).run(row);
      db.prepare('DELETE FROM inspection_findings WHERE inspectionId = ?').run(id);
    } else {
      db.prepare(`
        INSERT INTO inspections (
          id, scanId, productId, actorId, actorType, sourceLabel, complianceStatus,
          complianceScore, compliantCount, nonCompliantCount, warningCount,
          priority, priorityReason, status, imageUrl, reportPath, isDemo, createdAt, updatedAt
        ) VALUES (
          @id, @scanId, @productId, @actorId, @actorType, @sourceLabel, @complianceStatus,
          @complianceScore, @compliantCount, @nonCompliantCount, @warningCount,
          @priority, @priorityReason, @status, @imageUrl, @reportPath, @isDemo, @createdAt, datetime('now')
        )
      `).run(row);

      db.prepare(`
        INSERT INTO inspection_events (id, inspectionId, fromStatus, toStatus, priority, notes, actedBy, timestamp)
        VALUES (?, ?, NULL, ?, ?, ?, 'system', ?)
      `).run(uuidv4(), id, row.status, priority, reason, row.createdAt);
    }

    const insertFinding = db.prepare(`
      INSERT INTO inspection_findings
        (id, inspectionId, fieldId, fieldName, ruleReference, result, severity, description, detectedText, sortOrder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    findings.forEach((f) => {
      insertFinding.run(
        uuidv4(), id, f.fieldId, f.fieldName, f.ruleReference,
        f.result, f.severity, f.description, f.detectedText, f.sortOrder
      );
    });

    if (scan && scan.id) {
      db.prepare('UPDATE scans SET inspectionId = ?, isDemo = ? WHERE id = ?')
        .run(id, isDemo ? 1 : 0, scan.id);
    }
  });

  write();

  return getInspection(id);
}

/** Recomputes priority after complaints are attached or removed. */
function refreshPriority(inspectionId) {
  const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(inspectionId);
  if (!inspection || inspection.priorityOverridden) return inspection;

  const findings = db
    .prepare('SELECT * FROM inspection_findings WHERE inspectionId = ?')
    .all(inspectionId);

  const complaints = db
    .prepare(`SELECT category FROM complaints WHERE inspectionId = ? AND status != 'RESOLVED'`)
    .all(inspectionId);

  const { priority, reason } = computePriority({
    findings,
    openComplaints: complaints.length,
    complaintCategories: complaints.map((c) => c.category),
    repeatViolations: countRepeatViolations(inspection.productId, inspectionId)
  });

  db.prepare(`UPDATE inspections SET priority = ?, priorityReason = ?, updatedAt = datetime('now') WHERE id = ?`)
    .run(priority, reason, inspectionId);

  return db.prepare('SELECT * FROM inspections WHERE id = ?').get(inspectionId);
}

function getInspection(id) {
  const inspection = db.prepare(`
    SELECT i.*,
           p.name AS productName, p.brand, p.manufacturer, p.category, p.barcode,
           p.imageUrl AS productImageUrl,
           a.displayName AS actorName, a.type AS actorKind,
           u.name AS assignedAuthorityName
    FROM inspections i
    LEFT JOIN products p ON p.id = i.productId
    LEFT JOIN actors a ON a.id = i.actorId
    LEFT JOIN authority_users u ON u.id = i.assignedAuthorityId
    WHERE i.id = ?
  `).get(id);

  if (!inspection) return null;

  inspection.findings = db
    .prepare('SELECT * FROM inspection_findings WHERE inspectionId = ? ORDER BY sortOrder ASC')
    .all(id);

  inspection.compliance = inspection.findings.filter((f) => f.result === 'COMPLIANT');
  inspection.nonCompliance = inspection.findings.filter(
    (f) => f.result === 'NON_COMPLIANT' || f.result === 'WARNING' || f.result === 'PENDING'
  );

  inspection.events = db
    .prepare('SELECT * FROM inspection_events WHERE inspectionId = ? ORDER BY timestamp DESC')
    .all(id);

  inspection.complaints = db
      .prepare(`
        SELECT c.*, p.name AS productName, u.name AS assignedAuthorityName
        FROM complaints c
        LEFT JOIN products p ON c.productId = p.id
        LEFT JOIN authority_users u ON c.assignedAuthorityId = u.id
        WHERE c.inspectionId = ? ORDER BY c.createdAt DESC
      `)
      .all(id)
      .map(c => ({
        ...c,
        categoryLabel: c.category,
        supportingInfo: c.supportingInfo ? JSON.parse(c.supportingInfo) : null
      }));

  inspection.isDemo = !!inspection.isDemo;

  return inspection;
}

/** Shared filtered list used by both the public and authority endpoints. */
function listInspections(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.actorType && filters.actorType !== 'ALL') {
    clauses.push('i.actorType = ?');
    params.push(filters.actorType);
  }
  if (filters.complianceStatus && filters.complianceStatus !== 'ALL') {
    clauses.push('i.complianceStatus = ?');
    params.push(filters.complianceStatus);
  }
  if (filters.priority && filters.priority !== 'ALL') {
    clauses.push('i.priority = ?');
    params.push(filters.priority);
  }
  if (filters.status && filters.status !== 'ALL') {
    clauses.push('i.status = ?');
    params.push(filters.status);
  }
  if (filters.productId) {
    clauses.push('i.productId = ?');
    params.push(filters.productId);
  }
  if (filters.actorId) {
    clauses.push('i.actorId = ?');
    params.push(filters.actorId);
  }
  if (filters.assignedTo) {
    clauses.push('i.assignedAuthorityId = ?');
    params.push(filters.assignedTo);
  }
  if (filters.from) {
    clauses.push('i.createdAt >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push('i.createdAt <= ?');
    params.push(filters.to);
  }
  if (filters.search) {
    clauses.push('(p.name LIKE ? OR p.brand LIKE ? OR i.id LIKE ? OR p.barcode LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const sortColumn =
    filters.sort === 'priority'
      ? `CASE i.priority WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END`
      : 'i.createdAt';
  const direction = filters.order === 'asc' ? 'ASC' : 'DESC';

  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM inspections i LEFT JOIN products p ON p.id = i.productId ${where}`)
    .get(...params).c;

  const rows = db.prepare(`
    SELECT i.*,
           p.name AS productName, p.brand, p.category, p.barcode,
           a.displayName AS actorName,
           u.name AS assignedAuthorityName,
           (SELECT COUNT(*) FROM complaints c WHERE c.inspectionId = i.id) AS complaintCount
    FROM inspections i
    LEFT JOIN products p ON p.id = i.productId
    LEFT JOIN actors a ON a.id = i.actorId
    LEFT JOIN authority_users u ON u.id = i.assignedAuthorityId
    ${where}
    ORDER BY ${sortColumn} ${direction}, i.createdAt DESC
    LIMIT ? OFFSET ?
  `).all(...params, filters.limit || 25, filters.offset || 0);

  return {
    total,
    items: rows.map((r) => ({ ...r, isDemo: !!r.isDemo }))
  };
}

function changeInspectionStatus({ id, status, priority, notes, actedBy, assignedAuthorityId }) {
  const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(id);
  if (!inspection) return null;

  const nextStatus = status || inspection.status;
  const nextPriority = priority || inspection.priority;

  db.prepare(`
    UPDATE inspections SET
      status = ?,
      priority = ?,
      priorityOverridden = CASE WHEN ? = 1 THEN 1 ELSE priorityOverridden END,
      priorityReason = CASE WHEN ? = 1 THEN ? ELSE priorityReason END,
      assignedAuthorityId = COALESCE(?, assignedAuthorityId),
      authorityNotes = COALESCE(?, authorityNotes),
      updatedAt = datetime('now')
    WHERE id = ?
  `).run(
    nextStatus,
    nextPriority,
    priority ? 1 : 0,
    priority ? 1 : 0,
    priority ? `Priority set manually to ${priority} by ${actedBy || 'an authority user'}.` : null,
    assignedAuthorityId || null,
    notes || null,
    id
  );

  db.prepare(`
    INSERT INTO inspection_events (id, inspectionId, fromStatus, toStatus, priority, notes, actedBy)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), id, inspection.status, nextStatus, nextPriority, notes || null, actedBy || 'authority');

  return getInspection(id);
}

module.exports = {
  upsertProduct,
  resolveActor,
  recordInspection,
  refreshPriority,
  getInspection,
  listInspections,
  changeInspectionStatus,
  buildFindings,
  normalizeKey,
  FINDING_RESULTS,
  INSPECTION_STATUSES
};
