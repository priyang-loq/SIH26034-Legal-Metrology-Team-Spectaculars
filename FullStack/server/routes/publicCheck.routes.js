const express = require('express');
const { listMockCatalog, getMockProduct } = require('../data/mockProductChecks');
const { upsertProduct, resolveActor, recordInspection, getInspection } = require('../utils/inspectionStore');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * ============================================================================
 * PLACEHOLDER ROUTE - stands in for the real scanner, on purpose isolated.
 * ============================================================================
 *
 * This route never touches routes/scan.routes.js, utils/pythonBridge.js,
 * utils/pythonReportAdapter.js or utils/ruleEngine.js - the real OCR/VLM
 * pipeline your teammate owns. It reuses only the generic, scanner-agnostic
 * inspection/complaint/feedback storage (utils/inspectionStore.js) that
 * already backs the rest of the app, so every inspection created here is a
 * completely normal inspection row: it shows up in the authority portal, the
 * compliance grid, and analytics exactly like any other.
 *
 * The one deliberate difference: these inspections are created with
 * `scan: null`, so `scanId` stays NULL on the row - the same signal already
 * used elsewhere in this codebase to mean "no image was actually scanned".
 * The Public Consumer Dashboard and the authority portal both show a small
 * "Mock check - no image scanned" badge whenever scanId is null, so nobody
 * mistakes a placeholder result for a real one.
 *
 * TO REPLACE WITH THE REAL SCANNER: see the header comment in
 * server/data/mockProductChecks.js.
 */

// GET /api/public-check/catalog - list of selectable placeholder products
router.get('/catalog', (req, res) => {
  res.json(listMockCatalog());
});

// POST /api/public-check/:productKey
// Body: { actorName? } - creates a real inspection row from the placeholder
// data, so the existing complaint/feedback flows work on it unchanged.
router.post(
  '/:productKey',
  rateLimit({ windowMs: 60000, max: 30, message: 'Too many checks submitted. Please wait a minute.' }),
  (req, res) => {
    const mock = getMockProduct(req.params.productKey);

    if (!mock) {
      return res.status(404).json({ error: 'Unknown placeholder product.' });
    }

    const product = upsertProduct({
      name: mock.name,
      brand: mock.brand,
      barcode: mock.barcode,
      category: mock.category,
      manufacturer: mock.manufacturer
    });

    const actor = resolveActor({
      type: 'CONSUMER',
      deviceToken: req.headers['x-actor-token'] || req.body.actorToken || null,
      displayName: req.body.actorName || null
    });

    const inspection = recordInspection({
      scan: null, // no image was scanned - this is what marks it as a placeholder
      result: {
        overallStatus: mock.overallStatus,
        complianceScore: null,
        checkedFields: mock.checkedFields
      },
      actor,
      product
    });

    // Authority notes stay internal, same as the public GET /api/inspections/:id
    const { authorityNotes, ...publicView } = getInspection(inspection.id);
    res.status(201).json(publicView);
  }
);

module.exports = router;
