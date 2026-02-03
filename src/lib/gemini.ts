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

export async function extractSchedules(message: string): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const currentTime = new Date().toISOString();

  const prompt = `以下のメッセージからスケジュール情報を抽出してください。
複数のスケジュールがある場合はすべて抽出してください。

抽出するフォーマット（JSON）：
{
  "schedules": [
    {
      "title": "会議",
      "description": "営業チームとの打ち合わせ",
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
- 現在時刻: ${currentTime}
- タイムゾーン: Asia/Tokyo (+09:00)

メッセージ: ${message}

JSONのみを返してください。説明文は不要です。`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Extract JSON from response (remove markdown code blocks if present)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { schedules: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as ExtractionResult;
  } catch (error) {
    console.error('Gemini API error:', error);
    return { schedules: [] };
  }
}
