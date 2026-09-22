const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { runPythonCompliance } = require('../utils/pythonBridge');

const PYTHON_EXECUTABLE = process.platform === 'win32' ? 'python' : 'python3';
const MOCK_SCRIPT = path.join(__dirname, 'mock_python.py');

test('rejects missing image path', async () => {
  await assert.rejects(runPythonCompliance(), {
    message: 'Image path is required.'
  });
});

test('rejects nonexistent image path', async () => {
  await assert.rejects(runPythonCompliance('does-not-exist.jpg'), {
    message: 'Image file does not exist.'
  });
});

test('handles paths with spaces safely', async () => {
  // Pass skipFileCheck to bypass fs.existsSync, simulating a file that exists but has spaces
  // It should reach the python process and pass successfully
  const options = {
    exe: PYTHON_EXECUTABLE,
    script: MOCK_SCRIPT,
    skipFileCheck: true,
    env: { TEST_MODE: 'VALID' }
  };
  const result = await runPythonCompliance('path with spaces.jpg', options);
  assert.strictEqual(result.overall_decision, 'COMPLIANT');
});

test('Python process exits non-zero -> returns controlled error', async () => {
  const options = {
    exe: PYTHON_EXECUTABLE,
    script: MOCK_SCRIPT,
    skipFileCheck: true,
    env: { TEST_MODE: 'NON_ZERO' }
  };
  await assert.rejects(runPythonCompliance('test.jpg', options), {
    message: 'Python process exited with code 2.'
  });
});

test('Python emits invalid JSON -> returns controlled error', async () => {
  const options = {
    exe: PYTHON_EXECUTABLE,
    script: MOCK_SCRIPT,
    skipFileCheck: true,
    env: { TEST_MODE: 'INVALID_JSON' }
  };
  await assert.rejects(runPythonCompliance('test.jpg', options), {
    message: 'Invalid JSON output from Python bridge.'
  });
});

test('Python emits missing field -> rejects it', async () => {
  const options = {
    exe: PYTHON_EXECUTABLE,
    script: MOCK_SCRIPT,
    skipFileCheck: true,
    env: { TEST_MODE: 'MISSING_FIELD' }
  };
  await assert.rejects(runPythonCompliance('test.jpg', options), {
    message: 'Missing required field in Python output: overall_decision'
  });
});

test('Report with invalid overall_decision -> rejects it', async () => {
  const options = {
    exe: PYTHON_EXECUTABLE,
    script: MOCK_SCRIPT,
    skipFileCheck: true,
    env: { TEST_MODE: 'INVALID_DECISION' }
  };
  await assert.rejects(runPythonCompliance('test.jpg', options), {
    message: 'Invalid overall_decision: BLAH'
  });
});

test('Timeout -> terminates and returns controlled error', async () => {
  const options = {
    exe: PYTHON_EXECUTABLE,
    script: MOCK_SCRIPT,
    skipFileCheck: true,
    timeout: 100, // very short timeout
    env: { TEST_MODE: 'TIMEOUT' }
  };
  await assert.rejects(runPythonCompliance('test.jpg', options), {
    message: 'Python bridge timeout.'
  });
});

test('Python emits a valid final report -> parses it', async () => {
  const options = {
    exe: PYTHON_EXECUTABLE,
    script: MOCK_SCRIPT,
    skipFileCheck: true,
    env: { TEST_MODE: 'VALID' }
  };
  const result = await runPythonCompliance('test.jpg', options);
  assert.strictEqual(result.overall_decision, 'COMPLIANT');
  assert.strictEqual(result.product_id, '1');
});
