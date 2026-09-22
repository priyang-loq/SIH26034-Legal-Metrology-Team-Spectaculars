const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { adaptPythonReportToScanResult } = require('../utils/pythonReportAdapter');
const { FIELD_RULE_MAP } = require('../data/legalMetrologyRules');
const { MANDATORY_FIELD_IDS } = require('../utils/ruleEngine');

// Canonical frontend categories from src/types.ts:
const FRONTEND_CATEGORIES = new Set([
  'Food & FMCG',
  'Cosmetics & Personal Care',
  'Electronics',
  'Pharmaceuticals & OTC',
  'Apparel & Textiles',
  'Commodities & Grains',
  'General'
]);

test('A1: src/types.ts defines unit_sale_price in MandatoryFieldId', () => {
  const typesContent = fs.readFileSync(path.join(__dirname, '../../src/types.ts'), 'utf8');
  assert.match(
    typesContent,
    /export\s+type\s+MandatoryFieldId\s*=\s*[\s\S]*?'unit_sale_price'/,
    "MandatoryFieldId in src/types.ts must include 'unit_sale_price'"
  );
});

test('A2: FIELD_RULE_MAP in server/data/legalMetrologyRules.js represents unit_sale_price with LMPC_6_11_USP', () => {
  assert.ok(FIELD_RULE_MAP.unit_sale_price, "FIELD_RULE_MAP must define 'unit_sale_price'");
  assert.strictEqual(FIELD_RULE_MAP.unit_sale_price.fieldName, 'Unit Sale Price');
  assert.strictEqual(
    FIELD_RULE_MAP.unit_sale_price.ruleId,
    'LMPC_6_11_USP',
    "Unit sale price ruleId must be 'LMPC_6_11_USP', not 'rule_6_1_e'"
  );
  assert.ok(FIELD_RULE_MAP.unit_sale_price.expectedFormat, 'expectedFormat must be specified');
});

test('A3: MANDATORY_FIELD_IDS in server/utils/ruleEngine.js includes unit_sale_price', () => {
  assert.ok(
    MANDATORY_FIELD_IDS.includes('unit_sale_price'),
    "MANDATORY_FIELD_IDS must include 'unit_sale_price'"
  );
});

test('A4: pythonReportAdapter maps unit_sale_price into checkedFields for all report sections', () => {
  const mockReport = {
    product_id: 'sample_01',
    category: 'food',
    overall_decision: 'COMPLIANT',
    summary: { total_fields_checked: 3, passed: 1, violations: 1, needs_review: 1, not_applicable: 0 },
    passed_fields: ['unit_sale_price'],
    violations: [
      {
        field: 'unit_sale_price',
        rule_clause: 'Rule 6(11)',
        message: 'Unit sale price missing',
        confidence: 0.9,
        evidence: []
      }
    ],
    needs_review: [
      {
        field: 'unit_sale_price',
        rule_clause: 'Rule 6(11)',
        message: 'Ambiguous unit sale price',
        confidence: 0.5,
        evidence: []
      }
    ],
    not_applicable_fields: [],
    warnings: []
  };

  const adapted = adaptPythonReportToScanResult(mockReport);
  const uspFields = adapted.checkedFields.filter(f => f.fieldId === 'unit_sale_price');
  assert.strictEqual(uspFields.length, 3, 'Must contain 3 entries for unit_sale_price');
  uspFields.forEach(f => {
    assert.strictEqual(f.fieldName, 'Unit Sale Price');
  });
});

test('B1: pythonReportAdapter maps Python category slugs to valid frontend categories', () => {
  const testCases = [
    { pythonCat: 'food', expected: 'Food & FMCG' },
    { pythonCat: 'fmcg', expected: 'Food & FMCG' },
    { pythonCat: 'cosmetic', expected: 'Cosmetics & Personal Care' },
    { pythonCat: 'cosmetics', expected: 'Cosmetics & Personal Care' },
    { pythonCat: 'electronics', expected: 'Electronics' },
    { pythonCat: 'medical', expected: 'Pharmaceuticals & OTC' },
    { pythonCat: 'pharmaceuticals', expected: 'Pharmaceuticals & OTC' },
    { pythonCat: 'apparel', expected: 'Apparel & Textiles' },
    { pythonCat: 'seeds', expected: 'Commodities & Grains' },
    { pythonCat: 'general', expected: 'General' },
    { pythonCat: 'Food & FMCG', expected: 'Food & FMCG' },
    { pythonCat: 'Cosmetics & Personal Care', expected: 'Cosmetics & Personal Care' }
  ];

  for (const { pythonCat, expected } of testCases) {
    const report = {
      product_id: 'test',
      category: pythonCat,
      overall_decision: 'COMPLIANT',
      summary: {},
      violations: [],
      needs_review: [],
      passed_fields: [],
      not_applicable_fields: []
    };
    const result = adaptPythonReportToScanResult(report);
    assert.strictEqual(
      result.category,
      expected,
      `Python category "${pythonCat}" must map to "${expected}", got "${result.category}"`
    );
    assert.ok(
      FRONTEND_CATEGORIES.has(result.category),
      `Adapted category "${result.category}" must belong to FRONTEND_CATEGORIES`
    );
  }
});

test('B2: pythonReportAdapter leaves unknown or empty category as null', () => {
  const emptyReport = {
    product_id: 'test',
    category: '',
    overall_decision: 'COMPLIANT',
    summary: {},
    violations: [],
    needs_review: [],
    passed_fields: [],
    not_applicable_fields: []
  };
  const result = adaptPythonReportToScanResult(emptyReport);
  assert.notStrictEqual(
    result.category,
    'Commodities & Grains',
    'Empty category must NOT silently classify as Commodities & Grains'
  );
  assert.strictEqual(result.category, null, 'Empty category should be null');

  const nullReport = {
    product_id: 'test',
    category: null,
    overall_decision: 'COMPLIANT',
    summary: {},
    violations: [],
    needs_review: [],
    passed_fields: [],
    not_applicable_fields: []
  };
  const nullResult = adaptPythonReportToScanResult(nullReport);
  assert.strictEqual(nullResult.category, null, 'Null category should remain null');
});

test('B3: pythonReportAdapter maps general to General and not Commodities & Grains', () => {
  const generalReport = {
    product_id: 'test',
    category: 'general',
    overall_decision: 'COMPLIANT',
    summary: {},
    violations: [],
    needs_review: [],
    passed_fields: [],
    not_applicable_fields: []
  };
  const result = adaptPythonReportToScanResult(generalReport);
  assert.strictEqual(
    result.category,
    'General',
    'Python category "general" must map to "General", not Commodities & Grains'
  );
});
