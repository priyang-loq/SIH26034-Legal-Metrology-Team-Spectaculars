/**
 * Minimal in-memory rate limiter. No new dependency, enough to stop a public
 * endpoint (scan upload, complaint submission, code guessing) from being
 * hammered during a demo or from a script.
 */

const buckets = new Map();

function rateLimit({ windowMs = 60000, max = 30, message } = {}) {
  return function limiter(req, res, next) {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const entry = buckets.get(key);

    if (!entry || now > entry.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: message || `Too many requests. Please try again in ${retryAfter} seconds.`
      });
    }

    return next();
  };
}

// Housekeeping so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets.entries()) {
    if (now > entry.resetAt) buckets.delete(key);
  }
}, 120000).unref();

module.exports = { rateLimit };
