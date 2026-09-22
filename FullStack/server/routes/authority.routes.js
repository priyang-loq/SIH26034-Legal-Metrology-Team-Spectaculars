const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const crypto = require('crypto');
const { listInspections, getInspection, changeInspectionStatus, refreshPriority } = require('../utils/inspectionStore');
const { requireAuthority } = require('../middleware/auth');
const { REPORTS_DIR } = require('../utils/pdfReport');

const router = express.Router();

// Every route below requires a valid authority JWT (see routes/auth.routes.js)
router.use(requireAuthority);

// GET /api/authority/violations
// Full queue of non-compliant / flagged scans awaiting authority attention.
router.get('/violations', (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT * FROM scans
    WHERE overallStatus IN ('NON_COMPLIANT', 'FLAGGED_REVIEW')
  `;
  const params = [];
  if (status && status !== 'ALL') {
    query += ' AND actionStatus = ?';
    params.push(status);
  }
  query += ' ORDER BY createdAt DESC';

  const rows = db.prepare(query).all(...params).map(hydrateScanRow);
  res.json(rows);
});

// GET /api/authority/violations/:id
router.get('/violations/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM scans WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Scan not found.' });

  const history = db.prepare('SELECT * FROM action_log WHERE scanId = ? ORDER BY timestamp DESC').all(req.params.id);
  res.json({ ...hydrateScanRow(row), actionHistory: history });
});

// POST /api/authority/violations/:id/action
// Body: { action: 'UNDER_REVIEW' | 'NOTICE_ISSUED' | 'RESOLVED', notes?: string }
router.post('/violations/:id/action', (req, res) => {
  const { action, notes } = req.body || {};
  const validActions = ['UNDER_REVIEW', 'NOTICE_ISSUED', 'RESOLVED'];

  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
  }

  const scan = db.prepare('SELECT id FROM scans WHERE id = ?').get(req.params.id);
  if (!scan) return res.status(404).json({ error: 'Scan not found.' });

  db.prepare('UPDATE scans SET actionStatus = ?, actionNotes = ? WHERE id = ?')
    .run(action, notes || null, req.params.id);

  db.prepare(`
    INSERT INTO action_log (id, scanId, action, notes, actedBy)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), req.params.id, action, notes || null, req.user.name);

  res.json({ success: true, scanId: req.params.id, actionStatus: action });
});

// GET /api/authority/reports/:id  -> downloads the auto-generated PDF for a scan
router.get('/reports/:id', (req, res) => {
  const row = db.prepare('SELECT reportPath, productTitle FROM scans WHERE id = ?').get(req.params.id);
  if (!row || !row.reportPath) {
    return res.status(404).json({ error: 'No report available for this scan.' });
  }
  const fileName = path.basename(row.reportPath);
  const absolutePath = path.join(REPORTS_DIR, fileName);
  res.download(absolutePath, `Compliance-Report-${req.params.id}.pdf`);
});

// GET /api/authority/summary - small KPI set for the portal header
router.get('/summary', (req, res) => {
  const pending = db.prepare(`SELECT COUNT(*) AS c FROM scans WHERE overallStatus IN ('NON_COMPLIANT','FLAGGED_REVIEW') AND actionStatus = 'PENDING'`).get().c;
  const underReview = db.prepare(`SELECT COUNT(*) AS c FROM scans WHERE actionStatus = 'UNDER_REVIEW'`).get().c;
  const noticesIssued = db.prepare(`SELECT COUNT(*) AS c FROM scans WHERE actionStatus = 'NOTICE_ISSUED'`).get().c;
  const resolved = db.prepare(`SELECT COUNT(*) AS c FROM scans WHERE actionStatus = 'RESOLVED'`).get().c;
  res.json({ pending, underReview, noticesIssued, resolved });
});

function hydrateScanRow(row) {
  return {
    ...row,
    checkedFields: JSON.parse(row.checkedFields || '[]'),
    violations: JSON.parse(row.violations || '[]'),
    isFontCompliant: row.isFontCompliant === null ? undefined : !!row.isFontCompliant
  };
}


