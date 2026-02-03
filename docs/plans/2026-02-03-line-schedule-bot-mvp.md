# LINE Schedule Bot - MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a minimal LINE bot that extracts schedule information from text messages using Gemini API and registers them to Google Calendar with OAuth authentication.

**Architecture:** Express TypeScript server receives LINE webhooks, checks user authentication status, extracts schedule info via Gemini API, and creates calendar events via Google Calendar API. Uses SQLite + Prisma for persistence.

**Tech Stack:** TypeScript, Express, Prisma (SQLite), LINE Messaging API, Google Calendar API (OAuth 2.0), Gemini 1.5 Flash API

---

## Task 1: Project Initialization and TypeScript Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/index.ts`

**Step 1: Initialize package.json**

```bash
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install express @line/bot-sdk @google-cloud/vertexai googleapis @prisma/client dotenv
npm install -D typescript @types/node @types/express ts-node-dev prisma
```

**Step 3: Create tsconfig.json**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 4: Create .gitignore**

Create `.gitignore`:
```
node_modules/
dist/
.env
*.db
*.db-journal
prisma/migrations/
```

**Step 5: Create .env.example**

Create `.env.example`:
```
DATABASE_URL="file:./dev.db"
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
GEMINI_API_KEY=your_gemini_api_key
ENCRYPTION_KEY=your_encryption_key_32_bytes
PORT=3000
```

**Step 6: Create basic Express server**

Create `src/index.ts`:
```typescript
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
```

**Step 7: Add scripts to package.json**

Modify `package.json` to add:
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Step 8: Test the server**

Run: `npm run dev`
Expected: Server starts on port 3000

Test health endpoint: `curl http://localhost:3000/health`
Expected: `{"status":"ok"}`

**Step 9: Commit**

```bash
git add .
git commit -m "feat: initialize TypeScript Express project"
```

---

## Task 2: Prisma Setup and Database Schema

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

**Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider sqlite
```

**Step 2: Define database schema**

Modify `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id                   String            @id @default(uuid())
  lineUserId           String            @unique
  googleAccessToken    String?
  googleRefreshToken   String?
  googleTokenExpiry    DateTime?
  googleCalendars      String?           // JSON string
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt
  pendingSchedules     PendingSchedule[]
  scheduleHistories    ScheduleHistory[]
}

model PendingSchedule {
  id              String            @id @default(uuid())
  userId          String
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  lineMessageId   String
  title           String
  description     String?
  startDateTime   DateTime
  endDateTime     DateTime?
  calendarId      String?
  status          ScheduleStatus    @default(PENDING)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  scheduleHistories ScheduleHistory[]

  @@index([userId])
  @@index([lineMessageId])
}

enum ScheduleStatus {
  PENDING
  REGISTERED
  SKIPPED
}

model ScheduleHistory {
  id              String           @id @default(uuid())
  userId          String
  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  scheduleId      String
  schedule        PendingSchedule  @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  action          HistoryAction
  calendarId      String?
  googleEventId   String?
  createdAt       DateTime         @default(now())

  @@index([userId])
  @@index([scheduleId])
}

enum HistoryAction {
  REGISTERED
  SKIPPED
}
```

**Step 3: Generate Prisma client**

```bash
npx prisma generate
```

**Step 4: Create initial migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration created and applied successfully

**Step 5: Create database utility**

Create `src/lib/db.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
```

**Step 6: Test database connection**

Add test endpoint to `src/index.ts`:
```typescript
import prisma from './lib/db';

