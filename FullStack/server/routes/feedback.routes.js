const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { rateLimit } = require('../middleware/rateLimit');
const { requireRating, optionalRating, optionalString } = require('../utils/validate');
const { resolveActor } = require('../utils/inspectionStore');

const router = express.Router();

/**
 * Aggregate rating view for a product. Deliberately returns no consumer
 * identity beyond an optional display name the reviewer chose themselves.
 */
function productRatingSummary(productId, { limit = 10 } = {}) {
  const agg = db.prepare(`
    SELECT COUNT(*) AS count, AVG(rating) AS average
    FROM feedback WHERE productId = ?
  `).get(productId);

  const distributionRows = db.prepare(`
    SELECT CAST(ROUND(rating) AS INTEGER) AS star, COUNT(*) AS count
    FROM feedback WHERE productId = ?
    GROUP BY star
  `).all(productId);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distributionRows.forEach((r) => {
    const star = Math.min(5, Math.max(1, r.star));
    distribution[star] += r.count;
  });

  const categoryAverages = db.prepare(`
    SELECT AVG(qualityRating) AS quality,
           AVG(packagingRating) AS packaging,
           AVG(labelClarityRating) AS labelClarity,
           AVG(overallRating) AS overall
    FROM feedback WHERE productId = ?
  `).get(productId);

  const recent = db.prepare(`
    SELECT id, rating, reviewText, displayName, qualityRating, packagingRating,
           labelClarityRating, overallRating, createdAt, isDemo
    FROM feedback WHERE productId = ?
    ORDER BY createdAt DESC LIMIT ?
  `).all(productId, limit);

  return {
    productId,
    count: agg.count || 0,
    average: agg.average ? Number(agg.average.toFixed(2)) : 0,
    distribution,
    categoryAverages: {
      quality: round1(categoryAverages.quality),
      packaging: round1(categoryAverages.packaging),
      labelClarity: round1(categoryAverages.labelClarity),
      overall: round1(categoryAverages.overall)
    },
    recent: recent.map((r) => ({ ...r, isDemo: !!r.isDemo }))
  };
}

function round1(value) {
  return value === null || value === undefined ? null : Number(Number(value).toFixed(1));
}

// POST /api/feedback - open to consumers, no login required
router.post(
  '/',
  rateLimit({ windowMs: 60000, max: 15, message: 'Too much feedback submitted at once. Please wait a minute.' }),
  (req, res, next) => {
    try {
      const body = req.body || {};
      const rating = requireRating(body.rating, 'rating');

      let productId = body.productId || null;
      let inspectionId = body.inspectionId || null;

      if (inspectionId) {
        const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(inspectionId);
        if (!inspection) {
          return res.status(404).json({ error: 'That inspection does not exist.' });
        }
        productId = inspection.productId;
      }

      if (!productId) {
        return res.status(400).json({ error: 'Either productId or inspectionId is required.' });
      }

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      if (!product) return res.status(404).json({ error: 'Product not found.' });

      const actor = resolveActor({
        type: 'CONSUMER',
        deviceToken: req.headers['x-actor-token'] || body.actorToken,
        displayName: optionalString(body.displayName, 'displayName', { max: 60 })
      });

      const id = `FBK-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

      db.prepare(`
        INSERT INTO feedback
          (id, productId, inspectionId, actorId, rating, qualityRating, packagingRating,
           labelClarityRating, overallRating, reviewText, displayName, isDemo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        id,
        productId,
        inspectionId,
        actor.id,
        rating,
        optionalRating(body.qualityRating, 'qualityRating'),
        optionalRating(body.packagingRating, 'packagingRating'),
        optionalRating(body.labelClarityRating, 'labelClarityRating'),
        optionalRating(body.overallRating, 'overallRating'),
        optionalString(body.reviewText, 'reviewText', { max: 1500 }),
        optionalString(body.displayName, 'displayName', { max: 60 })
      );

      res.status(201).json({
        success: true,
        id,
        message: 'Thank you. Your feedback has been recorded against this product.',
        summary: productRatingSummary(productId)
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/feedback/product/:productId - public aggregate + recent reviews
router.get('/product/:productId', (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(productRatingSummary(req.params.productId, { limit: Number(req.query.limit) || 10 }));
});

// GET /api/feedback/inspection/:inspectionId - convenience for the scan screen
router.get('/inspection/:inspectionId', (req, res) => {
  const inspection = db.prepare('SELECT productId FROM inspections WHERE id = ?').get(req.params.inspectionId);
  if (!inspection) return res.status(404).json({ error: 'Inspection not found.' });
  res.json(productRatingSummary(inspection.productId));
});

module.exports = { router, productRatingSummary };
