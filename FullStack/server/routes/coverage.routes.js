const express = require('express');
const { RULE_COVERAGE_NOTES, CATEGORY_EXEMPTIONS } = require('../data/ruleCoverage');

const router = express.Router();

// GET /api/rule-coverage
// Used by the frontend's Compliance Document view to explain, in plain
// language, what the engine checks vs. exempts vs. defers - sourced directly
// from RULE_COVERAGE_FOR_TEAM.md so the explanation shown to sellers/
// consumers/authority always matches the engine's actual behaviour.
router.get('/', (req, res) => {
  res.json({
    unverified: RULE_COVERAGE_NOTES.unverified,
    deferred: RULE_COVERAGE_NOTES.deferred,
    categoryExemptions: CATEGORY_EXEMPTIONS.map(c => ({
      name: c.name,
      skipAll: !!c.skipAll,
      exemptFields: c.exemptFields || [],
      conditionalExemptFields: c.conditionalExemptFields || [],
      reason: c.reason
    }))
  });
});

module.exports = router;
