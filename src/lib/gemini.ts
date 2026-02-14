import { GoogleGenerativeAI } from '@google/generative-ai';

export interface Schedule {
  title: string;
  description?: string;
  location?: string;
  startDateTime: string; // ISO 8601 format
  endDateTime?: string; // ISO 8601 format
}

export interface ExtractionResult {
  schedules: Schedule[];
}

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

function getScheduleExtractionPrompt(source: string): string {
  const currentTime = new Date().toISOString();

  return `以下の${source}からスケジュール情報を抽出してください。
複数のスケジュールがある場合はすべて抽出してください。

抽出するフォーマット（JSON）：
{
  "schedules": [
    {
      "title": "会議",
      "description": "営業チームとの打ち合わせ\n持ち物: 企画書、見積もり\n参加者: 田中、鈴木",
      "location": "会議室A",
      "startDateTime": "2026-02-04T15:00:00+09:00",
      "endDateTime": "2026-02-04T16:00:00+09:00"
    }
  ]
}

注意事項：
- 日時が曖昧な場合は推測して補完してください（「明日」→ 具体的な日付）
- 終了時刻がない場合は開始時刻の1時間後を設定
- 場所が含まれている場合は location フィールドに含めてください（例: 「渋谷で」→ "location": "渋谷"）
- 場所がない場合は location フィールドを省略してください
- スケジュール情報が全く含まれていない場合は、空の配列を返してください
- description には、カレンダーのメモとして残すべき情報をできるだけ含めてください。例:
  - 持ち物・準備するもの
  - 参加者・相手の名前
  - URL・リンク
  - 注意事項・補足情報
  - 費用・料金
  - 予約番号・確認番号
  - その他、後から見返した時に役立つ情報
- title や location に含まれない情報で、メモとして有用なものはすべて description に記載してください
- 現在時刻: ${currentTime}
- タイムゾーン: Asia/Tokyo (+09:00)

JSONのみを返してください。説明文は不要です。`;
}

function parseScheduleResponse(text: string): ExtractionResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { schedules: [] };
  }
  return JSON.parse(jsonMatch[0]) as ExtractionResult;
}

export async function extractSchedules(message: string): Promise<ExtractionResult> {
  const model = getGeminiModel();
  const prompt = getScheduleExtractionPrompt('メッセージ') + `\n\nメッセージ: ${message}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    return parseScheduleResponse(text);
  } catch (error) {
    console.error('Gemini API error:', error);
    return { schedules: [] };
  }
}

export async function extractSchedulesFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  const model = getGeminiModel();
  const prompt = getScheduleExtractionPrompt('画像');

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType,
        },
      },
    ]);
    const response = result.response;
    const text = response.text();
    return parseScheduleResponse(text);
  } catch (error) {
    console.error('Gemini API error (image):', error);
    return { schedules: [] };
  }
}
