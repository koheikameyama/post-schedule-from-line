import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import prisma from './lib/db';
import webhookRoutes from './routes/webhook';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Serve static files from public directory
app.use(express.static('public'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/liff-auth.html', (req: Request, res: Response) => {
  const liffId = process.env.LIFF_ID || '';
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Google カレンダー連携</title>
  <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 16px;
    }
    p {
      color: #666;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    button {
      background: #06C755;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      width: 100%;
    }
    button:hover {
      background: #05B04D;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .status {
      margin-top: 16px;
      padding: 12px;
      border-radius: 4px;
      text-align: center;
    }
    .status.loading {
      background: #e3f2fd;
      color: #1976d2;
    }
    .status.success {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .status.error {
      background: #ffebee;
      color: #c62828;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Google カレンダー連携</h1>
    <p>スケジュール管理BOTを使うには、Googleカレンダーとの連携が必要です。</p>
    <button id="authButton" onclick="startAuth()">Google認証を開始</button>
    <div id="status" class="status" style="display:none;"></div>
  </div>

  <script>
    const LIFF_ID = '${liffId}';
    let userId = '';

    async function initializeLiff() {
      try {
        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        userId = profile.userId;

        showStatus('LINE認証完了', 'success');
      } catch (error) {
        console.error('LIFF initialization failed', error);
        showStatus('LINEログインに失敗しました: ' + error.message, 'error');
      }
    }

    async function startAuth() {
      try {
        showStatus('Google認証を開始しています...', 'loading');
        document.getElementById('authButton').disabled = true;

        const baseUrl = window.location.origin;
        const authUrl = \`\${baseUrl}/auth/google?userId=\${encodeURIComponent(userId)}\`;

        liff.openWindow({
          url: authUrl,
          external: true
        });

        showStatus('外部ブラウザでGoogle認証を完了してください', 'loading');

        setTimeout(() => {
          liff.closeWindow();
        }, 2000);
      } catch (error) {
        console.error('Auth failed', error);
        showStatus('認証に失敗しました: ' + error.message, 'error');
        document.getElementById('authButton').disabled = false;
      }
    }

    function showStatus(message, type) {
      const statusEl = document.getElementById('status');
      statusEl.textContent = message;
      statusEl.className = 'status ' + type;
      statusEl.style.display = 'block';
    }

    window.addEventListener('load', initializeLiff);
  </script>
</body>
</html>`;
  res.send(html);
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/db-test', async (req: Request, res: Response) => {
  try {
    const count = await prisma.user.count();
    res.json({ status: 'ok', userCount: count });
  } catch (error) {
    res.status(500).json({ status: 'error', message: (error as Error).message });
  }
});

// Mount webhook routes
app.use('/webhook', webhookRoutes);

// Mount auth routes
app.use('/auth', authRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
