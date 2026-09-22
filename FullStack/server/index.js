require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db'); // ensures schema is created on boot

const authRoutes = require('./routes/auth.routes');
const { router: scanRoutes } = require('./routes/scan.routes');
const sellerRoutes = require('./routes/seller.routes');
const regulatorRoutes = require('./routes/regulator.routes');
const authorityRoutes = require('./routes/authority.routes');
const barcodeRoutes = require('./routes/barcode.routes');
const coverageRoutes = require('./routes/coverage.routes');
const complaintRoutes = require('./routes/complaint.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const publicCheckRoutes = require('./routes/publicCheck.routes');

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded label images and generated PDF reports as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/reports', express.static(path.join(__dirname, 'reports')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'lmpc-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api', scanRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/regulator', regulatorRoutes);
app.use('/api/authority', authorityRoutes);
app.use('/api/barcode', barcodeRoutes);
app.use('/api/rule-coverage', coverageRoutes);
app.use('/api/complaints', complaintRoutes.router);
app.use('/api/feedback', feedbackRoutes.router);
app.use('/api/public-check', publicCheckRoutes);

// Central error handler (e.g. multer file-type/size errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`LMPC backend listening on http://localhost:${PORT}`);
});




