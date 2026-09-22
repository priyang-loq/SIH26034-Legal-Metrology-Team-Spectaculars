const express = require('express');
const db = require('../db');
const { LEGAL_METROLOGY_RULES_2011 } = require('../data/legalMetrologyRules');

const router = express.Router();

// GET /api/regulator/analytics
// Matches the shape expected by src/services/complianceApi.ts -> fetchRegulatorAnalytics()
// This is public aggregate data (no per-scan authority actions) - the existing
// "Regulator Analytics" tab keeps working exactly as before, now backed by real data.
router.get('/analytics', (req, res) => {
  const totalAudited = db.prepare('SELECT COUNT(*) AS c FROM scans').get().c;
  const nonCompliant = db.prepare(`SELECT COUNT(*) AS c FROM scans WHERE overallStatus = 'NON_COMPLIANT'`).get().c;
  const nonComplianceRate = totalAudited > 0 ? Number(((nonCompliant / totalAudited) * 100).toFixed(1)) : 0;
  const statutoryNoticesCount = db.prepare(`SELECT COUNT(*) AS c FROM scans WHERE actionStatus = 'NOTICE_ISSUED'`).get().c;
  const resolvedGrievances = db.prepare(`SELECT COUNT(*) AS c FROM scans WHERE actionStatus = 'RESOLVED'`).get().c;

  const recentScans = db.prepare('SELECT * FROM scans ORDER BY createdAt DESC LIMIT 50').all()
    .map(hydrateScanRow);

  const clauseCounts = {};
  recentScans.forEach(s => {
    s.violations.forEach(v => {
      clauseCounts[v.clauseId] = (clauseCounts[v.clauseId] || 0) + 1;
    });
  });
  const totalViolations = Object.values(clauseCounts).reduce((a, b) => a + b, 0) || 1;

  const topClauses = Object.entries(clauseCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([clauseId, count]) => {
      const rule = LEGAL_METROLOGY_RULES_2011.find(r => r.clause === clauseId);
      return {
        clauseId,
        clauseTitle: rule ? rule.title : clauseId,
        shortRule: rule ? rule.mandatoryRequirement.slice(0, 80) : '',
        category: 'General',
        totalViolations: count,
        violationPercentage: Number(((count / totalViolations) * 100).toFixed(1)),
        severity: 'HIGH',
        statutoryReference: rule ? rule.statutoryAct : '',
        commonDefectPattern: rule ? rule.remediationAdvice : ''
      };
    });

  // Simple month-bucketed trend from real scan timestamps
  const trendRows = db.prepare(`
    SELECT strftime('%Y-%m', createdAt) AS month,
           COUNT(*) AS totalScans,
           SUM(CASE WHEN overallStatus = 'COMPLIANT' THEN 1 ELSE 0 END) AS compliantCount,
           SUM(CASE WHEN overallStatus = 'NON_COMPLIANT' THEN 1 ELSE 0 END) AS nonCompliantCount
    FROM scans
    GROUP BY month
    ORDER BY month ASC
  `).all();

  const trends = trendRows.map(t => ({
    month: t.month,
    totalScans: t.totalScans,
    compliantCount: t.compliantCount,
    nonCompliantCount: t.nonCompliantCount,
    criticalViolations: 0,
    fmcgViolations: 0,
    electronicsViolations: 0,
    cosmeticsViolations: 0
  }));

  res.json({
    trends,
    topClauses,
    recentScans,
    kpis: {
      totalAudited,
      nonComplianceRate,
      statutoryNoticesCount,
      topOffendingClause: topClauses[0]?.clauseId || 'N/A',
      resolvedGrievances
    }
  });
});

function hydrateScanRow(row) {
  return {
    ...row,
    checkedFields: JSON.parse(row.checkedFields || '[]'),
    violations: JSON.parse(row.violations || '[]'),
    isFontCompliant: row.isFontCompliant === null ? undefined : !!row.isFontCompliant
  };
}

module.exports = router;
