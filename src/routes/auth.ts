import { Router, Request, Response } from 'express';
import { getAuthUrl, getTokensFromCode, getCalendarList } from '../lib/googleAuth';
import { encrypt } from '../lib/encryption';
import prisma from '../lib/db';

const router = Router();

// Start OAuth flow
router.get('/google', (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  if (!userId) {
    return res.status(400).send('Missing userId parameter');
  }

  const authUrl = getAuthUrl(userId);
  res.redirect(authUrl);
});

// OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string; // LINE User ID

    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter');
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return res.status(500).send('Failed to get tokens from Google');
    }

    // Encrypt tokens
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);

    // Get calendar list
    const calendars = await getCalendarList(tokens.access_token);

    // Save or update user
    await prisma.user.upsert({
      where: { lineUserId: state },
      update: {
        googleAccessToken: encryptedAccessToken,
        googleRefreshToken: encryptedRefreshToken,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleCalendars: JSON.stringify(calendars),
      },
      create: {
        lineUserId: state,
        googleAccessToken: encryptedAccessToken,
        googleRefreshToken: encryptedRefreshToken,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleCalendars: JSON.stringify(calendars),
      },
    });

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>認証完了</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; }
            .success { color: #00B900; font-size: 48px; margin-bottom: 20px; }
            h1 { color: #333; }
            p { color: #666; font-size: 18px; }
          </style>
        </head>
        <body>
          <div class="success">✓</div>
          <h1>認証が完了しました</h1>
          <p>LINEでメッセージを送ってください</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('認証に失敗しました');
  }
});

export default router;
