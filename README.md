# VeriPack — Legal Metrology Compliance System

> **Smart India Hackathon 2026 · Problem Statement SIH26034**  
> **Team Spectaculars · Team ID 144871**

[![Repository](https://img.shields.io/badge/GitHub-SIH26034-black?logo=github)](https://github.com/priyang-loq/SIH26034-Legal-Metrology-Team-Spectaculars)

## 1. What is VeriPack?

**VeriPack** is an AI-assisted compliance platform for packaged commodities under India's **Legal Metrology (Packaged Commodities) Rules, 2011**.

It converts a product-label image into an evidence-backed compliance result by combining:

- **OpenCV** for image preprocessing
- **PaddleOCR** for text, confidence and spatial evidence
- **Gemini Vision-Language Model** for semantic extraction and cross-verification
- **Barcode/QR support** for product intelligence
- **Normalization and OCR/VLM fusion** for reliable field resolution
- **Deterministic Python rule engine** for statutory compliance checks
- **Human-in-the-loop Officer Review** for uncertain or conflicting information
- **React + Node.js** for the user-facing platform
- **SQLite** for application and inspection records
- **PDF reporting** for audit-ready compliance results

### Core principle

> **AI assists extraction. Deterministic rules decide compliance.**

The VLM never directly decides whether a package is compliant. Extracted information is normalized, reconciled with evidence, and then evaluated by the rule engine.

---

# 2. Complete Platform — Five User Modules

The frontend is organized into **five primary modules**, each serving a different user need.

| # | Module | Purpose |
|---|---|---|
| **1** | **Regulatory Analytics** | Home page for regulatory overview, compliance analytics and navigation across the platform |
| **2** | **Seller Self-Check** | Allows sellers to scan/check packaged products before selling or stocking them |
| **3** | **Consumer Scan** | Allows consumers to scan a product label and view its compliance information |
| **4** | **Public Dashboard** | Public complaint and feedback interface for reporting products and sharing consumer feedback |
| **5** | **Authority Panel** | Regulatory workspace for inspections, complaints, reviews, officer verification and final decisions |

The **Public Dashboard** and **Authority Panel** are connected: complaints and feedback submitted by users are stored in the backend and made available to authorities for review and action.

The platform also includes a **Rules Handbook**, giving users and authorities a centralized reference for the compliance rules implemented by the system.

---

# 3. Technical Flow

The following flow follows the technical approach presented in the team's SIH 2026 presentation, especially the **Technical Approach / Flow Chart**.

```text
                         PRODUCT / LABEL INPUT
                                  │
                                  ▼
                         OpenCV Preprocessing
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
          PaddleOCR           Gemini VLM        Barcode / QR
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  ▼
                           NORMALIZATION
                                  │
                                  ▼
                               FUSION
                                  │
                                  ▼
                         CATEGORY CLASSIFIER
                                  │
                                  ▼
                         LEGAL RULE ENGINE
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
                COMPLIANT     VIOLATION    NEEDS_REVIEW
                    │             │             │
                    └─────────────┼─────────────┘
                                  ▼
                           EVIDENCE REPORT
                                  │
             ┌────────────────────┼────────────────────┐
             ▼                    ▼                    ▼
         Dashboard              PDF             Authority Panel
                                                        │
                                                        ▼
                                                   Officer Review
                                                        │
                                                        ▼
                                              Verified Field Updates
                                                        │
                                                        ▼
                                                Deterministic Re-check
```

**Database:** SQLite supports the application and inspection data layer.

---

# 4. System Architecture

```text
                    ┌──────────────────────────────┐
                    │       React Frontend         │
                    │                              │
                    │ Regulatory Analytics         │
                    │ Seller Self-Check            │
                    │ Consumer Scan                │
                    │ Public Dashboard             │
                    │ Authority Panel              │
                    │ Rules Handbook               │
                    └──────────────┬───────────────┘
                                   │ REST APIs
                                   ▼
                    ┌──────────────────────────────┐
                    │       Node.js / Express      │
                    │                              │
                    │ Scan API                     │
                    │ Authentication               │
                    │ Inspection APIs              │
                    │ Complaint / Feedback APIs    │
                    │ Review API                   │
                    │ Python Bridge                │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     Python Compliance Core   │
                    │                              │
                    │ OpenCV → PaddleOCR           │
                    │        → Gemini VLM          │
                    │        → Barcode             │
                    │        → Fusion               │
                    │        → Normalization        │
                    │        → Applicability        │
                    │        → Rule Engine          │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ SQLite + Evidence + Reports  │
                    └──────────────────────────────┘
```

---

# 5. Repository Structure

```text
SIH26034-Legal-Metrology-Team-Spectaculars/
│
├── PythonCompliance/
│   ├── src/
│   │   ├── ai/                 # Gemini VLM integration
│   │   ├── extract/            # Extraction schemas and logic
│   │   ├── fusion/             # OCR/VLM fusion
│   │   ├── normalize/          # Field normalization
│   │   ├── ocr/                # PaddleOCR integration
│   │   ├── preprocess/         # Image preprocessing
│   │   ├── rules/              # Deterministic LMPC rule engine
│   │   ├── pipeline.py         # Main compliance pipeline
│   │   └── config.py           # Configuration
│   ├── scripts/                # CLI/integration utilities
│   ├── tests/                  # Automated tests
│   └── requirements.txt
│
└── FullStack/
    ├── server/
    │   ├── routes/             # Express API routes
    │   ├── middleware/         # Authentication/middleware
    │   ├── utils/              # Bridge, adapters, reports
    │   ├── scripts/            # Integration scripts
    │   ├── migrations/         # Database migrations
    │   └── index.js
    │
    ├── src/
    │   ├── components/
    │   │   ├── consumer/
    │   │   ├── seller/
    │   │   ├── authority/
    │   │   └── ...
    │   ├── services/           # API clients
    │   ├── types/              # Type definitions
    │   └── App.tsx
    │
    └── package.json
```

---

# 6. AI + OCR Extraction Pipeline

## OpenCV

OpenCV prepares the input image for extraction through image preprocessing such as:

- contrast enhancement
- noise reduction
- image normalization
- deskewing and clarity improvement

This is especially useful for packaging with difficult visual conditions.

## PaddleOCR

PaddleOCR provides the primary literal evidence layer:

- detected text
- confidence scores
- bounding boxes
- spatial location of declarations

The system supports GPU execution where available and CPU fallback.

## Gemini Vision-Language Model

The implemented VLM integration uses:

```text
gemini-3.5-flash
```

through Google's `google-genai` SDK.

The VLM is used to interpret difficult layouts and semantically extract fields such as:

- product/common name
- manufacturer / packer / importer
- net quantity
- MRP
- manufacturing date
- consumer-care information
- category
- other package declarations

The VLM is an **extraction and cross-verification layer**, not the legal decision-maker.

## Barcode / QR

Barcode support provides supplementary product intelligence where a barcode is available.

Barcode information can help identify product context, but statutory compliance remains grounded in package evidence and the rule engine.

---

# 7. OCR + VLM Fusion

The system does not blindly trust a single extraction source.

```text
PaddleOCR
   │
   │ literal evidence
   ▼
Deterministic Extraction ──────┐
                               │
                               ▼
                            Fusion
                               ▲
                               │
Gemini VLM ────────────────────┘
   semantic interpretation
```

The fusion layer resolves extraction differences while preserving uncertainty.

Examples:

- valid OCR + invalid VLM → prefer the valid extraction
- valid evidence from both sources → consolidate
- genuinely conflicting valid values → `AMBIGUOUS` / `NEEDS_REVIEW`
- unsupported VLM values → reject when they cannot be grounded in available evidence

This design is particularly important for dates and other legally significant fields.

---

# 8. Evidence-First Extraction

The system follows an evidence-oriented hierarchy when resolving information:

1. **Explicit declaration on the package**
2. **Verified manufacturer / product information**
3. **Trusted product data**
4. **Barcode-derived context**

Extracted fields retain evidence such as:

- original value
- normalized value
- OCR text
- confidence
- bounding box
- officer override

This allows an authority to understand **what the system detected and why the result was produced**.

---

# 9. Field Status Model

Fields are not represented only as strings. Each extracted value carries a meaningful status.

```text
FOUND
NOT_FOUND
MALFORMED
UNREADABLE
SOURCE_UNAVAILABLE
AMBIGUOUS
```

At the compliance level, checks can result in:

```text
PASS
VIOLATION
NEEDS_REVIEW
NOT_APPLICABLE
```

This distinction allows the platform to separate a verified declaration from missing, malformed, unavailable or conflicting evidence.

---

# 10. Normalization

The normalization layer converts different representations into consistent internal values before legal evaluation.

Examples include:

```text
₹50
Rs 50
INR 50
50/-
```

being converted into a consistent monetary representation.

Date representations such as:

```text
02/26
#02/26
```

are normalized while the original value remains available for evidence and review.

---

# 11. Deterministic Legal Metrology Rule Engine

After extraction, fusion and normalization, the compliance engine evaluates the package against the implemented **Legal Metrology (Packaged Commodities) Rules, 2011** checks.

```text
Extracted Evidence
       │
       ▼
Normalization
       │
       ▼
Applicability / Exemptions
       │
       ▼
Deterministic Rule Engine
       │
       ├── PASS
       ├── VIOLATION
       └── NEEDS_REVIEW
```

The overall decision follows the evidence state:

```text
Definitive mandatory violation
            ↓
        VIOLATION

No violation + unresolved mandatory information
            ↓
        NEEDS_REVIEW

All applicable requirements satisfied
            ↓
        COMPLIANT
```

---

# 12. Implemented Compliance Checks

The rule engine covers the package declarations and applicability logic implemented for the project, including:

### Manufacturer / Packer / Importer

Checks the relevant declaration and preserves extracted evidence.

### Common / Generic Product Name

Checks whether the required product identification information is available.

### Net Quantity

Validates the presence and normalized representation of declared quantity.

### Manufacturing / Pre-packing / Import Date

Handles supported date formats including:

```text
MM/YY
MM/YYYY
```

and validates the extracted declaration.

### Maximum Retail Price

Extracts and validates the MRP, including tax-inclusive declarations.

### Consumer Care Information

Checks the required consumer-care information where applicable.

### Country of Origin + Import Status

The system keeps:

```text
Country of Origin
```

and:

```text
Import Status
```

as separate facts.

During Officer Review, import status can be explicitly set to:

```text
DOMESTIC
IMPORTED
```

The system does not infer import status simply from an Indian manufacturer/address.

### Unit Sale Price

Implements the project's Rule 6(11) unit-sale-price logic for:

```text
mass    → gram / kilogram
volume  → millilitre / litre
length  → centimetre / metre
number  → unit
```

---

# 13. Applicability and Exemptions

Applicability is evaluated before applying checks.

The implementation includes handling for:

- LMPC applicability/exemption
- MRP-based Unit Sale Price applicability
- applicable standard-unit cases
- package category requirements

For the implemented project rule set, **Unit Sale Price is not applicable where MRP ≤ ₹35**.

The system therefore does not treat a missing USP declaration on such a package as a violation.

---

# 14. AI Failure and Uncertainty Handling

A compliance system must not convert an AI failure into a false legal conclusion.

If Gemini is unavailable because of quota, network or service failure:

```text
OCR evidence
      ↓
deterministic extraction where possible
      ↓
unresolved AI-dependent fields
      ↓
NEEDS_REVIEW when required information cannot be verified
```

This preserves the distinction between:

- **the product is non-compliant**, and
- **the system does not have enough reliable evidence to decide**.

---

# 15. Human-in-the-Loop Officer Review

Uncertain cases are routed to the Authority Panel instead of being guessed.

```text
Scan
  ↓
NEEDS_REVIEW
  ↓
Authority Panel
  ↓
Inspection Detail
  ↓
Officer Review
  ↓
Verified field correction
  ↓
Deterministic re-check
  ↓
Final compliance result
```

Officers can review or correct supported fields including:

- manufacturer
- common name
- manufacturing date
- consumer care
- country of origin
- import status
- other extracted declarations

The system preserves the original extracted value and officer override.

### Fast review path

Officer Review does not need to invoke the heavy VLM pipeline again:

```text
Officer Override
      ↓
Normalization
      ↓
Rule Engine
      ↓
Final Decision
```

This makes the human verification loop fast and deterministic.

---

# 16. Five Frontend Modules

## 16.1 Regulatory Analytics — Home

The home page is the central entry point to the platform.

It provides a regulatory overview and navigation into the different workflows:

```text
Regulatory Analytics
        │
        ├── Seller Self-Check
        ├── Consumer Scan
        ├── Public Dashboard
        ├── Authority Panel
        └── Rules Handbook
```

---

## 16.2 Seller Self-Check

Designed for sellers, manufacturers and businesses that want to verify packaged products before selling or stocking them.

```text
Upload / Scan Label
        ↓
Compliance Pipeline
        ↓
Field-Level Results
        ↓
Compliance Decision
```

The seller can see the extracted declarations, individual checks and overall status.

---

## 16.3 Consumer Scan

Designed for consumers who want a simple first-pass verification of a packaged product.

```text
Scan / Upload Product
        ↓
Compliance Analysis
        ↓
Consumer-Friendly Result
```

The same backend compliance engine is used for the Consumer Scan and Seller Self-Check, keeping the legal evaluation consistent.

---

## 16.4 Public Dashboard

The Public Dashboard provides a public-facing feedback and complaint workflow.

Consumers can:

- submit product complaints
- provide feedback
- report problematic product information
- associate feedback with product/scan information where supported

The submitted information is persisted in the backend and becomes available to the Authority Panel.

```text
Consumer
   │
   ▼
Public Dashboard
   │
   ├── Complaint
   └── Feedback
         │
         ▼
      Backend
         │
         ▼
  Authority Panel
```

This creates a feedback loop from real-world consumer observations to regulatory review.

---

## 16.5 Authority Panel

The Authority Panel is the regulatory workspace.

It provides:

- authority authentication
- inspection records
- scan details
- compliance grids
- field-level evidence
- Officer Review
- officer overrides
- complaint/feedback visibility
- inspection state
- compliance reports
- review and verification workflow

The authority can distinguish:

```text
COMPLIANT
VIOLATION
NEEDS_REVIEW
```

and investigate submitted public complaints and feedback.

---

# 17. Rules Handbook

The platform includes a **Rules Handbook** as a dedicated reference section.

It helps users understand the legal checks implemented by VeriPack and provides a readable reference for the compliance workflow.

The handbook complements the automated rule engine:

```text
Rules Handbook
      │
      ├── Legal requirement reference
      ├── Declaration/check explanation
      └── Compliance understanding
```

The handbook is informational; the actual compliance result is produced by the deterministic rule engine using extracted package evidence.

---

# 18. Public Complaints → Authority Workflow

One of the platform's end-to-end features is the connection between public reporting and regulatory review.

```text
Product / Consumer
        │
        ▼
Public Dashboard
        │
        ├── Complaint
        └── Feedback
                │
                ▼
          SQLite / Backend
                │
                ▼
          Authority Panel
                │
                ▼
        Authority Investigation
                │
                ▼
       Inspection / Review
```

This gives the system a complete loop:

**Detect → Report → Review → Verify → Act**

---

# 19. Reports and Evidence

The system generates compliance/inspection reporting information containing relevant details such as:

- scan/inspection identifier
- extracted declarations
- field-level status
- compliance decision
- rule information
- evidence
- officer verification information

PDF reporting provides an inspection-friendly representation of the machine-readable result.

---

# 20. Authentication and Data Persistence

The Authority Panel uses protected authentication for officer workflows.

SQLite is used for the current implementation to persist application data such as:

- scans
- inspections
- authority records
- complaints
- feedback
- compliance information
- review/override information

Runtime databases and generated files are excluded from the evaluation repository where appropriate.

---

# 21. Backend API

The Node.js/Express backend connects the frontend with the Python compliance engine.

Core functionality includes:

```text
POST /api/scan-label
GET  /api/scan-label/:id
POST /api/scan-label/:id/review
```

The backend also provides the authority, authentication, inspection, complaint/feedback and barcode-related APIs used by the frontend.

The scan flow is:

```text
React
  ↓
Express API
  ↓
Python Compliance Engine
  ↓
Compliance Result
  ↓
Express Adapter
  ↓
React UI
```

---

# 22. Technology Stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | React + TypeScript | Interactive platform UI |
| Build | Vite | Frontend development/build |
| Backend | Node.js + Express | APIs and application server |
| Database | SQLite | Application, inspection, complaint and feedback records |
| Image Processing | OpenCV | Preprocessing |
| OCR | PaddleOCR | Text and spatial extraction |
| AI | Gemini VLM (`gemini-3.5-flash`) | Semantic extraction/cross-verification |
| Compliance | Python | Deterministic rule engine |
| Validation | Pydantic / Python validation | Structured field handling |
| Reports | Python / PDF utilities | Compliance reporting |
| Barcode | Barcode integration | Product intelligence |
| Authentication | Node.js backend auth | Authority access control |

---

# 23. Local Setup

## Prerequisites

- Python 3.11+
- Node.js
- npm
- Git
- Optional NVIDIA GPU/CUDA for accelerated OCR
- Gemini API key for live VLM extraction

## Python Compliance Engine

```powershell
cd PythonCompliance

python -m venv .venv
.venv\Scripts\activate

pip install -r requirements.txt
```

For live Gemini extraction:

```powershell
$env:USE_VLM="true"
$env:VLM_PROVIDER="real"
$env:GEMINI_API_KEY="YOUR_API_KEY"
```

Never commit the API key.

## Backend

```powershell
cd FullStack\server
npm install
npm run dev
```

Backend:

```text
http://localhost:5000
```

## Frontend

Open a second terminal:

```powershell
cd FullStack
npm install
npm run dev
```

Frontend:

```text
http://localhost:3000
```

---

# 24. Testing

The Python project contains automated tests covering extraction, normalization, fusion, applicability, rule evaluation and reporting.

Representative test commands:

```powershell
cd PythonCompliance

pytest tests\test_fusion.py
pytest tests\test_rule_engine.py tests\test_compliance.py tests\test_report.py
```

The frontend can be verified with:

```powershell
cd FullStack
npm run build
```

---

# 25. Verified End-to-End Demonstration

A final end-to-end verification was performed using the team's **Surf Excel** test label.

Result:

```text
HTTP Status: 201
Overall Status: COMPLIANT
Violations: 0
Checked Fields: 8
```

The scan successfully passed through:

```text
Image
 → OpenCV
 → PaddleOCR
 → Gemini VLM
 → Fusion
 → Normalization
 → Applicability
 → Rule Engine
 → Compliance Result
 → Node.js API
 → React Frontend
```

The demonstration confirms the complete extraction-to-decision-to-UI integration.

---

# 26. Design Highlights for Evaluation

### Evidence-backed AI

AI is used where visual/semantic interpretation is useful, while legal decisions remain deterministic.

### Multi-source extraction

PaddleOCR, Gemini VLM and barcode/product intelligence complement one another.

### Conflict-aware fusion

The system does not silently choose between conflicting legal values.

### Human-in-the-loop review

Uncertain cases can be resolved by an authority without rerunning the entire AI pipeline.

### Consumer-to-authority feedback loop

Public complaints and feedback are stored and surfaced to the Authority Panel.

### Explainable compliance

Field-level evidence, statuses, rule results and officer overrides make results auditable.

### Scalable architecture

The system separates the Python compliance engine from the Node/React application layer, allowing the rule engine and frontend platform to evolve independently.

---

# 27. Future Scalability

The current implementation uses SQLite for simplicity and evaluation.

For production-scale deployment, the architecture can be extended with:

- PostgreSQL or another production database
- centralized object storage for label images/reports
- distributed OCR/VLM workers
- external product/barcode registries
- multilingual label support
- expanded regulatory rule packs
- role-based authority administration
- production monitoring and audit logging

The core separation between **extraction, evidence fusion, applicability, deterministic rules and human review** provides a foundation for those extensions.

---

# 28. Repository

**GitHub:**  
https://github.com/priyang-loq/SIH26034-Legal-Metrology-Team-Spectaculars.git

**Problem Statement:** SIH26034  
**Team:** Spectaculars  
**Team ID:** 144871

---

# 29. Summary

**VeriPack** is a complete packaged-commodity compliance platform that connects:

```text
AI-Assisted Extraction
        ↓
Evidence Fusion
        ↓
Normalization
        ↓
Legal Metrology Rule Engine
        ↓
Compliance Decision
        ↓
Reports / Dashboard
        ↓
Public Feedback
        ↓
Authority Review
        ↓
Verified Final Decision
```

It is designed to make packaged-commodity compliance **faster, evidence-backed, explainable and reviewable**, while keeping the final statutory decision under deterministic rule logic and human regulatory oversight.
