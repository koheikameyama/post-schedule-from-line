import { google } from 'googleapis';
import { getOAuthClient } from './googleAuth';

export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startDateTime: string; // ISO 8601 format
  endDateTime?: string; // ISO 8601 format
}

export async function createCalendarEvent(
  accessToken: string,
  refreshToken: string,
  event: CalendarEvent,
  calendarId: string = 'primary'
): Promise<string> {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const eventResource = {
    summary: event.title,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.startDateTime,
      timeZone: 'Asia/Tokyo',
    },
    end: {
      dateTime: event.endDateTime || event.startDateTime,
      timeZone: 'Asia/Tokyo',
    },
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: eventResource,
  });

  return response.data.id || '';
}

export async function createMultipleCalendarEvents(
  accessToken: string,
  refreshToken: string,
  events: CalendarEvent[]
): Promise<string[]> {
  const eventIds = await Promise.all(
    events.map((event) => createCalendarEvent(accessToken, refreshToken, event))
  );

  return eventIds;
}
