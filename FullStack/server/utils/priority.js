/**
 * Transparent, rule-based priority scoring.
 *
 * Deliberately NOT a black box and deliberately not a legal determination.
 * Every priority returned carries a human-readable reason string that is shown
 * verbatim in the authority dashboard, so an inspector can always see why the
 * system surfaced a case and can override it.
 */

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

// Complaint categories that touch consumer safety directly.
const SAFETY_CATEGORIES = ['EXPIRED_PRODUCT', 'INCORRECT_QUANTITY', 'DAMAGED_PACKAGING'];

function rank(priority) {
  const index = PRIORITIES.indexOf(priority);
  return index === -1 ? 0 : index;
}

function highest(...priorities) {
  return priorities.filter(Boolean).reduce(
    (best, current) => (rank(current) > rank(best) ? current : best),
    'LOW'
  );
}

/**
 * @param {Object} input
 * @param {Array}  input.findings          inspection_findings rows (or equivalents)
 * @param {number} input.openComplaints    open complaints attached to this inspection
 * @param {Array}  input.complaintCategories categories of those complaints
 * @param {number} input.repeatViolations  prior non-compliant inspections for the same product
 * @returns {{ priority: 'HIGH'|'MEDIUM'|'LOW', reason: string }}
 */
function computePriority(input = {}) {
  const findings = input.findings || [];
  const openComplaints = input.openComplaints || 0;
  const complaintCategories = input.complaintCategories || [];
  const repeatViolations = input.repeatViolations || 0;

  const failed = findings.filter((f) => f.result === 'NON_COMPLIANT');
  const critical = failed.filter((f) => f.severity === 'CRITICAL');
  const high = failed.filter((f) => f.severity === 'HIGH');
  const safetyComplaint = complaintCategories.some((c) => SAFETY_CATEGORIES.includes(c));

  const reasons = [];
  let priority = 'LOW';

  if (critical.length > 0) {
    priority = highest(priority, 'HIGH');
    reasons.push(`${critical.length} critical declaration failure(s): ${critical.map((f) => f.fieldName).join(', ')}`);
  }

  if (failed.length >= 3) {
    priority = highest(priority, 'HIGH');
    reasons.push(`${failed.length} mandatory declarations failed on a single package`);
  }

  if (safetyComplaint) {
    priority = highest(priority, 'HIGH');
    reasons.push('Consumer complaint raised in a safety-related category');
  }

  // A prior failure only escalates a case that has its own failures. A clean
  // inspection is never marked high priority just because of past history.
  if (repeatViolations >= 1 && failed.length > 0) {
    priority = highest(priority, 'HIGH');
    reasons.push(`Repeat non-compliance: ${repeatViolations} earlier failed inspection(s) for this product`);
  } else if (repeatViolations >= 1) {
    reasons.push(`Note: ${repeatViolations} earlier failed inspection(s) exist for this product, but this package passed`);
  }

  if (high.length > 0) {
    priority = highest(priority, 'MEDIUM');
    reasons.push(`${high.length} high-severity labelling failure(s): ${high.map((f) => f.fieldName).join(', ')}`);
  }

  if (failed.length > 0 && failed.length < 3) {
    priority = highest(priority, 'MEDIUM');
    reasons.push(`${failed.length} mandatory declaration(s) missing or malformed`);
  }

  if (openComplaints > 0) {
    priority = highest(priority, 'MEDIUM');
    reasons.push(`${openComplaints} open consumer complaint(s) attached`);
  }

  if (reasons.length === 0) {
    reasons.push('No non-compliant declarations detected; routine record only');
  }

  return { priority, reason: reasons.join('. ') + '.' };
}

/** Priority for a standalone complaint, before any inspection is linked. */
function complaintPriority(category) {
  if (SAFETY_CATEGORIES.includes(category)) {
    return { priority: 'HIGH', reason: 'Complaint category is safety-related.' };
  }
  if (category === 'INCORRECT_MRP' || category === 'MISLEADING_INFORMATION') {
    return { priority: 'MEDIUM', reason: 'Complaint alleges a pricing or representation defect.' };
  }
  return { priority: 'LOW', reason: 'Routine labelling or information complaint.' };
}

module.exports = { computePriority, complaintPriority, highest, rank, PRIORITIES, SAFETY_CATEGORIES };
