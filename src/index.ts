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
