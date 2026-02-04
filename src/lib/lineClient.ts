import { Client, TextMessage } from '@line/bot-sdk';

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
