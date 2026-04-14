import { v4 as uuidv4 } from "uuid";

export default function responseFormatter(req, res, next) {
  req.startTime = Date.now();
  req.requestId = uuidv4();

  // Attach a helper method to standardise successful responses
  res.sendSuccess = (data, count = Array.isArray(data) ? data.length : 1, pagination = null) => {
    const responseTime = Date.now() - req.startTime;
    
    // Extract rate limit data if available (set by express-rate-limit)
    // res.getHeader('Retry-After') etc could be read too, but the easiest
    // is to check req.rateLimit which might be populated by the limiter.
    const rateLimitInfo = req.rateLimit ? {
      remaining: req.rateLimit.remaining,
      limit: req.rateLimit.limit,
      reset: req.rateLimit.resetTime ? req.rateLimit.resetTime.toISOString() : null
    } : null;

    const payload = {
      success: true,
      count,
      data,
      meta: {
        requestId: req.requestId,
        responseTime,
      }
    };

    if (rateLimitInfo) {
      payload.meta.rateLimit = rateLimitInfo;
    }

    if (pagination) {
      payload.meta.pagination = pagination;
    }

    res.json(payload);
  };

  next();
}
