import { extractSchedules } from '../gemini';

describe('Gemini Schedule Extraction', () => {
  const isApiKeyConfigured = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';

  beforeAll(() => {
    if (!isApiKeyConfigured) {
      console.warn('⚠️  GEMINI_API_KEY is not configured. Tests will be skipped.');
      console.warn('   Get your API key from: https://aistudio.google.com/app/apikey');
    }
  });

  it('should extract schedule from simple text', async () => {
    if (!isApiKeyConfigured) {
      console.log('⏭️  Skipping test: GEMINI_API_KEY not configured');
      return;
    }

    const message = '明日15時に会議があります';
    const result = await extractSchedules(message);

    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0].title).toContain('会議');
    expect(result.schedules[0].startDateTime).toBeDefined();
  }, 15000); // 15 second timeout for API call

  it('should return empty array for non-schedule text', async () => {
    if (!isApiKeyConfigured) {
      console.log('⏭️  Skipping test: GEMINI_API_KEY not configured');
      return;
    }

    const message = 'おはようございます';
    const result = await extractSchedules(message);

    expect(result.schedules).toHaveLength(0);
  }, 15000);

  it('should extract multiple schedules', async () => {
    if (!isApiKeyConfigured) {
      console.log('⏭️  Skipping test: GEMINI_API_KEY not configured');
      return;
    }

    const message = '明日15時に会議、明後日10時に歯医者';
    const result = await extractSchedules(message);

    expect(result.schedules.length).toBeGreaterThanOrEqual(2);
  }, 15000);
});
