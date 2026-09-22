# LMPC Compliance Inspector - SIH26034

Full stack: React/Vite frontend (yours) + Node/Express + SQLite backend (new).

## What's new in this package

- **`/server`** - a complete Express backend: label-scan endpoint, rule-checking
  engine, SQLite storage, seller/regulator analytics, and a **private, login-gated
  Authority Portal** with per-scan actions and automatic PDF report generation.
- **`src/components/authority/`** - `AuthorityLogin.tsx` and `AuthorityPortal.tsx`,
  wired into `App.tsx` behind a new "Authority Portal" button in the header
  (not part of the public nav tabs).
- **`src/services/authApi.ts` / `authorityApi.ts`** - frontend clients for login
  and the authority actions/reports API.
- **`src/services/complianceApi.ts`** - now calls the real backend first, and
  automatically falls back to the original mock data if the backend isn't
  running, so the frontend never breaks during development or demo.

## Run it locally

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
npm run seed      # creates the demo authority account
npm run dev       # starts on http://localhost:5000
```

Demo authority login (change before any real deployment):
- username: `authority_admin`
- password: `ChangeMe123`
(or whatever you set in `server/.env`)

### 2. Frontend

```bash
npm install
cp .env.local.example .env.local
npm run dev        # starts on http://localhost:3000
```

Open the app, use the three public tabs as before, and click **"Authority
Portal"** (top-right, lock icon) to log in privately as the regulator.

## How the pieces fit together

- **Seller Self-Check / Consumer Scan** -> `POST /api/scan-label` (multipart
  image upload) -> rule engine checks the label -> result saved to SQLite ->
  if the product **fails**, a PDF "Failure & Improvement Analysis Report" is
  generated automatically and linked to that scan.
- **Regulator Analytics tab** (public) -> `GET /api/regulator/analytics` ->
  aggregate stats only, no per-scan actions - unchanged from your original UX.
- **Authority Portal** (private, login required) -> `GET /api/authority/violations`
  -> shows every non-compliant/flagged scan with a **"Download Failure &
  Improvement Report"** button and buttons to mark items **Under Review /
  Notice Issued / Resolved**.

## Connecting your teammate's real OCR + rule-engine pipeline

Right now, if no OCR data is supplied, the backend falls back to a
deterministic demo extraction (see `server/utils/ruleEngine.js` ->
`demoExtraction()`) so the whole system is testable end-to-end today.

Once the real OCR/rule-extraction service is ready, have it send its output
as an `extractedFields` JSON string alongside the image in the same
`POST /api/scan-label` request. The exact contract - one entry per mandatory
field (`mrp`, `net_quantity`, `manufacturer_details`, `consumer_care`,
`date_of_manufacture`, `country_of_origin`), each with `present`/`malformed`/
`text` - is documented at the top of `server/utils/ruleEngine.js`. No other
code needs to change; the rule engine and PDF generation already run off that
same input.

## Notes

- Uploaded images are stored in `server/uploads/`, generated PDF reports in
  `server/reports/` - both served as static files by the backend.
- The database is a single SQLite file at `server/lmpc.db`, created
  automatically on first run.
- `better-sqlite3` compiles a small native module during `npm install` -
  this needs a working Node/build toolchain (Node 18+ recommended), which
  any normal dev machine already has.
