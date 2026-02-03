import { Client, TextMessage, TemplateMessage } from '@line/bot-sdk';

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
};

export const lineClient = new Client(config);

export function createAuthMessage(userId: string): TemplateMessage {
  const baseUrl = process.env.GOOGLE_REDIRECT_URI?.replace('/auth/google/callback', '') || 'http://localhost:3000';
  const authUrl = `${baseUrl}/auth/google?userId=${encodeURIComponent(userId)}`;

  return {
    type: 'template',
    altText: 'Google認証が必要です',
    template: {
      type: 'buttons',
      text: 'このBotを使うには、Googleカレンダーとの連携が必要です。\n\n下のボタンをタップして認証してください。',
      actions: [
        {
          type: 'uri',
          label: 'Google認証を開始',
          uri: authUrl,
        },
      ],
    },
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
