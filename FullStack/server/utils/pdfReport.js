const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

function shouldGenerateReport(status) {
  return status === 'NON_COMPLIANT' || status === 'FLAGGED_REVIEW' || status === 'NEEDS_REVIEW' || status === 'COMPLIANT';
}

function formatComplianceScore(score) {
  if (score === null || score === undefined) {
    return 'Not calculated';
  }
  return `${score}/100`;
}

/**
 * Generates a "Non-Compliance & Improvement Analysis Report" PDF for a scan
 * and writes it to disk. Returns the relative file path (under /reports).
 */
function generateComplianceReport(scan) {
  const fileName = `report-${scan.id}.pdf`;
  const filePath = path.join(REPORTS_DIR, fileName);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // --- Header -----------------------------------------------------------
  doc.fontSize(16).font('Helvetica-Bold').text('LEGAL METROLOGY (PACKAGED COMMODITIES) RULES, 2011', { align: 'center' });
  doc.fontSize(12).font('Helvetica').text('Product Non-Compliance & Improvement Analysis Report', { align: 'center' });
  doc.moveDown(1.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1F2A24').stroke();
  doc.moveDown();

  // --- Scan summary -------------------------------------------------------
  doc.fontSize(10).font('Helvetica-Bold').text('SCAN REFERENCE');
  doc.font('Helvetica').fontSize(10);
  doc.text(`Scan ID: ${scan.id}`);
  doc.text(`Timestamp: ${scan.timestamp}`);
  doc.text(`Product: ${scan.productTitle || 'N/A'}    Brand: ${scan.brand || 'N/A'}`);
  doc.text(`Category: ${scan.category || 'N/A'}    Pack Type: ${scan.packType || 'N/A'}`);
  if (scan.batchNumber) doc.text(`Batch Number: ${scan.batchNumber}`);
  if (scan.barcode) doc.text(`Barcode: ${scan.barcode}`);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fillColor('#B23A2E')
    .text(`Overall Status: ${scan.overallStatus}    Compliance Score: ${formatComplianceScore(scan.complianceScore)}`);
  doc.fillColor('black').text(`Estimated Statutory Fine Exposure: ${scan.estimatedStatutoryFine}`);
  doc.moveDown(1);

  // --- Violations table ---------------------------------------------------
  const violations = JSON.parse(scan.violations || '[]');
  doc.font('Helvetica-Bold').fontSize(12).text('VIOLATED STATUTORY CLAUSES', { underline: true });
  doc.moveDown(0.5);

  if (violations.length === 0) {
    doc.font('Helvetica').fontSize(10).text('No statutory violations detected.');
  } else {
    violations.forEach((v, idx) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1F2A24')
        .text(`${idx + 1}. ${v.clauseId} - ${v.clauseTitle}  [${v.severity}]`);
      doc.font('Helvetica').fillColor('black').fontSize(9);
      doc.text(`Requirement: ${v.mandatoryRequirement}`);
      doc.text(`Issue found: ${v.violationReason}`);
      if (v.detectedSnippet) doc.text(`Detected on label: "${v.detectedSnippet}"`);
      doc.text(`Statutory basis: ${v.statutoryAct} - ${v.penaltySection}`);
      doc.text(`Penalty: ${v.penaltyDescription}`);
      doc.moveDown(0.6);
    });
  }

  doc.moveDown(0.5);

  // --- Field-by-field check table ------------------------------------------
  const checkedFields = JSON.parse(scan.checkedFields || '[]');
  doc.font('Helvetica-Bold').fontSize(12).text('MANDATORY DECLARATION CHECKLIST', { underline: true });
  doc.moveDown(0.5);
  checkedFields.forEach(f => {
    const status = f.isPresent && !f.isMalformed ? 'PASS' : 'FAIL';
    doc.font('Helvetica-Bold').fontSize(9).fillColor(status === 'PASS' ? '#2F6B4F' : '#B23A2E')
      .text(`[${status}] ${f.fieldName} (${f.ruleReference})`);
    doc.font('Helvetica').fillColor('black').fontSize(9).text(f.explanation);
    doc.moveDown(0.3);
  });

  doc.moveDown(0.5);

  // --- Areas to improve for future versions --------------------------------
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1F2A24')
    .text('AREAS REQUIRING IMPROVEMENT FOR A FUTURE VERSION OF THIS PRODUCT', { underline: true });
  doc.moveDown(0.5);
  doc.font('Helvetica').fillColor('black').fontSize(9);

  const improvementPoints = violations.map(v => `- ${v.clauseTitle}: ${v.remediationAdvice}`);
  if (improvementPoints.length === 0) {
    doc.text('No corrective action required at this time.');
  } else {
    improvementPoints.forEach(point => doc.text(point, { paragraphGap: 4 }));
  }

  doc.moveDown(1);
  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#5C675E')
    .text('This report was generated automatically by the LMPC Compliance Inspector for the attention of the concerned Legal Metrology authority. It is intended to direct enforcement review and manufacturer corrective action.', { align: 'left' });

  doc.end();

  return `/reports/${fileName}`;
}

module.exports = { generateComplianceReport, shouldGenerateReport, formatComplianceScore, REPORTS_DIR };
