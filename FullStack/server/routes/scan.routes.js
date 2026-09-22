const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { upsertProduct, resolveActor, recordInspection } = require('../utils/inspectionStore');
const { adaptPythonReportToScanResult } = require('../utils/pythonReportAdapter');
const { generateComplianceReport, shouldGenerateReport } = require('../utils/pdfReport');
const { runPythonCompliance, runPythonReview } = require('../utils/pythonBridge');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const RAW_EXTRACTIONS_DIR = path.join(__dirname, '..', 'data', 'raw_extractions');
if (!fs.existsSync(RAW_EXTRACTIONS_DIR)) fs.mkdirSync(RAW_EXTRACTIONS_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image uploads are allowed.'));
  }
});

router.post('/scan-label', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'An image file is required (field name: "image").' });
    }

    const body = req.body || {};
    let meta = {};

    if (body.extractedFields) {
      try {
        const parsed = JSON.parse(body.extractedFields);
        meta = {
          principalDisplayAreaCm2: parsed.principalDisplayAreaCm2 ? Number(parsed.principalDisplayAreaCm2) : undefined,
          detectedFontHeightMm: parsed.detectedFontHeightMm ? Number(parsed.detectedFontHeightMm) : undefined,
          isImported: parsed.isImported === true,
          administeredPriceMechanism: parsed.administeredPriceMechanism === true
        };
      } catch (e) {
        return res.status(400).json({ error: 'extractedFields must be valid JSON.' });
      }
    }

    const id = `LM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const rawOutPath = path.join(RAW_EXTRACTIONS_DIR, `${id}.json`);
    let parsedReport;
    try {
      parsedReport = await runPythonCompliance(req.file.path, rawOutPath);
    } catch (e) {
      console.error('Python bridge error:', e.message);
      return res.status(500).json({ error: 'Internal pipeline error during compliance analysis.' });
    }

    const result = adaptPythonReportToScanResult(parsedReport);

    // id generated earlier
    const timestamp = new Date().toISOString();
    const imageUrl = `/uploads/${req.file.filename}`;
    const submittedBy = ['seller', 'consumer', 'authority'].includes(body.submittedBy) ? body.submittedBy : 'consumer';

    const scanRow = {
      id,
      timestamp,
      productTitle: body.productTitle || result.productTitle || req.file.originalname.replace(/\.[^/.]+$/, ''),
      brand: body.brand || result.brand || null,
      category: body.category || (result.category || null),
      packType: body.packType || null,
      batchNumber: body.batchNumber || null,
      barcode: body.barcode || result.barcode || null,
      imageUrl,
      overallStatus: result.overallStatus,
      complianceScore: result.complianceScore,
      checkedFields: JSON.stringify(result.checkedFields),
      violations: JSON.stringify(result.violations),
      principalDisplayAreaCm2: meta.principalDisplayAreaCm2 ?? null,
      minimumFontHeightMm: null,
      detectedFontHeightMm: meta.detectedFontHeightMm ?? null,
      isFontCompliant: typeof result.isFontCompliant === 'boolean' ? (result.isFontCompliant ? 1 : 0) : null,
      inspectorNotes: result.inspectorNotes || null,
      inspectionMemoNumber: null,
      estimatedStatutoryFine: result.estimatedStatutoryFine || null,
      submittedBy,
      reportPath: null,
      actionStatus: 'PENDING'
    };

    db.prepare(`
      INSERT INTO scans (
        id, timestamp, productTitle, brand, category, packType, batchNumber, barcode, imageUrl,
        overallStatus, complianceScore, checkedFields, violations, principalDisplayAreaCm2,
        minimumFontHeightMm, detectedFontHeightMm, isFontCompliant, inspectorNotes,
        inspectionMemoNumber, estimatedStatutoryFine, submittedBy, reportPath, actionStatus
      ) VALUES (
        @id, @timestamp, @productTitle, @brand, @category, @packType, @batchNumber, @barcode, @imageUrl,
        @overallStatus, @complianceScore, @checkedFields, @violations, @principalDisplayAreaCm2,
        @minimumFontHeightMm, @detectedFontHeightMm, @isFontCompliant, @inspectorNotes,
        @inspectionMemoNumber, @estimatedStatutoryFine, @submittedBy, @reportPath, @actionStatus
      )
    `).run(scanRow);

    if (shouldGenerateReport(result.overallStatus)) {
      const reportPath = generateComplianceReport(scanRow);
      db.prepare('UPDATE scans SET reportPath = ? WHERE id = ?').run(reportPath, id);
      scanRow.reportPath = reportPath;
    }

    // ---- Relational inspection history --------------------------------
    let inspectionId = null;
    let priority = null;
    let priorityReason = null;

    try {
      const product = upsertProduct({
        name: scanRow.productTitle,
        brand: scanRow.brand,
        barcode: scanRow.barcode,
        category: scanRow.category,
        manufacturer: result.manufacturer || null,
        imageUrl: scanRow.imageUrl
      });

      const actor = resolveActor({
        type: submittedBy === 'seller' ? 'SELLER' : 'CONSUMER',
        deviceToken: req.headers['x-actor-token'] || body.actorToken || null,
        displayName: body.actorName || body.sellerName || null
      });

      const inspection = recordInspection({
        scan: scanRow,
        result,
        actor,
        product
      });

      inspectionId = inspection.id;
      priority = inspection.priority;
      priorityReason = inspection.priorityReason;
    } catch (err) {
      console.error('[inspection persistence] failed:', err.message);
    }

    const finalResponse = hydrateScan(scanRow);
    if (inspectionId) {
      finalResponse.inspectionId = inspectionId;
      finalResponse.priority = priority;
      finalResponse.priorityReason = priorityReason;
    }
    res.status(201).json(finalResponse);
  } catch (err) {
    console.error('Error in POST /scan-label:', err);
    res.status(500).json({ error: 'Failed to process the scan. Please try again.' });
  }
});



router.post('/scan-label/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const fieldOverrides = body.field_overrides || body.overrides || {};

    const existingScan = db.prepare('SELECT * FROM scans WHERE id = ?').get(id);
    if (!existingScan) return res.status(404).json({ error: 'Scan not found.' });

    const rawOutPath = path.join(RAW_EXTRACTIONS_DIR, `${id}.json`);

    let parsedReport;
    try {
      parsedReport = await runPythonReview(rawOutPath, fieldOverrides);
    } catch (e) {
      console.error('Python review bridge error:', e.message);
      return res.status(500).json({ error: 'Internal pipeline error during review processing.' });
    }

    const result = adaptPythonReportToScanResult(parsedReport);

    // Keep original values where applicable, update with new report
    const scanRow = {
      ...existingScan,
      productTitle: result.productTitle || existingScan.productTitle,
      brand: result.brand || existingScan.brand,
      category: result.category || existingScan.category,
      overallStatus: result.overallStatus,
      complianceScore: result.complianceScore,
      checkedFields: JSON.stringify(result.checkedFields),
      violations: JSON.stringify(result.violations),
      inspectorNotes: result.inspectorNotes || existingScan.inspectorNotes,
      estimatedStatutoryFine: result.estimatedStatutoryFine || existingScan.estimatedStatutoryFine,
      actionStatus: 'REVIEWED'
    };

    db.prepare(`
      UPDATE scans SET
        productTitle = @productTitle, brand = @brand, category = @category,
        overallStatus = @overallStatus, complianceScore = @complianceScore,
        checkedFields = @checkedFields, violations = @violations,
        inspectorNotes = @inspectorNotes, estimatedStatutoryFine = @estimatedStatutoryFine,
        actionStatus = @actionStatus
      WHERE id = @id
    `).run(scanRow);

    if (shouldGenerateReport(result.overallStatus)) {
      const reportPath = generateComplianceReport(scanRow);
      db.prepare('UPDATE scans SET reportPath = ? WHERE id = ?').run(reportPath, id);
      scanRow.reportPath = reportPath;
    }

    res.status(200).json(hydrateScan(scanRow));
  } catch (err) {
    console.error('Error in POST /scan-label/:id/review:', err);
    res.status(500).json({ error: 'Failed to process the review. Please try again.' });
  }
});
router.get('/scan-label/:id', (req, res) => {
  const id = req.params.id;
  let row = db.prepare('SELECT * FROM scans WHERE id = ? OR inspectionId = ?').get(id, id);
  if (!row) {
    const insp = db.prepare('SELECT scanId FROM inspections WHERE id = ?').get(id);
    if (insp && insp.scanId) {
      row = db.prepare('SELECT * FROM scans WHERE id = ?').get(insp.scanId);
    }
  }
  if (!row) return res.status(404).json({ error: 'Scan not found.' });
  res.json(hydrateScan(row));
});

function hydrateScan(row) {
  return {
    ...row,
    checkedFields: typeof row.checkedFields === 'string' ? JSON.parse(row.checkedFields) : row.checkedFields,
    violations: typeof row.violations === 'string' ? JSON.parse(row.violations) : row.violations,
    isFontCompliant: row.isFontCompliant === null ? undefined : !!row.isFontCompliant
  };
}

module.exports = { router, hydrateScan };
