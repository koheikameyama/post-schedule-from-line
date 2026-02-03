import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function verifyLineSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const signature = req.headers['x-line-signature'] as string;

  if (!signature) {
    res.status(403).json({ error: 'No signature' });
    return;
  }

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    throw new Error('LINE_CHANNEL_SECRET is not set');
  }

  // Use raw body for signature verification
  const body = (req as any).rawBody;
  if (!body) {
    res.status(403).json({ error: 'No raw body' });
    return;
  }

  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');

  if (hash !== signature) {
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  next();
}
