// Simple in-memory rate limiter (no external dependency)
// Tracks requests per IP + endpoint key

const rateLimitStore = new Map();

function rateLimit({ windowMs = 60000, max = 10, key = 'default' }) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const storeKey = `${key}:${ip}`;

    const now = Date.now();
    const entry = rateLimitStore.get(storeKey);

    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(storeKey, { count: 1, resetTime: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: `Trop de tentatives. Réessayez dans ${retryAfter} secondes.`,
      });
    }

    next();
  };
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

module.exports = { rateLimit };
