import { createHash } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

const IDEMPOTENCY_TTL_SECONDS = 60;

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['idempotency-key'] as string | undefined;
  if (!key) return next();

  const hash = createHash('sha256').update(JSON.stringify(req.body)).digest('hex');

  try {
    const stored = await redis.get(`idempotency:${key}`);
    if (stored) {
      const record = JSON.parse(stored);
      if (record.hash !== hash) {
        return res.status(400).json({ error: 'Idempotency key reuse with different payload' });
      }
      return res.status(200).json(record.response);
    }
  } catch (err) {
    logger.warn('[Idempotency] Redis unavailable, proceeding without deduplication', err);
    return next(); // fail-open
  }

  // Intercept res.json to cache the response
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    redis
      .set(`idempotency:${key}`, JSON.stringify({ hash, response: body }), { EX: IDEMPOTENCY_TTL_SECONDS })
      .catch((err: any) => logger.warn('[Idempotency] Failed to cache response', err));
    return originalJson(body);
  };

  next();
};
