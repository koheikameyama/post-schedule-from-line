import { Router, Request, Response } from 'express';
import { WebhookEvent, MessageEvent, TextEventMessage } from '@line/bot-sdk';
import { verifyLineSignature } from '../middleware/lineSignature';
import { lineClient, createAuthMessage, createScheduleNotFoundMessage, createErrorMessage, createReAuthMessage } from '../lib/lineClient';
import { extractSchedules } from '../lib/gemini';
import { isTokenExpired, refreshAccessToken } from '../lib/googleAuth';
import { encrypt, decrypt } from '../lib/encryption';
import prisma from '../lib/db';

const router = Router();

router.post('/', verifyLineSignature, async (req: Request, res: Response) => {
  try {
    const events: WebhookEvent[] = req.body.events;

    await Promise.all(
      events.map(async (event) => {
        if (event.type === 'message' && event.message.type === 'text') {
          await handleTextMessage(event);
        }
      })
    );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

async function handleTextMessage(event: MessageEvent) {
  const userId = event.source.userId;
  if (!userId) return;

  const message = (event.message as TextEventMessage).text;

  try {
    // Check if user is authenticated
    const user = await prisma.user.findUnique({
      where: { lineUserId: userId },
    });

    if (!user || !user.googleAccessToken) {
      // User not authenticated - send auth message
      await lineClient.replyMessage(event.replyToken, createAuthMessage(userId));
      return;
    }

    // Check if token needs refresh
    if (user.googleRefreshToken && isTokenExpired(user.googleTokenExpiry)) {
      try {
        const decryptedRefreshToken = decrypt(user.googleRefreshToken);
        const refreshResult = await refreshAccessToken(decryptedRefreshToken);

        // Update tokens in database
        await prisma.user.update({
          where: { id: user.id },
          data: {
            googleAccessToken: encrypt(refreshResult.accessToken),
            googleTokenExpiry: refreshResult.expiryDate,
          },
        });

        console.log(`Token refreshed for user ${userId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage === 'TOKEN_REVOKED') {
          // Token is revoked, need re-authentication
          await prisma.user.update({
            where: { id: user.id },
            data: {
              googleAccessToken: null,
              googleRefreshToken: null,
              googleTokenExpiry: null,
            },
          });

          await lineClient.replyMessage(event.replyToken, createReAuthMessage(userId));
          return;
        }

        // Other refresh error - log and continue (might still work)
        console.error('Token refresh error:', error);
      }
    }

    // User is authenticated - extract schedules
    const result = await extractSchedules(message);

    if (result.schedules.length === 0) {
      await lineClient.replyMessage(event.replyToken, createScheduleNotFoundMessage());
      return;
    }

    // Save pending schedules to database
    const lineMessageId = event.message.id;
    await Promise.all(
      result.schedules.map((schedule) =>
        prisma.pendingSchedule.create({
          data: {
            userId: user.id,
            lineMessageId,
            title: schedule.title,
            description: schedule.description,
            location: schedule.location,
            startDateTime: new Date(schedule.startDateTime),
            endDateTime: schedule.endDateTime ? new Date(schedule.endDateTime) : null,
            status: 'PENDING',
          },
        })
      )
    );

    // For MVP: send simple confirmation message
    // TODO: Replace with Flex Message carousel in Phase 2
    const confirmationText = result.schedules
      .map(
        (s, i) =>
          `【スケジュール ${i + 1}】\n` +
          `タイトル: ${s.title}\n` +
          (s.location ? `場所: ${s.location}\n` : '') +
          `開始: ${new Date(s.startDateTime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}\n` +
          `終了: ${s.endDateTime ? new Date(s.endDateTime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '未設定'}`
      )
      .join('\n\n');

    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: `以下のスケジュールを抽出しました：\n\n${confirmationText}\n\n（MVP版では自動登録機能は未実装です）`,
    });
  } catch (error) {
    console.error('Error handling text message:', error);
    await lineClient.replyMessage(event.replyToken, createErrorMessage());
  }
}

export default router;
