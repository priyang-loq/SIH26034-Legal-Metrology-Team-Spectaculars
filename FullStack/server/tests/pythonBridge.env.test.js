const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { runPythonCompliance } = require('../utils/pythonBridge');

const PYTHON_EXECUTABLE = process.platform === 'win32' ? 'python' : 'python3';
const MOCK_SCRIPT = path.join(__dirname, 'mock_env_python.py');

process.env.GEMINI_API_KEY = 'test-sentinel';

test('environment propagation: GEMINI_API_KEY reaches child process', async () => {
  const options = {
    exe: PYTHON_EXECUTABLE,
    script: MOCK_SCRIPT,
    skipFileCheck: true
  };
  const result = await runPythonCompliance('dummy.jpg', options);
  assert.strictEqual(result.env_key, 'test-sentinel');
});

test('environment propagation: PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT defaults to "0"', async () => {
  const pyCode = 'import os, json, sys; json.dump({"product_id": "test", "category": "general", "overall_decision": "COMPLIANT", "summary": {}, "violations": [], "needs_review": [], "passed_fields": [], "not_applicable_fields": [], "warnings": [], "pdx": os.getenv("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "")}, sys.stdout)';
  const options = {
    exe: PYTHON_EXECUTABLE,
    script: '-c',
    skipFileCheck: true
  };
  const result = await runPythonCompliance(pyCode, options);
  assert.strictEqual(result.pdx, '0');
});

test('environment propagation: options.env overrides PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT', async () => {
  const pyCode = 'import os, json, sys; json.dump({"product_id": "test", "category": "general", "overall_decision": "COMPLIANT", "summary": {}, "violations": [], "needs_review": [], "passed_fields": [], "not_applicable_fields": [], "warnings": [], "pdx": os.getenv("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "")}, sys.stdout)';
  const options = {
    exe: PYTHON_EXECUTABLE,
    script: '-c',
    skipFileCheck: true,
    env: { PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT: '1' }
  };
  const result = await runPythonCompliance(pyCode, options);
  assert.strictEqual(result.pdx, '1');
});

test('environment propagation: explicit caller process.env value is preserved', async () => {
  const oldVal = process.env.PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT;
  process.env.PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT = 'custom_caller_value';
  try {
    const pyCode = 'import os, json, sys; json.dump({"product_id": "test", "category": "general", "overall_decision": "COMPLIANT", "summary": {}, "violations": [], "needs_review": [], "passed_fields": [], "not_applicable_fields": [], "warnings": [], "pdx": os.getenv("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "")}, sys.stdout)';
    const options = {
      exe: PYTHON_EXECUTABLE,
      script: '-c',
      skipFileCheck: true
    };
    const result = await runPythonCompliance(pyCode, options);
    assert.strictEqual(result.pdx, 'custom_caller_value');
  } finally {
    if (oldVal === undefined) {
      delete process.env.PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT;
    } else {
      process.env.PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT = oldVal;
    }
  }
});
