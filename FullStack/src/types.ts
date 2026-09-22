export type MandatoryFieldId =
  | 'mrp'
  | 'net_quantity'
  | 'manufacturer_details'
  | 'consumer_care'
  | 'date_of_manufacture'
  | 'country_of_origin'
  | 'unit_sale_price';

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'FLAGGED_REVIEW' | 'NEEDS_REVIEW';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface BoundingBox {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
  label: string;
  isCompliant: boolean;
}

export interface RuleClauseViolation {
  clauseId: string; // e.g., "Rule 6(1)(e)"
  clauseTitle: string; // e.g., "Maximum Retail Price Declaration"
  ruleBook: string; // "Legal Metrology (Packaged Commodities) Rules, 2011"
  description: string;
  violationReason: string;
  detectedSnippet?: string;
  mandatoryRequirement: string;
  statutoryAct: string; // e.g., "Legal Metrology Act, 2009 (Sec 36)"
  penaltyDescription: string;
  penaltySection: string;
  severity: SeverityLevel;
  remediationAdvice: string;
}

export type FieldStatus = 'FOUND' | 'NOT_FOUND' | 'LOW_CONFIDENCE' | 'AI_UNAVAILABLE' | 'NOT_APPLICABLE';

export interface FieldComplianceResult {
  fieldId: MandatoryFieldId;
  fieldName: string;
  ruleReference: string;
  status?: FieldStatus;
  isPresent: boolean;
  isMalformed: boolean;
  detectedText?: string;
  originalText?: string;
  officerOverride?: string;
  expectedFormat: string;
  explanation: string;
  severity: SeverityLevel;
  boundingBox?: BoundingBox;
}

export interface ScanResult {
  id: string;
  timestamp: string;
  productTitle: string;
  brand: string;
  category: 'Food & FMCG' | 'Cosmetics & Personal Care' | 'Electronics' | 'Pharmaceuticals & OTC' | 'Apparel & Textiles' | 'Commodities & Grains' | 'General' | null;
  packType: 'Pouch' | 'Bottle/Jar' | 'Carton Box' | 'Tin/Can' | 'E-commerce Pack';
  batchNumber?: string;
  barcode?: string;
  imageUrl: string;
  overallStatus: ComplianceStatus;
  complianceScore: number; // 0 - 100
  checkedFields: FieldComplianceResult[];
  violations: RuleClauseViolation[];
  principalDisplayAreaCm2?: number;
  minimumFontHeightMm?: number;
  detectedFontHeightMm?: number;
  isFontCompliant?: boolean;
  inspectorNotes?: string;
  inspectionMemoNumber?: string;
  estimatedStatutoryFine: string;
  categoryExemptionApplied?: string;
  // Present once the backend's relational inspection history is wired in
  // (see server/routes/scan.routes.js). Optional so mock/offline data,
  // which has none of this, still satisfies the type.
  inspectionId?: string | null;
  productId?: string | null;
  priority?: Priority | null;
  priorityReason?: string | null;
  engine?: string;
}

export interface RegulatorTrendData {
  month: string;
  totalScans: number;
  compliantCount: number;
  nonCompliantCount: number;
  criticalViolations: number;
  fmcgViolations: number;
  electronicsViolations: number;
  cosmeticsViolations: number;
}

export interface ClauseStatistic {
  clauseId: string;
  clauseTitle: string;
  shortRule: string;
  category: string;
  totalViolations: number;
  violationPercentage: number;
  severity: SeverityLevel;
  statutoryReference: string;
  commonDefectPattern: string;
}

export interface SellerHistoryItem {
  id: string;
  date: string;
  productName: string;
  brand: string;
  sku: string;
  category: string;
  status: ComplianceStatus;
  score: number;
  missingFieldsCount: number;
  imageUrl: string;
  memoId: string;
}

export interface FilterState {
  searchQuery: string;
  dateRange: 'all' | '7d' | '30d' | '90d' | 'ytd';
  clauseFilter: string;
  categoryFilter: string;
  statusFilter: 'ALL' | 'COMPLIANT' | 'NON_COMPLIANT' | 'FLAGGED_REVIEW';
  severityFilter: string;
}

// ---------------------------------------------------------------------------
// Inspection history, complaints and feedback
// ---------------------------------------------------------------------------

export type ActorType = 'CONSUMER' | 'SELLER';

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

export type InspectionStatus =
  | 'DETECTED'
  | 'PRIORITIZED'
  | 'UNDER_REVIEW'
  | 'ACTION_REQUIRED'
  | 'RESOLVED';