app.get('/db-test', async (req, res) => {
  try {
    const count = await prisma.user.count();
    res.json({ status: 'ok', userCount: count });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
```

Run: `npm run dev`
Test: `curl http://localhost:3000/db-test`
Expected: `{"status":"ok","userCount":0}`

**Step 7: Commit**

```bash
git add .
git commit -m "feat: setup Prisma with SQLite schema"
```

---

## Task 3: Encryption Utilities

**Files:**
- Create: `src/lib/encryption.ts`
- Create: `src/lib/__tests__/encryption.test.ts`

**Step 1: Install test dependencies**

```bash
npm install -D jest @types/jest ts-jest
```

**Step 2: Configure Jest**

Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
```

Add test script to `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

**Step 3: Write failing test for encryption**

Create `src/lib/__tests__/encryption.test.ts`:
```typescript
import { encrypt, decrypt } from '../encryption';

describe('Encryption', () => {
  const testData = 'sensitive-token-data';

  it('should encrypt and decrypt data correctly', () => {
    const encrypted = encrypt(testData);
    expect(encrypted).not.toBe(testData);
    expect(encrypted).toContain(':'); // IV separator

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(testData);
  });

  it('should produce different encrypted values for same input', () => {
    const encrypted1 = encrypt(testData);
    const encrypted2 = encrypt(testData);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should throw error if encryption key is not set', () => {
    const originalKey = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;

    expect(() => encrypt(testData)).toThrow('ENCRYPTION_KEY is not set');

    process.env.ENCRYPTION_KEY = originalKey;
  });
});
```

**Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module '../encryption'"

**Step 5: Implement encryption utilities**

Create `src/lib/encryption.ts`:
```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is not set');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

**Step 6: Generate encryption key**

Run: `openssl rand -hex 32`
Copy the output and add to `.env`:
```
ENCRYPTION_KEY=<generated_key>
```

**Step 7: Run test to verify it passes**

Run: `npm test`
Expected: All tests PASS

**Step 8: Commit**

```bash
git add .
git commit -m "feat: add encryption utilities for token storage"
```

---

## Task 4: LINE Webhook Signature Verification

**Files:**
- Create: `src/middleware/lineSignature.ts`
- Create: `src/middleware/__tests__/lineSignature.test.ts`

**Step 1: Write failing test**

Create `src/middleware/__tests__/lineSignature.test.ts`:
```typescript
import { Request, Response } from 'express';
import { verifyLineSignature } from '../lineSignature';
import crypto from 'crypto';

describe('LINE Signature Verification', () => {
  const channelSecret = 'test-channel-secret';
  const originalEnv = process.env.LINE_CHANNEL_SECRET;

  beforeAll(() => {
    process.env.LINE_CHANNEL_SECRET = channelSecret;
  });

  afterAll(() => {
    process.env.LINE_CHANNEL_SECRET = originalEnv;
  });

  it('should pass verification with valid signature', () => {
    const body = JSON.stringify({ events: [] });
    const signature = crypto
      .createHmac('sha256', channelSecret)
      .update(body)
      .digest('base64');

    const req = {
      headers: { 'x-line-signature': signature },
      body: body,
    } as any as Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any as Response;

    const next = jest.fn();

    verifyLineSignature(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject request with invalid signature', () => {
    const body = JSON.stringify({ events: [] });

    const req = {
      headers: { 'x-line-signature': 'invalid-signature' },
      body: body,
    } as any as Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any as Response;

    const next = jest.fn();

    verifyLineSignature(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
  });

  it('should reject request without signature', () => {
    const req = {
      headers: {},
      body: JSON.stringify({ events: [] }),
    } as any as Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any as Response;

    const next = jest.fn();

    verifyLineSignature(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module '../lineSignature'"

**Step 3: Implement LINE signature verification**

Create `src/middleware/lineSignature.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function verifyLineSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const signature = req.headers['x-line-signature'] as string;

  if (!signature) {
    res.status(403).json({ error: 'No signature' });
    return;
  }

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    throw new Error('LINE_CHANNEL_SECRET is not set');
  }

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');

  if (hash !== signature) {
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  next();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add LINE webhook signature verification"
```

---

## Task 5: Google OAuth 2.0 Authentication Flow

**Files:**
- Create: `src/routes/auth.ts`
- Create: `src/lib/googleAuth.ts`
- Modify: `src/index.ts`

**Step 1: Create Google OAuth utility**

Create `src/lib/googleAuth.ts`:
```typescript
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth credentials are not configured');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(lineUserId: string): string {
  const oauth2Client = getOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: lineUserId, // Pass LINE User ID via state parameter
    prompt: 'consent', // Force consent screen to get refresh token
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getCalendarList(accessToken: string) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const response = await calendar.calendarList.list();

  return response.data.items || [];
}
```

**Step 2: Create auth routes**

Create `src/routes/auth.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { getAuthUrl, getTokensFromCode, getCalendarList } from '../lib/googleAuth';
import { encrypt } from '../lib/encryption';
import prisma from '../lib/db';

const router = Router();

// Start OAuth flow
router.get('/google', (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  if (!userId) {
    return res.status(400).send('Missing userId parameter');
  }

  const authUrl = getAuthUrl(userId);
  res.redirect(authUrl);
});

// OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string; // LINE User ID

    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter');
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return res.status(500).send('Failed to get tokens from Google');
    }

    // Encrypt tokens
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);

    // Get calendar list
    const calendars = await getCalendarList(tokens.access_token);

    // Save or update user
    await prisma.user.upsert({
      where: { lineUserId: state },
      update: {
        googleAccessToken: encryptedAccessToken,
        googleRefreshToken: encryptedRefreshToken,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleCalendars: JSON.stringify(calendars),
      },
      create: {
        lineUserId: state,
        googleAccessToken: encryptedAccessToken,
        googleRefreshToken: encryptedRefreshToken,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleCalendars: JSON.stringify(calendars),
      },
    });

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>認証完了</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; }
            .success { color: #00B900; font-size: 48px; margin-bottom: 20px; }
            h1 { color: #333; }
            p { color: #666; font-size: 18px; }
          </style>
        </head>
        <body>
          <div class="success">✓</div>
          <h1>認証が完了しました</h1>
          <p>LINEでメッセージを送ってください</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('認証に失敗しました');
  }
});

export default router;
```

**Step 3: Mount auth routes in main app**

Modify `src/index.ts`:
```typescript
import authRoutes from './routes/auth';

// Add before app.listen()
app.use('/auth', authRoutes);
```

**Step 4: Test OAuth flow manually**

Run: `npm run dev`

Visit: `http://localhost:3000/auth/google?userId=test-user-123`

Expected: Redirects to Google OAuth consent screen

After approval: Redirects to callback with success message

Check database: `npx prisma studio`
Expected: User record with encrypted tokens

**Step 5: Commit**

```bash
git add .
git commit -m "feat: implement Google OAuth 2.0 authentication flow"
```

---

## Task 6: Gemini API Schedule Extraction

**Files:**
- Create: `src/lib/gemini.ts`
- Create: `src/lib/__tests__/gemini.test.ts`

**Step 1: Write failing test**

Create `src/lib/__tests__/gemini.test.ts`:
```typescript
import { extractSchedules } from '../gemini';

describe('Gemini Schedule Extraction', () => {
  it('should extract schedule from simple text', async () => {
    const message = '明日15時に会議があります';
    const result = await extractSchedules(message);

    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0].title).toContain('会議');
    expect(result.schedules[0].startDateTime).toBeDefined();
  }, 15000); // 15 second timeout for API call

  it('should return empty array for non-schedule text', async () => {
    const message = 'おはようございます';
    const result = await extractSchedules(message);

    expect(result.schedules).toHaveLength(0);
  }, 15000);

  it('should extract multiple schedules', async () => {
    const message = '明日15時に会議、明後日10時に歯医者';
    const result = await extractSchedules(message);

    expect(result.schedules.length).toBeGreaterThanOrEqual(2);
  }, 15000);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module '../gemini'"

**Step 3: Install Gemini SDK**

```bash
npm install @google/generative-ai
```

**Step 4: Implement Gemini extraction**

Create `src/lib/gemini.ts`:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface Schedule {
  title: string;
  description?: string;
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
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const currentTime = new Date().toISOString();

  const prompt = `以下のメッセージからスケジュール情報を抽出してください。
複数のスケジュールがある場合はすべて抽出してください。

抽出するフォーマット（JSON）：
{
  "schedules": [
    {
      "title": "会議",
      "description": "営業チームとの打ち合わせ",
      "startDateTime": "2026-02-04T15:00:00+09:00",
      "endDateTime": "2026-02-04T16:00:00+09:00"
    }
  ]
}

注意事項：
- 日時が曖昧な場合は推測して補完してください（「明日」→ 具体的な日付）
- 終了時刻がない場合は開始時刻の1時間後を設定
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
```

**Step 5: Run test to verify it passes**

Add `.env` with real GEMINI_API_KEY

Run: `npm test -- gemini.test.ts`
Expected: Tests PASS (may take 10-15 seconds)

**Step 6: Commit**

```bash
git add .
git commit -m "feat: implement Gemini API schedule extraction"
```

---

## Task 7: LINE Webhook Handler

**Files:**
- Create: `src/routes/webhook.ts`
- Create: `src/lib/lineClient.ts`
- Modify: `src/index.ts`

**Step 1: Create LINE client utility**

Create `src/lib/lineClient.ts`:
```typescript
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
```

**Step 2: Create webhook route**

Create `src/routes/webhook.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { WebhookEvent, MessageEvent, TextEventMessage } from '@line/bot-sdk';
import { verifyLineSignature } from '../middleware/lineSignature';
import { lineClient, createAuthMessage, createScheduleNotFoundMessage, createErrorMessage } from '../lib/lineClient';
import { extractSchedules } from '../lib/gemini';
import prisma from '../lib/db';

const router = Router();

router.post('/', verifyLineSignature, async (req: Request, res: Response) => {
  try {
    const events: WebhookEvent[] = req.body.events;

    await Promise.all(
      events.map(async (event) => {
        if (event.type === 'message' && event.message.type === 'text') {
          await handleTextMessage(event);
        }
      })
    );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

async function handleTextMessage(event: MessageEvent) {
  const userId = event.source.userId;
  if (!userId) return;

  const message = (event.message as TextEventMessage).text;

  try {
    // Check if user is authenticated
    const user = await prisma.user.findUnique({
      where: { lineUserId: userId },
    });

    if (!user || !user.googleAccessToken) {
      // User not authenticated - send auth message
      await lineClient.replyMessage(event.replyToken, createAuthMessage(userId));
      return;
    }

    // User is authenticated - extract schedules
    const result = await extractSchedules(message);

    if (result.schedules.length === 0) {
      await lineClient.replyMessage(event.replyToken, createScheduleNotFoundMessage());
      return;
    }

    // Save pending schedules to database
    const lineMessageId = event.message.id;
    await Promise.all(
      result.schedules.map((schedule) =>
        prisma.pendingSchedule.create({
          data: {
            userId: user.id,
            lineMessageId,
            title: schedule.title,
            description: schedule.description,
            startDateTime: new Date(schedule.startDateTime),
            endDateTime: schedule.endDateTime ? new Date(schedule.endDateTime) : null,
            status: 'PENDING',
          },
        })
      )
    );

    // For MVP: send simple confirmation message
    // TODO: Replace with Flex Message carousel in Phase 2
    const confirmationText = result.schedules
      .map(
        (s, i) =>
          `【スケジュール ${i + 1}】\n` +
          `タイトル: ${s.title}\n` +
          `開始: ${new Date(s.startDateTime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}\n` +
          `終了: ${s.endDateTime ? new Date(s.endDateTime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '未設定'}`
      )
      .join('\n\n');

    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: `以下のスケジュールを抽出しました：\n\n${confirmationText}\n\n（MVP版では自動登録機能は未実装です）`,
    });
  } catch (error) {
    console.error('Error handling text message:', error);
    await lineClient.replyMessage(event.replyToken, createErrorMessage());
  }
}

export default router;
```

**Step 3: Mount webhook route**

Modify `src/index.ts`:
```typescript
import webhookRoutes from './routes/webhook';

// Add before app.use('/auth', authRoutes)
app.use('/webhook', webhookRoutes);
```

**Step 4: Test webhook with ngrok**

Terminal 1:
```bash
npm run dev
```

Terminal 2:
```bash
ngrok http 3000
```

- Copy ngrok URL (e.g., `https://xxxx.ngrok.io`)
- Go to LINE Developers Console
- Set Webhook URL to `https://xxxx.ngrok.io/webhook`
- Enable webhook
- Send message from LINE app

Expected behavior:
- Unauthenticated user: Receives auth link
- Authenticated user with schedule text: Receives extracted schedule
- Authenticated user with non-schedule text: Receives "not found" message

**Step 5: Commit**

```bash
git add .
git commit -m "feat: implement LINE webhook handler with Gemini integration"
```

---

## Task 8: Railway Deployment Configuration

**Files:**
- Create: `railway.json`
- Create: `Dockerfile` (optional)
- Modify: `package.json`

**Step 1: Update package.json for production**

Modify `package.json`:
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "prisma generate && tsc",
    "start": "prisma migrate deploy && node dist/index.js",
    "postinstall": "prisma generate"
  }
}
```

**Step 2: Create railway.json**

Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Step 3: Create .env.production.example**

Create `.env.production.example`:
```
DATABASE_URL=file:/data/prod.db
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/google/callback
GEMINI_API_KEY=
ENCRYPTION_KEY=
PORT=3000
NODE_ENV=production
```

**Step 4: Add deployment documentation**

Create `docs/DEPLOYMENT.md`:
```markdown
# Deployment Guide

## Railway Deployment

### 1. Create Railway Project

1. Go to [Railway](https://railway.app/)
2. Create new project
3. Connect GitHub repository

### 2. Configure Environment Variables

Add the following environment variables in Railway dashboard:

- `DATABASE_URL=file:/data/prod.db`
- `LINE_CHANNEL_SECRET=<your_value>`
- `LINE_CHANNEL_ACCESS_TOKEN=<your_value>`
- `GOOGLE_CLIENT_ID=<your_value>`
- `GOOGLE_CLIENT_SECRET=<your_value>`
- `GOOGLE_REDIRECT_URI=https://<your-app>.railway.app/auth/google/callback`
- `GEMINI_API_KEY=<your_value>`
- `ENCRYPTION_KEY=<generated_with_openssl_rand>`
- `NODE_ENV=production`

### 3. Setup Volume for SQLite

1. Go to your Railway service settings
2. Add a Volume
3. Mount path: `/data`
4. This will persist your SQLite database

### 4. Update LINE Webhook URL

1. Get your Railway deployment URL
2. Go to LINE Developers Console
3. Update Webhook URL to: `https://<your-app>.railway.app/webhook`
4. Enable webhook

### 5. Update Google OAuth Redirect URI

1. Go to Google Cloud Console
2. Add authorized redirect URI: `https://<your-app>.railway.app/auth/google/callback`

### 6. Deploy

Railway will automatically deploy on git push to main branch.

Check logs to verify deployment:
```bash
railway logs
```

### Testing Production

1. Send message to LINE bot
2. If unauthenticated, click auth link
3. Complete Google OAuth
4. Send schedule message
5. Verify extraction works
```

**Step 5: Test build locally**

```bash
npm run build
```

Expected: `dist/` directory created with compiled JS files

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add Railway deployment configuration"
```

---

## Phase 1 MVP Complete!

**What works:**
- ✅ TypeScript Express server
- ✅ Prisma + SQLite database
- ✅ LINE webhook with signature verification
- ✅ Google OAuth 2.0 authentication
- ✅ Gemini API schedule extraction
- ✅ Basic text-based confirmation (no UI)
- ✅ Railway deployment ready

**What's NOT implemented yet (Phase 2):**
- ❌ Flex Message carousel UI
- ❌ Calendar selection functionality
- ❌ Actual Google Calendar registration
- ❌ Image/photo schedule extraction
- ❌ Postback handling for buttons

**Next Steps:**

Run the verification tests:
```bash
npm test
npm run build
```

If all pass, deploy to Railway and test end-to-end.

---

## Testing Checklist

**Local Testing:**
- [ ] Health check endpoint works
- [ ] Database connection works
- [ ] All unit tests pass
- [ ] Build succeeds
- [ ] Webhook receives LINE messages via ngrok
- [ ] Unauthenticated user gets auth link
- [ ] OAuth flow completes successfully
- [ ] Authenticated user can send messages
- [ ] Schedule extraction works with Gemini
- [ ] Pending schedules saved to database

**Production Testing (Railway):**
- [ ] Deployment succeeds
- [ ] Environment variables configured
- [ ] Volume mounted for SQLite
- [ ] Health check responds
- [ ] LINE webhook configured
- [ ] End-to-end flow works
- [ ] Database persists after restart
