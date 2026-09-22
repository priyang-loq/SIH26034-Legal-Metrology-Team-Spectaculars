const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { rateLimit } = require('../middleware/rateLimit');
const { requireString, optionalString, requireEnum } = require('../utils/validate');
const { complaintPriority } = require('../utils/priority');
const { resolveActor, refreshPriority } = require('../utils/inspectionStore');

const router = express.Router();

const COMPLAINT_CATEGORIES = [
  'INCORRECT_MRP',
  'MISSING_INFORMATION',
  'DAMAGED_PACKAGING',
  'INCORRECT_QUANTITY',
  'EXPIRED_PRODUCT',
  'MISLEADING_INFORMATION',
  'LABELLING_ISSUE',
  'OTHER'
];

const COMPLAINT_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'ACTION_TAKEN', 'RESOLVED'];

const CATEGORY_LABELS = {
  INCORRECT_MRP: 'Incorrect price / MRP',
  MISSING_INFORMATION: 'Missing information',
  DAMAGED_PACKAGING: 'Damaged packaging',
  INCORRECT_QUANTITY: 'Incorrect quantity',
  EXPIRED_PRODUCT: 'Expired product',
  MISLEADING_INFORMATION: 'Misleading information',
  LABELLING_ISSUE: 'Labelling issue',
  OTHER: 'Other'
};

// GET /api/complaints/categories - drives the consumer form
router.get('/categories', (req, res) => {
  res.json(COMPLAINT_CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id] })));
});

// POST /api/complaints
// The consumer never retypes product details: the complaint is attached to the
// inspection they just ran, and the product is derived from it.
router.post(
  '/',
  rateLimit({ windowMs: 60000, max: 12, message: 'Too many complaints submitted. Please wait a minute.' }),
  (req, res, next) => {
    try {
      const body = req.body || {};

      const inspectionId = requireString(body.inspectionId, 'inspectionId', { max: 64 });
      const category = requireEnum(body.category, COMPLAINT_CATEGORIES, 'category');
      const description = requireString(body.description, 'description', { min: 10, max: 2000 });
      const supportingInfo = optionalString(body.supportingInfo, 'supportingInfo', { max: 2000 });

      const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(inspectionId);
      if (!inspection) {
        return res.status(404).json({ error: 'That inspection does not exist, so the complaint cannot be linked.' });
      }

      const actor = resolveActor({
        type: 'CONSUMER',
        deviceToken: req.headers['x-actor-token'] || body.actorToken,
        displayName: optionalString(body.actorName, 'actorName', { max: 120 }),
        contact: optionalString(body.contact, 'contact', { max: 180 })
      });

      const { priority, reason } = complaintPriority(category);
      const id = `CMP-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

      const create = db.transaction(() => {
        db.prepare(`
          INSERT INTO complaints
            (id, inspectionId, productId, actorId, category, description, supportingInfo, status, priority, isDemo)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)
        `).run(
          id, inspectionId, inspection.productId, actor.id,
          category, description, supportingInfo, priority, inspection.isDemo ? 1 : 0
        );

        db.prepare(`
          INSERT INTO complaint_events (id, complaintId, fromStatus, toStatus, notes, actedBy)
          VALUES (?, ?, NULL, 'SUBMITTED', ?, 'consumer')
        `).run(uuidv4(), id, reason);
      });

      create();

      // A complaint can raise the priority of the inspection it belongs to.
      refreshPriority(inspectionId);

      res.status(201).json(getComplaint(id));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/complaints/:id - public tracking view for the consumer
router.get('/:id', (req, res) => {
  const complaint = getComplaint(req.params.id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
  const { authorityNotes, contact, ...publicView } = complaint;
  res.json(publicView);
});

function getComplaint(id) {
  const row = db.prepare(`
    SELECT c.*, p.name AS productName, p.brand, p.category AS productCategory,
           i.complianceStatus, i.priority AS inspectionPriority,
           u.name AS assignedAuthorityName
    FROM complaints c
    LEFT JOIN products p ON p.id = c.productId
    LEFT JOIN inspections i ON i.id = c.inspectionId
    LEFT JOIN authority_users u ON u.id = c.assignedAuthorityId
    WHERE c.id = ?
  `).get(id);

  if (!row) return null;

  row.categoryLabel = CATEGORY_LABELS[row.category] || row.category;
  row.events = db
    .prepare('SELECT * FROM complaint_events WHERE complaintId = ? ORDER BY timestamp DESC')
    .all(id);
  row.isDemo = !!row.isDemo;
  return row;
}

module.exports = { router, getComplaint, COMPLAINT_CATEGORIES, COMPLAINT_STATUSES, CATEGORY_LABELS };