export type FindingResult =
  | 'COMPLIANT'
  | 'NON_COMPLIANT'
  | 'WARNING'
  | 'NOT_APPLICABLE'
  | 'PENDING';

export interface InspectionFinding {
  id: string;
  inspectionId: string;
  fieldId: string | null;
  fieldName: string;
  ruleReference: string | null;
  result: FindingResult;
  severity: SeverityLevel | null;
  description: string;
  detectedText?: string | null;
  sortOrder: number;
}

export interface InspectionSummary {
  id: string;
  scanId?: string | null;
  createdAt: string;
  updatedAt?: string;
  productId: string;
  productName: string;
  brand?: string | null;
  category?: string | null;
  barcode?: string | null;
  actorType: ActorType;
  actorName?: string | null;
  complianceStatus: ComplianceStatus;
  complianceScore: number | null;
  compliantCount: number;
  nonCompliantCount: number;
  warningCount: number;
  priority: Priority;
  priorityReason?: string | null;
  status: InspectionStatus;
  assignedAuthorityId?: string | null;
  assignedAuthorityName?: string | null;
  complaintCount?: number;
  imageUrl?: string | null;
  isDemo?: boolean;
}

export interface InspectionEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  priority: string | null;
  notes: string | null;
  actedBy: string | null;
  timestamp: string;
}

export interface InspectionDetail extends InspectionSummary {
  findings: InspectionFinding[];
  compliance: InspectionFinding[];
  nonCompliance: InspectionFinding[];
  events: InspectionEvent[];
  complaints: ComplaintSummary[];
  authorityNotes?: string | null;
  manufacturer?: string | null;
}

export type ComplaintCategory =
  | 'INCORRECT_MRP'
  | 'MISSING_INFORMATION'
  | 'DAMAGED_PACKAGING'
  | 'INCORRECT_QUANTITY'
  | 'EXPIRED_PRODUCT'
  | 'MISLEADING_INFORMATION'
  | 'LABELLING_ISSUE'
  | 'OTHER';

export type ComplaintStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'ACTION_TAKEN' | 'RESOLVED';

export interface ComplaintSummary {
  id: string;
  inspectionId: string | null;
  productId: string | null;
  productName?: string | null;
  brand?: string | null;
  category: ComplaintCategory;
  categoryLabel?: string;
  description: string;
  status: ComplaintStatus;
  priority: Priority;
  assignedAuthorityName?: string | null;
  authorityNotes?: string | null;
  createdAt: string;
  updatedAt?: string;
  isDemo?: boolean;
  events?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    notes: string | null;
    actedBy: string | null;
    timestamp: string;
  }>;
}

export interface FeedbackEntry {
  id: string;
  productId: string;
  inspectionId?: string | null;
  rating: number;
  reviewText?: string | null;
  displayName?: string | null;
  qualityRating?: number | null;
  packagingRating?: number | null;
  labelClarityRating?: number | null;
  overallRating?: number | null;
  createdAt: string;
  productName?: string | null;
  brand?: string | null;
  isDemo?: boolean;
}

export interface FeedbackSummary {
  productId: string;
  count: number;
  average: number;
  distribution: Record<string, number>;
  categoryAverages: {
    quality: number | null;
    packaging: number | null;
    labelClarity: number | null;
    overall: number | null;
  };
  recent: FeedbackEntry[];
}

export interface DashboardCards {
  totalChecked: number;
  compliant: number;
  nonCompliant: number;
  needsReview: number;
  issuesDetected: number;
  issuesResolved: number;
  issuesPending: number;
  activeComplaints: number;
  totalComplaints: number;
  averageRating: number;
  ratingCount: number;
  nonComplianceRate: number;
}

export interface DashboardCharts {
  complianceSplit: Array<{ name: string; value: number }>;
  issuesDetectedVsResolved: Array<{ month: string; detected: number; resolved: number }>;
  issuesByCategory: Array<{ name: string; ruleReference: string | null; count: number }>;
  issuesByPriority: Array<{ priority: Priority; count: number }>;
  complaintsOverTime: Array<{ month: string; total: number; resolved: number }>;
  ratingDistribution: Array<{ star: number; count: number }>;
  complianceTrend: RegulatorTrendData[];
}

export interface RegulatorAnalytics {
  generatedAt: string;
  demoDataPresent: boolean;
  trends: RegulatorTrendData[];
  topClauses: ClauseStatistic[];
  recentScans: ScanResult[];
  kpis: {
    totalAudited: number;
    nonComplianceRate: number;
    statutoryNoticesCount: number;
    topOffendingClause: string;
    resolvedGrievances: number;
  };
  cards: DashboardCards;
  charts: DashboardCharts;
  recentInspections: InspectionSummary[];
}