// ==================================================
// 1. AUTHORITY INSPECTION ROUTES
// ==================================================
router.get('/inspections', (req, res) => {
  try {
    const { search, query, actorType, complianceStatus, priority, status, productId, actorId, assignedTo, from, to, sort, order, limit, offset } = req.query;
    const sqlLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const sqlOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const result = listInspections({
      search: search || query,
      actorType, complianceStatus, priority, status, productId, actorId, assignedTo, from, to, sort, order, limit: sqlLimit, offset: sqlOffset
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/inspections/:id', (req, res) => {
  try {
    const inspection = getInspection(req.params.id);
    if (!inspection) return res.status(404).json({ error: 'Inspection not found.' });
    res.json(inspection);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/inspections/:id', (req, res) => {
  try {
    const { status, priority, assignTo, notes } = req.body;

    if (status && !['DETECTED', 'PRIORITIZED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (priority && !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    let assignedAuthorityId = undefined;
    if (assignTo === 'me') {
      assignedAuthorityId = req.user.sub || req.user.id;
    } else if (assignTo) {
      assignedAuthorityId = assignTo;
    }

    if (assignedAuthorityId) {
      const userExists = db.prepare('SELECT id FROM authority_users WHERE id = ?').get(assignedAuthorityId);
      if (!userExists) return res.status(400).json({ error: 'Assigned authority user not found' });
    } else if (assignTo === '' || assignTo === null) {
      assignedAuthorityId = null;
    }

    if (assignedAuthorityId) {
      const userExists = db.prepare('SELECT id FROM authority_users WHERE id = ?').get(assignedAuthorityId);
      if (!userExists) return res.status(400).json({ error: 'Assigned authority user not found' });
    }

    const updated = changeInspectionStatus({
      id: req.params.id,
      status,
      priority,
      notes,
      actedBy: req.user.name,
      assignedAuthorityId
    });

    if (!updated) return res.status(404).json({ error: 'Inspection not found.' });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================================================
// 2. AUTHORITY OFFICERS
// ==================================================
router.get('/officers', (req, res) => {
  try {
    const officers = db.prepare(`
      SELECT id, name, username, designation, district
      FROM authority_users
      WHERE isActive = 1
    `).all();
    res.json(officers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================================================
// 3. COMPLAINT ROUTES
// ==================================================
router.get('/complaints', (req, res) => {
  try {
    const { status, priority, search, query, inspectionId, productId, assignedTo, limit, offset } = req.query;
    const sqlLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const sqlOffset = Math.max(parseInt(offset, 10) || 0, 0);

    let q = `
      SELECT c.*,
             i.scanId,
             p.name AS productName,
             u.name AS assignedAuthorityName
      FROM complaints c
      LEFT JOIN inspections i ON c.inspectionId = i.id
      LEFT JOIN products p ON c.productId = p.id
      LEFT JOIN authority_users u ON c.assignedAuthorityId = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) { q += ' AND c.status = ?'; params.push(status); }
    if (priority) { q += ' AND c.priority = ?'; params.push(priority); }
    if (inspectionId) { q += ' AND c.inspectionId = ?'; params.push(inspectionId); }
    if (productId) { q += ' AND c.productId = ?'; params.push(productId); }
    if (assignedTo) {
       if (assignedTo === 'me') { q += ' AND c.assignedAuthorityId = ?'; params.push(req.user.sub || req.user.id); }
       else if (assignedTo === 'unassigned') { q += ' AND c.assignedAuthorityId IS NULL'; }
       else { q += ' AND c.assignedAuthorityId = ?'; params.push(assignedTo); }
    }
    const searchStr = search || query;
    if (searchStr) {
      q += ' AND (c.description LIKE ? OR c.category LIKE ? OR p.name LIKE ?)';
      params.push(`%${searchStr}%`, `%${searchStr}%`, `%${searchStr}%`);
    }

    const countRow = db.prepare(`SELECT COUNT(*) AS total FROM (${q})`).get(...params);
    q += ' ORDER BY c.createdAt DESC LIMIT ? OFFSET ?';
    params.push(sqlLimit, sqlOffset);

    const items = db.prepare(q).all(...params).map(row => {
      return {
        ...row,
        categoryLabel: row.category,
        supportingInfo: row.supportingInfo ? JSON.parse(row.supportingInfo) : null
      };
    });

    res.json({ total: countRow.total, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/complaints/:id', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT c.*, p.name AS productName, u.name AS assignedAuthorityName
      FROM complaints c
      LEFT JOIN products p ON c.productId = p.id
      LEFT JOIN authority_users u ON c.assignedAuthorityId = u.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!row) return res.status(404).json({ error: 'Complaint not found.' });

    const complaint = {
      ...row,
      categoryLabel: row.category,
      supportingInfo: row.supportingInfo ? JSON.parse(row.supportingInfo) : null
    };

    const events = db.prepare('SELECT * FROM complaint_events WHERE complaintId = ? ORDER BY timestamp DESC').all(req.params.id);

    let inspection = null;
    if (complaint.inspectionId) {
      inspection = getInspection(complaint.inspectionId);
    }

    res.json({
      ...complaint,
      events,
      inspection
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/complaints/:id', (req, res) => {
  try {
    const { status, priority, assignTo, notes } = req.body;

    if (status && !['SUBMITTED', 'UNDER_REVIEW', 'ACTION_TAKEN', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (priority && !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    const existing = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Complaint not found' });

    let assignedAuthorityId = existing.assignedAuthorityId;
    if (assignTo === 'me') {
      assignedAuthorityId = req.user.sub || req.user.id;
    } else if (assignTo) {
      assignedAuthorityId = assignTo;
    } else if (assignTo === '' || assignTo === null) {
      assignedAuthorityId = null;
    }

    const nextStatus = status || existing.status;
    const nextPriority = priority || existing.priority;
    const nextNotes = notes !== undefined ? notes : existing.authorityNotes;

    db.prepare(`
      UPDATE complaints SET
        status = ?,
        priority = ?,
        assignedAuthorityId = ?,
        authorityNotes = ?,
        updatedAt = datetime("now")
      WHERE id = ?
    `).run(nextStatus, nextPriority, assignedAuthorityId, nextNotes, req.params.id);

    if (status && status !== existing.status) {
      db.prepare(`
        INSERT INTO complaint_events (id, complaintId, fromStatus, toStatus, actedBy, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(require('uuid').v4(), req.params.id, existing.status, nextStatus, req.user.name, notes || null);
    }

    if (existing.inspectionId && (priority || status)) {
      refreshPriority(existing.inspectionId);
    }

    const row = db.prepare(`
      SELECT c.*, p.name AS productName, u.name AS assignedAuthorityName
      FROM complaints c
      LEFT JOIN products p ON c.productId = p.id
      LEFT JOIN authority_users u ON c.assignedAuthorityId = u.id
      WHERE c.id = ?
    `).get(req.params.id);

    const complaint = {
      ...row,
      categoryLabel: row.category,
      supportingInfo: row.supportingInfo ? JSON.parse(row.supportingInfo) : null
    };

    const events = db.prepare('SELECT * FROM complaint_events WHERE complaintId = ? ORDER BY timestamp DESC').all(req.params.id);

    let inspection = null;
    if (complaint.inspectionId) {
      inspection = getInspection(complaint.inspectionId);
    }

    res.json({
      ...complaint,
      events,
      inspection
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================================================
// 4. AUTHORITY FEEDBACK
// ==================================================
router.get('/feedback', (req, res) => {
  try {
    const { productId, inspectionId, rating, limit, offset } = req.query;
    const sqlLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const sqlOffset = Math.max(parseInt(offset, 10) || 0, 0);

    let q = `
      SELECT f.*,
             p.name AS productName, p.brand AS brand,
             f.displayName AS displayName
      FROM feedback f
      LEFT JOIN products p ON f.productId = p.id
      LEFT JOIN actors a ON f.actorId = a.id
      WHERE 1=1
    `;
    const params = [];

    if (productId) { q += ' AND f.productId = ?'; params.push(productId); }
    if (inspectionId) { q += ' AND f.inspectionId = ?'; params.push(inspectionId); }
    if (rating) { q += ' AND f.rating = ?'; params.push(rating); }

    const countRow = db.prepare(`SELECT COUNT(*) AS total FROM (${q})`).get(...params);
    q += ' ORDER BY f.createdAt DESC LIMIT ? OFFSET ?';
    params.push(sqlLimit, sqlOffset);

    const items = db.prepare(q).all(...params);
    res.json({ total: countRow.total, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================================================
// 5. ADMIN INVITE CODE ROUTES
// ==================================================
router.get('/admin/invite-codes', (req, res) => {
  try {
    const codes = db.prepare('SELECT * FROM authority_invite_codes ORDER BY createdAt DESC').all();

    const mapped = codes.map(c => {
      let state = 'ACTIVE';
      if (c.revokedAt) state = 'REVOKED';
      else if (c.usedAt) state = 'USED';
      else if (new Date(c.expiresAt) < new Date()) state = 'EXPIRED';

      return {
        id: c.id,
        codePrefix: c.codePrefix,
        label: c.label,
        designation: c.designation,
        district: c.district,
        role: c.role,
        issuedByName: c.issuedByName,
        expiresAt: c.expiresAt,
        usedAt: c.usedAt,
        revokedAt: c.revokedAt,
        createdAt: c.createdAt,
        state
      };
    });
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/invite-codes', (req, res) => {
  try {
    const { label, designation, district, expiresInDays } = req.body;
    const days = parseInt(expiresInDays, 10) || 14;
    if (days < 1 || days > 365) return res.status(400).json({ error: 'expiresInDays must be between 1 and 365' });

    const rawCode = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 chars
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const codePrefix = rawCode.substring(0, 4) + '...';

    const id = require('uuid').v4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    db.prepare(`
      INSERT INTO authority_invite_codes (id, codeHash, codePrefix, label, designation, district, role, issuedBy, issuedByName, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, codeHash, codePrefix, label || null, designation || null, district || null, 'AUTHORITY', req.user.sub || req.user.id, req.user.name, expiresAt.toISOString());

    res.json({
      id,
      code: rawCode, // plaintext returned ONLY once
      codePrefix,
      label,
      designation,
      district,
      role: 'AUTHORITY',
      expiresAt: expiresAt.toISOString(),
      state: 'ACTIVE'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/admin/invite-codes/:id', (req, res) => {
  try {
    const c = db.prepare('SELECT * FROM authority_invite_codes WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Invite code not found' });

    if (c.revokedAt || c.usedAt || new Date(c.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Code is already used, revoked, or expired' });
    }

    db.prepare('UPDATE authority_invite_codes SET revokedAt = datetime("now") WHERE id = ?').run(req.params.id);
    res.json({ success: true, state: 'REVOKED' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;
