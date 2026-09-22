const { FIELD_RULE_MAP, getRuleById, getRuleByClause } = require('../data/legalMetrologyRules');

/**
 * Adapts the Python AI compliance report to the frontend expected ScanResult format.
 *
 * @param {Object} pythonReport - The JSON object from the Python engine.
 * @returns {Object} - The ScanResult object expected by the frontend.
 */

/**
 * Convert a 4-point pixel quadrilateral (PaddleOCR format) to an axis-aligned
 * percentage bounding box for the ScanDetailDrawer overlay.
 *
 * Returns null when:
 *   - points is missing or not a 4-element array
 *   - image dimensions are zero or absent
 * Never invents coordinates.
 *
 * @param {Array} points - [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] in absolute pixels
 * @param {number} imgW  - image width in pixels
 * @param {number} imgH  - image height in pixels
 * @param {string} label - field label for the overlay
 * @param {boolean} isCompliant
 * @returns {{ x, y, width, height, label, isCompliant } | null}
 */
function pxQuadToPercentBox(points, imgW, imgH, label, isCompliant) {
  if (!Array.isArray(points) || points.length < 4) return null;
  if (!imgW || !imgH || imgW <= 0 || imgH <= 0) return null;

  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  // Clamp to image bounds
  const x = Math.max(0, (xMin / imgW) * 100);
  const y = Math.max(0, (yMin / imgH) * 100);
  const width = Math.min(100 - x, ((xMax - xMin) / imgW) * 100);
  const height = Math.min(100 - y, ((yMax - yMin) / imgH) * 100);

  if (width <= 0 || height <= 0) return null;

  return { x, y, width, height, label, isCompliant };
}

/**
 * Extract the best available BoundingBox from a Python evidence array.
 * Returns null if evidence is empty or has no usable bbox.
 *
 * @param {Array}   evidence   - array of serialised OCRText objects
 * @param {number}  imgW       - image width in pixels
 * @param {number}  imgH       - image height in pixels
 * @param {string}  label      - field label for the overlay
 * @param {boolean} isCompliant
 * @returns {{ x, y, width, height, label, isCompliant } | null}
 */
function extractBoundingBox(evidence, imgW, imgH, label, isCompliant) {
  if (!Array.isArray(evidence) || evidence.length === 0) return null;
  const first = evidence[0];
  if (!first || !first.bbox || !first.bbox.points) return null;
  return pxQuadToPercentBox(first.bbox.points, imgW, imgH, label, isCompliant);
}

const CANONICAL_FRONTEND_CATEGORIES = [
  'Food & FMCG',
  'Cosmetics & Personal Care',
  'Electronics',
  'Pharmaceuticals & OTC',
  'Apparel & Textiles',
  'Commodities & Grains',
  'General'
];

const CATEGORY_MAP = {
  food: 'Food & FMCG',
  fmcg: 'Food & FMCG',
  cosmetic: 'Cosmetics & Personal Care',
  cosmetics: 'Cosmetics & Personal Care',
  electronics: 'Electronics',
  medical: 'Pharmaceuticals & OTC',
  pharmaceutical: 'Pharmaceuticals & OTC',
  pharmaceuticals: 'Pharmaceuticals & OTC',
  apparel: 'Apparel & Textiles',
  textiles: 'Apparel & Textiles',
  seeds: 'Commodities & Grains',
  general: 'General'
};

function normalizeCategory(rawCat) {
  if (!rawCat || typeof rawCat !== 'string') {
    return null;
  }
  const trimmed = rawCat.trim();
  if (!trimmed) {
    return null;
  }
  if (CANONICAL_FRONTEND_CATEGORIES.includes(trimmed)) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (CATEGORY_MAP[lower]) {
    return CATEGORY_MAP[lower];
  }
  return null;
}

function resolveRuleMetadata(fieldStr, ruleClause) {
  let rule = null;
  if (ruleClause) {
    rule = getRuleByClause(ruleClause) || getRuleById(ruleClause);
  }
  const ruleMeta = FIELD_RULE_MAP[fieldStr];
  if (!rule && ruleMeta && ruleMeta.ruleId) {
    rule = getRuleById(ruleMeta.ruleId);
  }
  return { rule, ruleMeta };
}

