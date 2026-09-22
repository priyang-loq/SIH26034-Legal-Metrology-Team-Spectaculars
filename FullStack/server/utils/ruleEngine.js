const { FIELD_RULE_MAP, getRuleById } = require('../data/legalMetrologyRules');
const { FIELD_STATUS, combineFieldStatus, resolveCategoryExemption } = require('../data/ruleCoverage');

const MANDATORY_FIELD_IDS = Object.keys(FIELD_RULE_MAP);

/**
 * ============================================================================
 * JSON CONTRACT WITH THE OCR / RULE-EXTRACTION TEAMMATE
 * ============================================================================
 * POST /api/scan-label can include an `extractedFields` JSON string shaped like:
 *
 * {
 *   "extractedFields": {
 *     "mrp":                  { "present": true,  "malformed": false, "text": "MRP Rs. 249 (incl. of all taxes)" },
 *     "net_quantity":         { "present": true,  "malformed": true,  "text": "approx 500g" },
 *     "manufacturer":         { "present": false, "malformed": false },
 *     "packer":               { "present": true,  "malformed": false, "text": "Packed & Marketed by Y" },
 *     "importer":              { "present": false, "malformed": false },
 *     "consumer_care":        { "present": true,  "malformed": false, "text": "..." },
 *     "date_of_manufacture":  { "present": true,  "malformed": false, "text": "03/2025" },
 *     "country_of_origin":    { "present": true,  "malformed": false, "text": "India" }
 *   },
 *   "principalDisplayAreaCm2": 240,
 *   "detectedFontHeightMm": 1.8,
 *   "isImported": false,
 *   "administeredPriceMechanism": false
 * }
 *
 * Notes on this contract:
 * - "manufacturer_details" can be supplied either as a single flat field (old
 *   style, still supported) OR as separate "manufacturer" / "packer" /
 *   "importer" entries. When separate entries are given, whichever is
 *   present is accepted, with manufacturer > packer > importer priority
 *   (per RULE_COVERAGE_FOR_TEAM.md Part A) - a label that only says "Packed
 *   & Marketed by Y" with no separate manufacturer named is accepted on Y.
 * - Any field entry can optionally include `"status": "AI_UNAVAILABLE"` (or
 *   "LOW_CONFIDENCE") to signal an uncertain/failed extraction rather than a
 *   confident present/absent read. This is combined with the present/
 *   malformed-derived status using worst-status-wins, so an AI outage never
 *   produces a fabricated pass or false violation.
 * - Any field left out is treated as NOT PRESENT.
 * - If `extractedFields` is omitted entirely, a deterministic demo
 *   extraction is used instead, so the rest of the system stays testable.
 * ============================================================================
 */

function demoExtraction(fileName = '') {
  const name = fileName.toLowerCase();
  const looksCompliant = /pass|good|compliant|almond|ghee|ok\b/.test(name);

  if (looksCompliant) {
    return {
      mrp: { present: true, malformed: false, text: 'MRP Rs. 249.00 (incl. of all taxes)' },
      net_quantity: { present: true, malformed: false, text: 'Net Qty: 500 g' },
      manufacturer_details: { present: true, malformed: false, text: 'GreenLife Organics Pvt Ltd, Pune 411028' },
      consumer_care: { present: true, malformed: false, text: 'Tel: 1800-XXX-XXXX, care@brand.in' },
      date_of_manufacture: { present: true, malformed: false, text: '03/2025' },
      country_of_origin: { present: true, malformed: false, text: 'India' }
    };
  }

  return {
    mrp: { present: true, malformed: true, text: 'MRP Rs. 150 + GST extra' },
    net_quantity: { present: true, malformed: true, text: 'approx 500g' },
    manufacturer_details: { present: false, malformed: false },
    consumer_care: { present: false, malformed: false },
    date_of_manufacture: { present: true, malformed: false, text: '11/2024' },
    country_of_origin: { present: true, malformed: false, text: 'India' }
  };
}

/**
 * Derives a FIELD_STATUS from a single extracted-field entry's present/
 * malformed/status signals, combining an explicit `status` override (e.g.
 * "AI_UNAVAILABLE") with the derived present/malformed reading, worst wins.
 */
function deriveStatus(extracted) {
  const derived = !extracted || extracted.present !== true
    ? FIELD_STATUS.NOT_FOUND
    : extracted.malformed === true
      ? FIELD_STATUS.LOW_CONFIDENCE
      : FIELD_STATUS.FOUND;

  if (extracted && extracted.status && FIELD_STATUS[extracted.status]) {
    return combineFieldStatus(derived, FIELD_STATUS[extracted.status]);
  }
  return derived;
}

/**
 * Resolves the manufacturer/packer/importer priority field per
 * RULE_COVERAGE_FOR_TEAM.md Part A: accept whichever source is present,
 * manufacturer first, then packer, then importer. Falls back to a flat
 * "manufacturer_details" field for backward compatibility.
 */
