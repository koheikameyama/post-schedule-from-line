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
    text: `このBotを使うには、Googleカレンダーとの連携が必要です。\n\n【認証手順】\n1. 下のURLを長押し\n2. 「Safariで開く」または「Chromeで開く」を選択\n3. Google認証を完了してください\n\n${authUrl}\n\n※LINE内蔵ブラウザでは認証できません。必ず外部ブラウザで開いてください。`,
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
