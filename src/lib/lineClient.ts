import { Client, TextMessage, FlexMessage, FlexBubble, FlexCarousel } from '@line/bot-sdk';

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
};

export const lineClient = new Client(config);

export function createAuthMessage(userId: string): TextMessage {
  const liffId = process.env.LIFF_ID || '';
  const liffUrl = `https://liff.line.me/${liffId}`;

  return {
    type: 'text',
    text: `このBotを使うには、Googleカレンダーとの連携が必要です。\n\n下のURLをタップして認証してください：\n${liffUrl}`,
  };
}

export function createScheduleNotFoundMessage(): TextMessage {
  return {
    type: 'text',
    text: 'スケジュール情報が見つかりませんでした。',
  };
}

export function createErrorMessage(): TextMessage {
  return {
    type: 'text',
    text: 'エラーが発生しました。しばらく待ってから再度お試しください。',
  };
}

export function createReAuthMessage(userId: string): TextMessage {
  const liffId = process.env.LIFF_ID || '';
  const liffUrl = `https://liff.line.me/${liffId}`;

  return {
    type: 'text',
    text: `Google認証の有効期限が切れました。再度認証してください。\n\n下のURLをタップして認証してください：\n${liffUrl}`,
  };
}

export interface ScheduleForDisplay {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDateTime: Date;
  endDateTime?: Date | null;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createScheduleBubble(schedule: ScheduleForDisplay, index: number): FlexBubble {
  const bodyContents: FlexBubble['body'] = {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: `スケジュール ${index + 1}`,
        weight: 'bold',
        size: 'xs',
        color: '#1DB446',
      },
      {
        type: 'text',
        text: schedule.title,
        weight: 'bold',
        size: 'xl',
        margin: 'md',
        wrap: true,
      },
      {
        type: 'separator',
        margin: 'lg',
      },
      {
        type: 'box',
        layout: 'vertical',
        margin: 'lg',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '開始',
                size: 'sm',
                color: '#555555',
                flex: 1,
              },
              {
                type: 'text',
                text: formatDateTime(schedule.startDateTime),
                size: 'sm',
                color: '#111111',
                flex: 3,
                align: 'end',
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '終了',
                size: 'sm',
                color: '#555555',
                flex: 1,
              },
              {
                type: 'text',
                text: schedule.endDateTime ? formatDateTime(schedule.endDateTime) : '未設定',
                size: 'sm',
                color: '#111111',
                flex: 3,
                align: 'end',
              },
            ],
          },
        ],
      },
    ],
  };

  // Add location if present
  if (schedule.location) {
    (bodyContents.contents as any[]).push({
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: '場所',
          size: 'sm',
          color: '#555555',
          flex: 1,
        },
        {
          type: 'text',
          text: schedule.location,
          size: 'sm',
          color: '#111111',
          flex: 3,
          align: 'end',
          wrap: true,
        },
      ],
    });
  }

  // Add description if present
  if (schedule.description) {
    (bodyContents.contents as any[]).push({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: '詳細',
          size: 'sm',
          color: '#555555',
        },
        {
          type: 'text',
          text: schedule.description,
          size: 'sm',
          color: '#111111',
          wrap: true,
          margin: 'sm',
        },
      ],
    });
  }

  return {
    type: 'bubble',
    body: bodyContents,
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          action: {
            type: 'postback',
            label: 'カレンダーを選択',
            data: `action=show_calendars&scheduleId=${schedule.id}`,
            displayText: 'カレンダーを選択',
          },
          color: '#1DB446',
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: 'スキップ',
            data: `action=skip&scheduleId=${schedule.id}`,
            displayText: 'スキップ',
          },
        },
      ],
      flex: 0,
    },
  };
}

export function createScheduleCarousel(schedules: ScheduleForDisplay[]): FlexMessage {
  const bubbles = schedules.map((schedule, index) => createScheduleBubble(schedule, index));

  const carousel: FlexCarousel = {
    type: 'carousel',
    contents: bubbles,
  };

  return {
    type: 'flex',
    altText: `${schedules.length}件のスケジュールが見つかりました`,
    contents: carousel,
  };
}

export interface CalendarInfo {
  id: string;
  name: string;
  color?: string;
}

export function createCalendarSelectionMessage(
  calendars: CalendarInfo[],
  scheduleId: string
): FlexMessage {
  const bubbleContents: FlexBubble = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'カレンダーを選択',
          weight: 'bold',
          size: 'lg',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: calendars.slice(0, 10).map((cal) => ({
        type: 'button' as const,
        style: 'secondary' as const,
        height: 'sm' as const,
        action: {
          type: 'postback' as const,
          label: cal.name.length > 20 ? cal.name.substring(0, 17) + '...' : cal.name,
          data: `action=register&scheduleId=${scheduleId}&calendarId=${encodeURIComponent(cal.id)}`,
          displayText: `${cal.name}に登録`,
        },
      })),
    },
  };

  return {
    type: 'flex',
    altText: 'カレンダーを選択してください',
    contents: bubbleContents,
  };
}

export function createRegistrationSuccessMessage(
  title: string,
  calendarName: string
): TextMessage {
  return {
    type: 'text',
    text: `「${title}」を${calendarName}に登録しました`,
  };
}

export function createSkipMessage(title: string): TextMessage {
  return {
    type: 'text',
    text: `「${title}」をスキップしました`,
  };
}
