const rateLimit = new Map();

class RateLimitMiddleware {
  static checkRateLimit(userId, action, limit = 1, windowMs = 1000) {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const userRateLimit = rateLimit.get(key);
    
    if (!userRateLimit) {
      rateLimit.set(key, { count: 1, lastReset: now });
      return true;
    }
    
    if (now - userRateLimit.lastReset > windowMs) {
      rateLimit.set(key, { count: 1, lastReset: now });
      return true;
    }
    
    if (userRateLimit.count >= limit) {
      return false;
    }
    
    userRateLimit.count++;
    return true;
  }
  
  static middleware(action, limit = 1, windowMs = 1000) {
    return (ctx, next) => {
      const userId = ctx.from.id;
      
      if (!RateLimitMiddleware.checkRateLimit(userId, action, limit, windowMs)) {
        ctx.reply('⚠️ Too many requests. Please wait a moment.');
        return;
      }
      
      return next();
    };
  }
}

// Clean up old rate limits every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimit.entries()) {
    if (now - value.lastReset > 3600000) { // 1 hour
      rateLimit.delete(key);
    }
  }
}, 3600000);

module.exports = RateLimitMiddleware;