function adaptPythonReportToScanResult(pythonReport) {
  let overallStatus = pythonReport.overall_decision || "FLAGGED_REVIEW";
  if (pythonReport.violations && pythonReport.violations.length > 0) {
    overallStatus = "NON_COMPLIANT";
  } else if (pythonReport.needs_review && pythonReport.needs_review.length > 0) {
    overallStatus = "NEEDS_REVIEW";
  } else if (pythonReport.warnings && pythonReport.warnings.includes("AI_UNAVAILABLE")) {
    overallStatus = "NEEDS_REVIEW";
  }
  const imgW = pythonReport.image_width_px || 0;
  const imgH = pythonReport.image_height_px || 0;

  const checkedFields = [];

  const formatFieldName = (str) => {
    if (!str) return "";
    return str.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  const createField = (fieldStr, status, explanation) => {
    const { rule, ruleMeta } = resolveRuleMetadata(fieldStr, null);
    const ruleReference = rule ? rule.clause : (ruleMeta ? ruleMeta.ruleId : "");
    return {
      fieldId: fieldStr,
      fieldName: formatFieldName(fieldStr),
      ruleReference: ruleReference,
      status: status,
      isPresent: status === "FOUND",
      isMalformed: status === "LOW_CONFIDENCE",
      expectedFormat: ruleMeta ? ruleMeta.expectedFormat : "",
      explanation: explanation,
      severity: ruleMeta ? ruleMeta.severity : "LOW"
    };
  };

  const createObjectField = (obj, status) => {
    let finalStatus = status;
    if (obj.message && obj.message.includes("AI analysis was unavailable") && !obj.officer_override) {
      finalStatus = "AI_UNAVAILABLE";
    }

    const isCompliant = finalStatus === "FOUND";
    const label = formatFieldName(obj.field);
    const boundingBox = extractBoundingBox(obj.evidence || [], imgW, imgH, label, isCompliant);

    const { rule, ruleMeta } = resolveRuleMetadata(obj.field, obj.rule_clause);
    const ruleReference = obj.rule_clause || (rule ? rule.clause : (ruleMeta ? ruleMeta.ruleId : ""));

    return {
      fieldId: obj.field || "",
      fieldName: label,
      ruleReference: ruleReference,
      status: finalStatus,
      isPresent: finalStatus === "FOUND",
      isMalformed: finalStatus === "LOW_CONFIDENCE",
      expectedFormat: ruleMeta ? ruleMeta.expectedFormat : "",
      explanation: obj.message || "",
      severity: ruleMeta ? ruleMeta.severity : "MEDIUM",
      boundingBox: boundingBox || undefined,
      detectedText: obj.extracted_value != null ? String(obj.extracted_value) : undefined,
      originalText: obj.original_value != null ? String(obj.original_value) : undefined,
      officerOverride: obj.officer_override != null ? String(obj.officer_override) : undefined
    };
  };

  (pythonReport.passed_fields || []).forEach(f => {
    if (typeof f === 'string') {
      checkedFields.push(createField(f, "FOUND", "Passed"));
    } else {
      checkedFields.push(createObjectField(f, "FOUND"));
    }
  });

  (pythonReport.needs_review || []).forEach(f => {
    checkedFields.push(createObjectField(f, "LOW_CONFIDENCE"));
  });

  (pythonReport.violations || []).forEach(f => {
    checkedFields.push(createObjectField(f, "NOT_FOUND"));
  });

  (pythonReport.not_applicable_fields || []).forEach(f => {
    if (typeof f === 'string') {
      checkedFields.push(createField(f, "NOT_APPLICABLE", "Not applicable"));
    } else {
      checkedFields.push(createObjectField(f, "NOT_APPLICABLE"));
    }
  });

  const violations = (pythonReport.violations || []).map(v => {
    const { rule, ruleMeta } = resolveRuleMetadata(v.field, v.rule_clause);
    const clauseId = v.rule_clause || (rule ? rule.clause : (ruleMeta ? ruleMeta.ruleId : ""));
    const clauseTitle = formatFieldName(v.field) || (rule ? rule.title : "");
    const mandatoryRequirement = (rule && rule.mandatoryRequirement) || (ruleMeta && ruleMeta.expectedFormat) || "";
    const statutoryAct = (rule && rule.statutoryAct) || "";
    const penaltySection = (rule && rule.penaltySection) || "";
    const penaltyDescription = (rule && rule.penaltyDescription) || "";
    const remediationAdvice = (rule && rule.remediationAdvice) || "";
    const severity = (ruleMeta && ruleMeta.severity) || "MEDIUM";

    return {
      clauseId,
      clauseTitle,
      ruleBook: "Legal Metrology (Packaged Commodities) Rules, 2011",
      description: (rule && rule.mandatoryRequirement) || "",
      violationReason: v.message || "",
      mandatoryRequirement,
      statutoryAct,
      penaltyDescription,
      penaltySection,
      severity,
      remediationAdvice
    };
  });

  let inspectorNotes = null;
  if (pythonReport.summary) {
    if (typeof pythonReport.summary === "object") {
      inspectorNotes = `Passed: ${pythonReport.summary.passed}, Violations: ${pythonReport.summary.violations}, Needs Review: ${pythonReport.summary.needs_review}, N/A: ${pythonReport.summary.not_applicable}`;
    } else {
      inspectorNotes = String(pythonReport.summary);
    }
  }

  const pi = pythonReport.product_intelligence || {};

  return {
    id: `LM-${Date.now()}`,
    timestamp: new Date().toISOString(),
    productTitle: pi.product_name || null,
    brand: pi.brand || null,
    category: normalizeCategory(pythonReport.category),
    packType: null,
    batchNumber: null,
    barcode: pi.barcode || null,
    imageUrl: "",
    overallStatus,
    complianceScore: null,
    checkedFields,
    violations,
    principalDisplayAreaCm2: null,
    minimumFontHeightMm: null,
    detectedFontHeightMm: null,
    isFontCompliant: undefined,
    inspectorNotes,
    inspectionMemoNumber: null,
    estimatedStatutoryFine: null,
    submittedBy: "system",
    reportPath: null,
    actionStatus: "PENDING"
  };
}

module.exports = { adaptPythonReportToScanResult, normalizeCategory, CANONICAL_FRONTEND_CATEGORIES };