function resolveManufacturerField(extractedFields) {
  const sources = ['manufacturer', 'packer', 'importer'];
  for (const key of sources) {
    const entry = extractedFields[key];
    if (entry && entry.present) {
      return { ...entry, sourceUsed: key };
    }
  }
  if (extractedFields.manufacturer_details) {
    return { ...extractedFields.manufacturer_details, sourceUsed: 'manufacturer_details' };
  }
  return extractedFields.manufacturer || extractedFields.manufacturer_details || null;
}

function buildCheckedField(fieldId, ruleMeta, rule, extracted, status, exemptReason) {
  const isPresent = status === FIELD_STATUS.FOUND;
  const isMalformed = status === FIELD_STATUS.LOW_CONFIDENCE;

  let explanation;
  if (status === FIELD_STATUS.NOT_APPLICABLE) {
    explanation = exemptReason || `${ruleMeta.fieldName} is not applicable for this product category.`;
  } else if (status === FIELD_STATUS.AI_UNAVAILABLE) {
    explanation = `${ruleMeta.fieldName} could not be verified - the extraction service was unavailable. Needs manual review, not treated as a pass or a violation.`;
  } else if (status === FIELD_STATUS.FOUND) {
    explanation = `${ruleMeta.fieldName} declaration meets statutory requirements.`;
  } else if (status === FIELD_STATUS.LOW_CONFIDENCE) {
    explanation = `${ruleMeta.fieldName} was detected but with low confidence - flagged for manual review rather than an automatic pass or fail.`;
  } else {
    explanation = `${ruleMeta.fieldName} was not detected on the label.`;
  }

  return {
    fieldId,
    fieldName: ruleMeta.fieldName,
    ruleReference: rule ? rule.clause : ruleMeta.ruleId,
    status,
    isPresent,
    isMalformed,
    detectedText: extracted && extracted.text ? extracted.text : undefined,
    expectedFormat: ruleMeta.expectedFormat,
    explanation,
    severity: ruleMeta.severity
  };
}

function makeViolation(rule, ruleMeta, extracted, status) {
  const reasonByStatus = {
    [FIELD_STATUS.NOT_FOUND]: `${ruleMeta.fieldName} is missing from the principal display panel.`,
    [FIELD_STATUS.LOW_CONFIDENCE]: `${ruleMeta.fieldName} was detected but with low confidence and could not be verified as meeting the required format.`
  };

  return {
    clauseId: rule ? rule.clause : ruleMeta.ruleId,
    clauseTitle: rule ? rule.title : ruleMeta.fieldName,
    ruleBook: 'Legal Metrology (Packaged Commodities) Rules, 2011',
    description: rule ? rule.mandatoryRequirement : ruleMeta.expectedFormat,
    violationReason: reasonByStatus[status] || `${ruleMeta.fieldName} does not satisfy the mandatory requirement.`,
    detectedSnippet: extracted && extracted.text ? extracted.text : undefined,
    mandatoryRequirement: ruleMeta.expectedFormat,
    statutoryAct: rule ? rule.statutoryAct : 'Legal Metrology Act, 2009 (Sec 36)',
    penaltyDescription: rule ? rule.penaltyDescription : 'Fine as prescribed under Section 36.',
    penaltySection: rule ? rule.penaltySection : 'Section 36(1)',
    severity: ruleMeta.severity,
    remediationAdvice: rule ? rule.remediationAdvice : `Correct the ${ruleMeta.fieldName} declaration.`
  };
}

/**
 * Runs compliance checking against extracted label fields and returns the
 * pieces needed to build a full ScanResult on the caller side.
 *
 * @param {object} extractedFields - see JSON contract above
 * @param {object} meta - { principalDisplayAreaCm2, detectedFontHeightMm, isImported, administeredPriceMechanism }
 * @param {string} [category] - free-text product category from the frontend form
 */
