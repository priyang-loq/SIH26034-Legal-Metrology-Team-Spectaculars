const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/seller/history
// Matches the shape expected by src/services/complianceApi.ts -> fetchSellerHistory()
router.get('/history', (req, res) => {
  const rows = db.prepare(`
    SELECT id, timestamp AS date, productTitle AS productName, brand, category,
           overallStatus AS status, complianceScore AS score, imageUrl,
           id AS memoId, checkedFields
    FROM scans
    WHERE submittedBy = 'seller'
    ORDER BY createdAt DESC
    LIMIT 100
  `).all();

  const history = rows.map(r => {
    const checkedFields = JSON.parse(r.checkedFields || '[]');
    const missingFieldsCount = checkedFields.filter(f => !f.isPresent || f.isMalformed).length;
    return {
      id: r.id,
      date: r.date,
      productName: r.productName,
      brand: r.brand,
      sku: r.id,
      category: r.category,
      status: r.status,
      score: r.score,
      missingFieldsCount,
      imageUrl: r.imageUrl,
      memoId: r.memoId
    };
  });

  res.json(history);
});

module.exports = router;
