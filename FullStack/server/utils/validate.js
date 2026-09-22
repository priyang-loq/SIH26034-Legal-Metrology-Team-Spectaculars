/**
 * Small backend validation helpers. Every rule here is enforced server-side;
 * the matching frontend checks exist only to give faster feedback.
 */

const USERNAME_RE = /^[a-zA-Z0-9._-]{4,32}$/;

function validationError(message, field) {
  const err = new Error(message);
  err.status = 400;
  err.field = field;
  return err;
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return 'Authority User ID is required.';
  }
  if (!USERNAME_RE.test(username.trim())) {
    return 'Authority User ID must be 4-32 characters and may contain only letters, numbers, dot, underscore or hyphen.';
  }
  return null;
}

/**
 * Password policy: at least 10 characters, with a lowercase letter, an
 * uppercase letter, a digit and a symbol. Checked on the backend so a crafted
 * request cannot bypass the UI.
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') return 'Password is required.';
  if (password.length < 10) return 'Password must be at least 10 characters long.';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain a digit.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a symbol.';
  if (/^(password|changeme|admin|authority)/i.test(password)) {
    return 'Password is too predictable. Choose something less obvious.';
  }
  return null;
}

function requireString(value, field, { max = 2000, min = 1 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min) {
    throw validationError(`${field} is required.`, field);
  }
  if (value.length > max) {
    throw validationError(`${field} must be ${max} characters or fewer.`, field);
  }
  return value.trim();
}

function optionalString(value, field, { max = 2000 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  return requireString(value, field, { max });
}

function requireEnum(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw validationError(`${field} must be one of: ${allowed.join(', ')}.`, field);
  }
  return value;
}

function requireRating(value, field) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 5) {
    throw validationError(`${field} must be a number between 0 and 5.`, field);
  }
  return Math.round(num * 2) / 2; // half-star granularity
}

function optionalRating(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return requireRating(value, field);
}

function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limitRaw = parseInt(query.limit, 10) || 25;
  const limit = Math.min(200, Math.max(1, limitRaw));
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = {
  validationError,
  validateUsername,
  validatePassword,
  requireString,
  optionalString,
  requireEnum,
  requireRating,
  optionalRating,
  parsePagination
};
