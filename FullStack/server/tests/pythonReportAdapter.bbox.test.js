/**
 * PHASE 2 — RED tests for pythonReportAdapter bbox propagation.
 *
 * B-Node: adapter maps evidence bbox ? FieldComplianceResult.boundingBox
 * C-Node: reports without bbox remain valid
 * D-Node: no fake bbox invented
 */
const test = require("node:test");
const assert = require("node:assert");
const { adaptPythonReportToScanResult } = require("../utils/pythonReportAdapter");

function makeReportWithBbox() {
  return {
    product_id: "test_001",
    category: "general",
    overall_decision: "NON_COMPLIANT",
    summary: { total_fields_checked: 1, passed: 0, violations: 1, needs_review: 0, not_applicable: 0 },
    violations: [
      {
        field: "manufacturer",
        rule_clause: "Rule 6(1)(a)",
        message: "Manufacturer missing.",
        confidence: 1.0,
        evidence: [
          {
            text: "ACME Corp",
            confidence: 0.95,
            bbox: { points: [[10.0, 20.0], [200.0, 20.0], [200.0, 50.0], [10.0, 50.0]] }
          }
        ]
      }
    ],
    needs_review: [],
    passed_fields: [],
    not_applicable_fields: [],
    warnings: [],
    image_width_px: 500,
    image_height_px: 400
  };
}

function makeReportWithoutBbox() {
  return {
    product_id: "test_002",
    category: "general",
    overall_decision: "COMPLIANT",
    summary: { total_fields_checked: 1, passed: 1, violations: 0, needs_review: 0, not_applicable: 0 },
    violations: [],
    needs_review: [],
    passed_fields: ["mrp"],
    not_applicable_fields: [],
    warnings: []
  };
}

test("B-Node: violation with bbox evidence produces boundingBox on checkedField", () => {
  const report = makeReportWithBbox();
  const result = adaptPythonReportToScanResult(report);

  const field = result.checkedFields.find(f => f.fieldId === "manufacturer");
  assert.ok(field, "manufacturer field must be in checkedFields");
  assert.ok(field.boundingBox, "field must have a boundingBox when evidence bbox is present");

  const box = field.boundingBox;
  // pixel bbox: x_min=10, x_max=200, y_min=20, y_max=50 in 500x400 image
  // x% = 2.0, y% = 5.0, w% = 38.0, h% = 7.5
  assert.ok(typeof box.x === "number", "boundingBox.x must be a number");
  assert.ok(typeof box.y === "number", "boundingBox.y must be a number");
  assert.ok(typeof box.width === "number", "boundingBox.width must be a number");
  assert.ok(typeof box.height === "number", "boundingBox.height must be a number");
  assert.ok(typeof box.label === "string", "boundingBox.label must be a string");
  assert.ok(typeof box.isCompliant === "boolean", "boundingBox.isCompliant must be boolean");

  assert.ok(Math.abs(box.x - 2.0) < 0.1, `x% should be ~2, got ${box.x}`);
  assert.ok(Math.abs(box.y - 5.0) < 0.1, `y% should be ~5, got ${box.y}`);
  assert.ok(Math.abs(box.width - 38.0) < 0.1, `width% should be ~38, got ${box.width}`);
  assert.ok(Math.abs(box.height - 7.5) < 0.1, `height% should be ~7.5, got ${box.height}`);
  assert.strictEqual(box.isCompliant, false);
});

test("C-Node: report without bbox evidence produces no boundingBox", () => {
  const report = makeReportWithoutBbox();
  const result = adaptPythonReportToScanResult(report);
  for (const field of result.checkedFields) {
    assert.ok(
      field.boundingBox === undefined || field.boundingBox === null,
      `field ${field.fieldId} must not have a boundingBox`
    );
  }
  assert.ok(result.overallStatus);
  assert.ok(Array.isArray(result.checkedFields));
});

test("D-Node: violation with empty evidence does not produce a fake boundingBox", () => {
  const report = makeReportWithBbox();
  report.violations[0].evidence = [];
  const result = adaptPythonReportToScanResult(report);
  const field = result.checkedFields.find(f => f.fieldId === "manufacturer");
  assert.ok(field);
  assert.ok(field.boundingBox === undefined || field.boundingBox === null,
    "No boundingBox must be invented when evidence is empty");
});

test("D-Node-2: bbox without image dimensions does not produce boundingBox", () => {
  const report = makeReportWithBbox();
  delete report.image_width_px;
  delete report.image_height_px;
  const result = adaptPythonReportToScanResult(report);
  const field = result.checkedFields.find(f => f.fieldId === "manufacturer");
  assert.ok(field);
  assert.ok(field.boundingBox === undefined || field.boundingBox === null,
    "No boundingBox must be invented when image dimensions missing");
});
