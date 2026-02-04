import { Router, Request, Response } from 'express';
import { WebhookEvent, MessageEvent, PostbackEvent, TextEventMessage } from '@line/bot-sdk';
import { verifyLineSignature } from '../middleware/lineSignature';
import {
  lineClient,
  createAuthMessage,
  createScheduleNotFoundMessage,
  createErrorMessage,
  createReAuthMessage,
  createScheduleCarousel,
  createCalendarSelectionMessage,
  createRegistrationSuccessMessage,
  createSkipMessage,
  ScheduleForDisplay,
  CalendarInfo,
} from '../lib/lineClient';
import { extractSchedules } from '../lib/gemini';
import { isTokenExpired, refreshAccessToken } from '../lib/googleAuth';
import { createCalendarEvent } from '../lib/googleCalendar';
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
        } else if (event.type === 'postback') {
          await handlePostback(event);
        }
      })
    );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Ensure user is authenticated and tokens are fresh
 * Returns user if valid, null otherwise (sends appropriate message)
 */
async function ensureAuthenticatedUser(
  userId: string,
  replyToken: string
): Promise<{ user: NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>; accessToken: string } | null> {
  const user = await prisma.user.findUnique({
    where: { lineUserId: userId },
  });

  if (!user || !user.googleAccessToken || !user.googleRefreshToken) {
    await lineClient.replyMessage(replyToken, createAuthMessage(userId));
    return null;
  }

  // Check if token needs refresh
  if (isTokenExpired(user.googleTokenExpiry)) {
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
      return { user, accessToken: refreshResult.accessToken };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage === 'TOKEN_REVOKED') {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            googleAccessToken: null,
            googleRefreshToken: null,
            googleTokenExpiry: null,
          },
        });

        await lineClient.replyMessage(replyToken, createReAuthMessage(userId));
        return null;
      }

      console.error('Token refresh error:', error);
    }
  }

  return { user, accessToken: decrypt(user.googleAccessToken) };
}

async function handleTextMessage(event: MessageEvent) {
  const userId = event.source.userId;
  if (!userId) return;

  const message = (event.message as TextEventMessage).text;

  try {
    const authResult = await ensureAuthenticatedUser(userId, event.replyToken);
    if (!authResult) return;

    const { user } = authResult;

    // Extract schedules from message
    const result = await extractSchedules(message);

    if (result.schedules.length === 0) {
      await lineClient.replyMessage(event.replyToken, createScheduleNotFoundMessage());
      return;
    }

    // Save pending schedules to database
    const lineMessageId = event.message.id;
    const savedSchedules = await Promise.all(
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

    // Create schedule display objects
    const schedulesForDisplay: ScheduleForDisplay[] = savedSchedules.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      location: s.location,
      startDateTime: s.startDateTime,
      endDateTime: s.endDateTime,
    }));

    // Send carousel with schedule cards
    await lineClient.replyMessage(event.replyToken, createScheduleCarousel(schedulesForDisplay));
  } catch (error) {
    console.error('Error handling text message:', error);
    await lineClient.replyMessage(event.replyToken, createErrorMessage());
  }
}

function parsePostbackData(data: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = data.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value !== undefined) {
      params[key] = decodeURIComponent(value);
    }
  }
  return params;
}

async function handlePostback(event: PostbackEvent) {
  const userId = event.source.userId;
  if (!userId) return;

  const params = parsePostbackData(event.postback.data);
  const action = params.action;
  const scheduleId = params.scheduleId;

  try {
    switch (action) {
      case 'show_calendars':
        await handleShowCalendars(userId, scheduleId, event.replyToken);
        break;
      case 'register':
        await handleRegister(userId, scheduleId, params.calendarId, event.replyToken);
        break;
      case 'skip':
        await handleSkip(userId, scheduleId, event.replyToken);
        break;
      default:
        console.warn(`Unknown postback action: ${action}`);
    }
  } catch (error) {
    console.error('Error handling postback:', error);
    await lineClient.replyMessage(event.replyToken, createErrorMessage());
  }
}

