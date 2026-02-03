import { Client, TextMessage } from '@line/bot-sdk';

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
};

export const lineClient = new Client(config);

export function createAuthMessage(userId: string): TextMessage {
  const baseUrl = process.env.GOOGLE_REDIRECT_URI?.replace('/auth/google/callback', '') || 'http://localhost:3000';
  const authUrl = `${baseUrl}/auth/google?userId=${encodeURIComponent(userId)}`;

  return {
    type: 'text',
    text: `このBotを使うには、まずGoogle認証が必要です。\n\n以下のURLから認証してください：\n${authUrl}`,
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
