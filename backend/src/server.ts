import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { logger } from './utils/logger';
import { closeBrowser } from './modules/sale-orders/pdf-generator';

async function bootstrap() {
  // Verify DB connection before starting server
  try {
    await prisma.$connect();
    logger.success('Database connected');
  } catch (err) {
    logger.error('Database connection failed', err);
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.success(`Server running at http://localhost:${env.PORT}${env.API_PREFIX}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Health check: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
  });

  const shutdown = async (signal: string) => {
    logger.warn(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      try {
        await closeBrowser();
        await prisma.$disconnect();
        logger.success('Server closed');
        process.exit(0);
      } catch (err) {
        logger.error('Shutdown error', err);
        process.exit(1);
      }
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Force shutdown after 10s');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
  });
}

bootstrap();