function checkCompliance(extractedFields, meta = {}, category = null) {
  const exemption = resolveCategoryExemption(category);
  const checkedFields = [];
  const violations = [];
  let hardFailCount = 0;
  let reviewCount = 0;
  let applicableCount = 0;

  // Food category: LMPC checks are not run at all - governed by FSSAI.
  if (exemption && exemption.skipAll) {
    for (const fieldId of MANDATORY_FIELD_IDS) {
      const ruleMeta = FIELD_RULE_MAP[fieldId];
      const rule = getRuleById(ruleMeta.ruleId);
      checkedFields.push(buildCheckedField(
        fieldId, ruleMeta, rule, null, FIELD_STATUS.NOT_APPLICABLE,
        `LMPC checks are not run for the "${exemption.name}" category - ${exemption.reason}`
      ));
    }
    return {
      checkedFields,
      violations: [],
      overallStatus: 'COMPLIANT',
      complianceScore: 100,
      estimatedStatutoryFine: '₹0',
      isFontCompliant: undefined,
      categoryExemptionApplied: exemption.name
    };
  }

  for (const fieldId of MANDATORY_FIELD_IDS) {
    const ruleMeta = FIELD_RULE_MAP[fieldId];
    const rule = getRuleById(ruleMeta.ruleId);

    if (fieldId === 'manufacturer_details') {
      const extracted = resolveManufacturerField(extractedFields);
      const status = deriveStatus(extracted);
      applicableCount += 1;
      checkedFields.push(buildCheckedField(fieldId, ruleMeta, rule, extracted, status));
      if (status === FIELD_STATUS.NOT_FOUND) {
        hardFailCount += 1;
        violations.push(makeViolation(rule, ruleMeta, extracted, status));
      } else if (status === FIELD_STATUS.LOW_CONFIDENCE || status === FIELD_STATUS.AI_UNAVAILABLE) {
        reviewCount += 1;
      }
      continue;
    }

    if (fieldId === 'country_of_origin' && meta.isImported !== true) {
      checkedFields.push(buildCheckedField(
        fieldId, ruleMeta, rule, extractedFields[fieldId], FIELD_STATUS.NOT_APPLICABLE,
        'Country of Origin is only legally required for imported products. Import status for this scan is unknown, so this field is shown as informational only and is not enforced as a violation.'
      ));
      continue;
    }

    const isExemptField = exemption && exemption.exemptFields && exemption.exemptFields.includes(fieldId);
    const isConditionallyExempt = exemption && exemption.conditionalExemptFields
      && exemption.conditionalExemptFields.includes(fieldId)
      && meta.administeredPriceMechanism === true;

    if (isExemptField || isConditionallyExempt) {
      checkedFields.push(buildCheckedField(
        fieldId, ruleMeta, rule, extractedFields[fieldId], FIELD_STATUS.NOT_APPLICABLE,
        `Not applicable for the "${exemption.name}" category - ${exemption.reason}`
      ));
      continue;
    }

    const extracted = extractedFields[fieldId];
    const status = deriveStatus(extracted);
    applicableCount += 1;
    checkedFields.push(buildCheckedField(fieldId, ruleMeta, rule, extracted, status));

    if (status === FIELD_STATUS.NOT_FOUND) {
      hardFailCount += 1;
      violations.push(makeViolation(rule, ruleMeta, extracted, status));
    } else if (status === FIELD_STATUS.LOW_CONFIDENCE) {
      reviewCount += 1;
      violations.push(makeViolation(rule, ruleMeta, extracted, status));
    } else if (status === FIELD_STATUS.AI_UNAVAILABLE) {
      reviewCount += 1;
    }
  }

  let isFontCompliant;
  if (typeof meta.detectedFontHeightMm === 'number' && typeof meta.principalDisplayAreaCm2 === 'number') {
    const minRequiredMm = meta.principalDisplayAreaCm2 > 500 ? 4.0 : meta.principalDisplayAreaCm2 > 100 ? 2.5 : 2.0;
    isFontCompliant = meta.detectedFontHeightMm >= minRequiredMm;
    applicableCount += 1;
    if (!isFontCompliant) {
      hardFailCount += 1;
      const rule = getRuleById('rule_9_1');
      violations.push({
        clauseId: rule.clause,
        clauseTitle: rule.title,
        ruleBook: 'Legal Metrology (Packaged Commodities) Rules, 2011',
        description: rule.mandatoryRequirement,
        violationReason: `Detected font height ${meta.detectedFontHeightMm}mm is below the required ${minRequiredMm}mm for a ${meta.principalDisplayAreaCm2}cm² display panel.`,
        mandatoryRequirement: `Minimum ${minRequiredMm}mm numeral height for this panel size.`,
        statutoryAct: rule.statutoryAct,
        penaltyDescription: rule.penaltyDescription,
        penaltySection: rule.penaltySection,
        severity: 'MEDIUM',
        remediationAdvice: rule.remediationAdvice
      });
    }
  }

  const safeApplicable = Math.max(1, applicableCount);
  const complianceScore = Math.max(0, Math.round(
    ((safeApplicable - hardFailCount - reviewCount * 0.5) / safeApplicable) * 100
  ));

  let overallStatus;
  if (hardFailCount > 0) {
    overallStatus = (hardFailCount <= 1 && reviewCount === 0 && complianceScore >= 80) ? 'FLAGGED_REVIEW' : 'NON_COMPLIANT';
  } else if (reviewCount > 0) {
    overallStatus = 'FLAGGED_REVIEW';
  } else {
    overallStatus = 'COMPLIANT';
  }

  const estimatedStatutoryFine = violations.length === 0
    ? '₹0'
    : `₹${(violations.length * 25000).toLocaleString('en-IN')} - ₹${(violations.length * 100000).toLocaleString('en-IN')}`;

  return {
    checkedFields,
    violations,
    overallStatus,
    complianceScore,
    estimatedStatutoryFine,
    isFontCompliant,
    categoryExemptionApplied: exemption ? exemption.name : null
  };
}

module.exports = { checkCompliance, demoExtraction, MANDATORY_FIELD_IDS };