async function handleShowCalendars(userId: string, scheduleId: string, replyToken: string) {
  const authResult = await ensureAuthenticatedUser(userId, replyToken);
  if (!authResult) return;

  const { user } = authResult;

  // Check if schedule exists and belongs to user
  const schedule = await prisma.pendingSchedule.findFirst({
    where: { id: scheduleId, userId: user.id, status: 'PENDING' },
  });

  if (!schedule) {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: 'このスケジュールは既に処理済みか、見つかりませんでした。',
    });
    return;
  }

  // Get user's calendars
  let calendars: CalendarInfo[] = [];
  if (user.googleCalendars) {
    try {
      const parsed = JSON.parse(user.googleCalendars);
      calendars = parsed.map((cal: any) => ({
        id: cal.id,
        name: cal.summary || cal.id,
        color: cal.backgroundColor,
      }));
    } catch {
      // If parsing fails, show primary calendar only
      calendars = [{ id: 'primary', name: 'メインカレンダー' }];
    }
  } else {
    calendars = [{ id: 'primary', name: 'メインカレンダー' }];
  }

  // Filter to only writable calendars (primary and owned calendars)
  const writableCalendars = calendars.filter(
    (cal) => cal.id === 'primary' || !cal.id.includes('@group.calendar.google.com') || calendars.length <= 1
  );

  await lineClient.replyMessage(
    replyToken,
    createCalendarSelectionMessage(writableCalendars.length > 0 ? writableCalendars : calendars, scheduleId)
  );
}

async function handleRegister(userId: string, scheduleId: string, calendarId: string, replyToken: string) {
  const authResult = await ensureAuthenticatedUser(userId, replyToken);
  if (!authResult) return;

  const { user, accessToken } = authResult;

  // Get schedule
  const schedule = await prisma.pendingSchedule.findFirst({
    where: { id: scheduleId, userId: user.id, status: 'PENDING' },
  });

  if (!schedule) {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: 'このスケジュールは既に処理済みか、見つかりませんでした。',
    });
    return;
  }

  // Create calendar event
  const refreshToken = decrypt(user.googleRefreshToken!);
  const googleEventId = await createCalendarEvent(
    accessToken,
    refreshToken,
    {
      title: schedule.title,
      description: schedule.description || undefined,
      location: schedule.location || undefined,
      startDateTime: schedule.startDateTime.toISOString(),
      endDateTime: schedule.endDateTime?.toISOString(),
    },
    calendarId
  );

  // Update schedule status
  await prisma.pendingSchedule.update({
    where: { id: scheduleId },
    data: {
      status: 'REGISTERED',
      calendarId,
    },
  });

  // Record history
  await prisma.scheduleHistory.create({
    data: {
      userId: user.id,
      scheduleId,
      action: 'REGISTERED',
      calendarId,
      googleEventId,
    },
  });

  // Get calendar name for message
  let calendarName = 'カレンダー';
  if (user.googleCalendars) {
    try {
      const parsed = JSON.parse(user.googleCalendars);
      const cal = parsed.find((c: any) => c.id === calendarId);
      if (cal) {
        calendarName = cal.summary || calendarName;
      }
    } catch {
      // Use default name
    }
  }
  if (calendarId === 'primary') {
    calendarName = 'メインカレンダー';
  }

  await lineClient.replyMessage(replyToken, createRegistrationSuccessMessage(schedule.title, calendarName));
}

async function handleSkip(userId: string, scheduleId: string, replyToken: string) {
  const user = await prisma.user.findUnique({
    where: { lineUserId: userId },
  });

  if (!user) {
    await lineClient.replyMessage(replyToken, createAuthMessage(userId));
    return;
  }

  // Get schedule
  const schedule = await prisma.pendingSchedule.findFirst({
    where: { id: scheduleId, userId: user.id, status: 'PENDING' },
  });

  if (!schedule) {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: 'このスケジュールは既に処理済みか、見つかりませんでした。',
    });
    return;
  }

  // Update schedule status
  await prisma.pendingSchedule.update({
    where: { id: scheduleId },
    data: { status: 'SKIPPED' },
  });

  // Record history
  await prisma.scheduleHistory.create({
    data: {
      userId: user.id,
      scheduleId,
      action: 'SKIPPED',
    },
  });

  await lineClient.replyMessage(replyToken, createSkipMessage(schedule.title));
}

export default router;
