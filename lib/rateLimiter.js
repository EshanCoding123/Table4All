function createRateLimiter({ limit, windowMs, now = Date.now, maxEntries = 10000 }) {
  const attempts = new Map();

  function consume(key) {
    const currentTime = now();
    const cutoff = currentTime - windowMs;
    const recentAttempts = (attempts.get(key) || []).filter(
      (timestamp) => timestamp > cutoff
    );

    if (recentAttempts.length >= limit) {
      const retryAfterMs = recentAttempts[0] + windowMs - currentTime;
      attempts.set(key, recentAttempts);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }

    if (!attempts.has(key) && attempts.size >= maxEntries) {
      attempts.delete(attempts.keys().next().value);
    }

    recentAttempts.push(currentTime);
    attempts.set(key, recentAttempts);

    return {
      allowed: true,
      remaining: limit - recentAttempts.length,
    };
  }

  return { consume };
}

module.exports = { createRateLimiter };
