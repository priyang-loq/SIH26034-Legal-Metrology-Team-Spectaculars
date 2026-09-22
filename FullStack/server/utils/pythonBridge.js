const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'D:\\PRIYADIP\\.venv\\Scripts\\python.exe';
const BRIDGE_SCRIPT = path.join(__dirname, '..', 'scripts', 'run_compliance_bridge.py');

function runPythonCompliance(imagePath, rawOutPath = null, options = {}) {
  return new Promise((resolve, reject) => {
    if (!imagePath) {
      return reject(new Error('Image path is required.'));
    }

    // We only check for existence if we are not skipping it in tests
    if (!options.skipFileCheck && !fs.existsSync(imagePath)) {
      return reject(new Error('Image file does not exist.'));
    }

    const exe = options.exe || process.env.PYTHON_EXECUTABLE || PYTHON_EXECUTABLE;
    const script = options.script || BRIDGE_SCRIPT;

    const env = {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH || 'D:\\PRIYADIP',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      USE_VLM: 'true',
      VLM_PROVIDER: 'real',
      PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT:
        process.env.PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT !== undefined
          ? process.env.PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT
          : '0',
      ...options.env
    };

    // Increased from 60 seconds to 180 seconds for CPU PaddleOCR fallback.
    const timeout = options.timeout !== undefined ? options.timeout : 600000;

    const args = [script, imagePath];
    if (rawOutPath) {
      args.push('--raw-out', rawOutPath);
    }

    execFile(
      exe,
      args,
      { env, timeout },
      (error, stdout, stderr) => {
        if (error) {
          console.error('PYTHON STDERR:', stderr);

          if (error.killed) {
            return reject(new Error('Python bridge timeout.'));
          }

          return reject(
            new Error(
              `Python process exited with code ${error.code || 'unknown'}.`
            )
          );
        }

        try {
          const jsonStr = stdout.trim();
          const parsed = JSON.parse(jsonStr);

          const requiredKeys = [
            'product_id',
            'category',
            'overall_decision',
            'summary',
            'violations',
            'needs_review',
            'passed_fields',
            'not_applicable_fields',
            'warnings'
          ];

          for (const key of requiredKeys) {
            if (!(key in parsed)) {
              return reject(
                new Error(`Missing required field in Python output: ${key}`)
              );
            }
          }

          const validDecisions = [
            'COMPLIANT',
            'NON_COMPLIANT',
            'NEEDS_REVIEW'
          ];

          if (!validDecisions.includes(parsed.overall_decision)) {
            return reject(
              new Error(
                `Invalid overall_decision: ${parsed.overall_decision}`
              )
            );
          }

          resolve(parsed);
        } catch (err) {
          reject(new Error('Invalid JSON output from Python bridge.'));
        }
      }
    );
  });
}

const REVIEW_BRIDGE_SCRIPT = path.join(__dirname, '..', 'scripts', 'run_review_bridge.py');

function runPythonReview(rawExtractionPath, overrides, options = {}) {
  return new Promise((resolve, reject) => {
    if (!rawExtractionPath) {
      return reject(new Error('Raw extraction path is required.'));
    }

    if (!fs.existsSync(rawExtractionPath)) {
      return reject(new Error('Raw extraction file does not exist.'));
    }

    const exe = options.exe || process.env.PYTHON_EXECUTABLE || PYTHON_EXECUTABLE;
    const script = options.script || REVIEW_BRIDGE_SCRIPT;

    const env = {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH || 'D:\\PRIYADIP',
      USE_VLM: 'true',
      VLM_PROVIDER: 'real',
      ...options.env
    };

    const args = [script, rawExtractionPath];
    if (overrides) {
      args.push('--overrides', JSON.stringify(overrides));
    }

    const timeout = options.timeout !== undefined ? options.timeout : 120000;

    execFile(
      exe,
      args,
      { env, timeout },
      (error, stdout, stderr) => {
        if (error) {
          console.error('PYTHON STDERR (Review):', stderr);
          if (error.killed) return reject(new Error('Python review bridge timeout.'));
          return reject(new Error(`Python process exited with code ${error.code || 'unknown'}.`));
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed);
        } catch (err) {
          reject(new Error('Invalid JSON output from Python review bridge.'));
        }
      }
    );
  });
}

module.exports = {
  runPythonCompliance,
  runPythonReview,
  PYTHON_EXECUTABLE,
  BRIDGE_SCRIPT
};


