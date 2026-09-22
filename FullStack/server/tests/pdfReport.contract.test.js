const test = require('node:test');
const assert = require('node:assert');
const { adaptPythonReportToScanResult } = require('../utils/pythonReportAdapter');
const { shouldGenerateReport, formatComplianceScore } = require('../utils/pdfReport');
const { getRuleByClause } = require('../data/legalMetrologyRules');

// TEST 1 — NEEDS_REVIEW PDF trigger
test('TEST 1: shouldGenerateReport triggers PDF generation for NEEDS_REVIEW, FLAGGED_REVIEW, and NON_COMPLIANT', () => {
  assert.strictEqual(typeof shouldGenerateReport, 'function', 'shouldGenerateReport must be exported from pdfReport.js');
  assert.strictEqual(shouldGenerateReport('NEEDS_REVIEW'), true, 'NEEDS_REVIEW must trigger PDF generation');
  assert.strictEqual(shouldGenerateReport('FLAGGED_REVIEW'), true, 'FLAGGED_REVIEW must trigger PDF generation');
  assert.strictEqual(shouldGenerateReport('NON_COMPLIANT'), true, 'NON_COMPLIANT must trigger PDF generation');
  assert.strictEqual(shouldGenerateReport('COMPLIANT'), false, 'COMPLIANT must not trigger PDF generation');
});

// TEST 2 — statutory metadata hydration for USP
test('TEST 2: adaptPythonReportToScanResult hydrates statutory metadata for unit_sale_price violation', () => {
  const report = {
    product_id: 'test_usp',
    category: 'food',
    overall_decision: 'NON_COMPLIANT',
    summary: {},
    violations: [
      {
        field: 'unit_sale_price',
        rule_clause: 'Rule 6(11)',
        message: 'Unit sale price missing',
        confidence: 0.95,
        evidence: []
      }
    ],
    needs_review: [],
    passed_fields: [],
    not_applicable_fields: []
  };

  const adapted = adaptPythonReportToScanResult(report);
  assert.strictEqual(adapted.violations.length, 1);
  const v = adapted.violations[0];

  assert.strictEqual(v.clauseId, 'Rule 6(11)');
  assert.strictEqual(v.clauseTitle, 'Unit Sale Price');
  assert.notStrictEqual(v.mandatoryRequirement, '', 'mandatoryRequirement must not be empty');
  assert.notStrictEqual(v.statutoryAct, '', 'statutoryAct must not be empty');
  assert.notStrictEqual(v.penaltySection, '', 'penaltySection must not be empty');
  assert.notStrictEqual(v.penaltyDescription, '', 'penaltyDescription must not be empty');
  assert.notStrictEqual(v.remediationAdvice, '', 'remediationAdvice must not be empty');

  // Verify values come from canonical legalMetrologyRules.js:
  const canonicalRule = getRuleByClause('Rule 6(11)');
  assert.ok(canonicalRule, 'Canonical rule for Rule 6(11) must exist');
  assert.strictEqual(v.mandatoryRequirement, canonicalRule.mandatoryRequirement);
  assert.strictEqual(v.statutoryAct, canonicalRule.statutoryAct);
  assert.strictEqual(v.penaltySection, canonicalRule.penaltySection);
  assert.strictEqual(v.penaltyDescription, canonicalRule.penaltyDescription);
  assert.strictEqual(v.remediationAdvice, canonicalRule.remediationAdvice);
});

// TEST 3 — CoO metadata hydration
test('TEST 3: adaptPythonReportToScanResult hydrates statutory metadata for country_of_origin violation', () => {
  const report = {
    product_id: 'test_coo',
    category: 'general',
    overall_decision: 'NON_COMPLIANT',
    summary: {},
    violations: [
      {
        field: 'country_of_origin',
        rule_clause: 'Rule 6(1)(g)',
        message: 'Country of Origin missing',
        confidence: 0.95,
        evidence: []
      }
    ],
    needs_review: [],
    passed_fields: [],
    not_applicable_fields: []
  };

  const adapted = adaptPythonReportToScanResult(report);
  assert.strictEqual(adapted.violations.length, 1);
  const v = adapted.violations[0];

  assert.strictEqual(v.clauseId, 'Rule 6(1)(g)');
  assert.strictEqual(v.clauseTitle, 'Country Of Origin');
  assert.notStrictEqual(v.mandatoryRequirement, '', 'mandatoryRequirement must not be empty');
  assert.notStrictEqual(v.statutoryAct, '', 'statutoryAct must not be empty');
  assert.notStrictEqual(v.penaltySection, '', 'penaltySection must not be empty');
  assert.notStrictEqual(v.penaltyDescription, '', 'penaltyDescription must not be empty');
  assert.notStrictEqual(v.remediationAdvice, '', 'remediationAdvice must not be empty');

  const canonicalRule = getRuleByClause('Rule 6(1)(g)');
  assert.ok(canonicalRule, 'Canonical rule for Rule 6(1)(g) must exist');
  assert.strictEqual(v.mandatoryRequirement, canonicalRule.mandatoryRequirement);
  assert.strictEqual(v.statutoryAct, canonicalRule.statutoryAct);
  assert.strictEqual(v.penaltySection, canonicalRule.penaltySection);
  assert.strictEqual(v.penaltyDescription, canonicalRule.penaltyDescription);
  assert.strictEqual(v.remediationAdvice, canonicalRule.remediationAdvice);
});

// TEST 4 — passed-field ruleReference
test('TEST 4: adaptPythonReportToScanResult populates ruleReference for passed_fields', () => {
  const report = {
    product_id: 'test_passed',
    category: 'food',
    overall_decision: 'COMPLIANT',
    summary: {},
    violations: [],
    needs_review: [],
    passed_fields: ['unit_sale_price', 'mrp'],
    not_applicable_fields: []
  };

  const adapted = adaptPythonReportToScanResult(report);
  const uspField = adapted.checkedFields.find(f => f.fieldId === 'unit_sale_price');
  assert.ok(uspField, 'unit_sale_price must be in checkedFields');
  assert.strictEqual(uspField.ruleReference, 'Rule 6(11)', 'unit_sale_price must have ruleReference "Rule 6(11)"');

  const mrpField = adapted.checkedFields.find(f => f.fieldId === 'mrp');
  assert.ok(mrpField, 'mrp must be in checkedFields');
  assert.strictEqual(mrpField.ruleReference, 'Rule 6(1)(e) & Rule 6(11)', 'mrp must have canonical ruleReference');
});

// TEST 5 — PDF compliance score formatting
test('TEST 5: PDF does not render Compliance Score: null/100 when score is null', () => {
  assert.strictEqual(typeof formatComplianceScore, 'function', 'formatComplianceScore must be exported from pdfReport.js');
  assert.strictEqual(formatComplianceScore(null), 'Not calculated');
  assert.strictEqual(formatComplianceScore(undefined), 'Not calculated');
  assert.strictEqual(formatComplianceScore(85), '85/100');
  assert.strictEqual(formatComplianceScore(0), '0/100');
});
