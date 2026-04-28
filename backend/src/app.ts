import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env, isDev } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import routes from './routes';

export function createApp(): Express {
  const app = express();

  // Trust proxy (needed when running behind Render/nginx)
  app.set('trust proxy', 1);

  // Security
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow non-browser requests (mobile apps, curl) and whitelist
        if (!origin || allowedOrigins.includes(origin)) {
          cb(null, true);
        } else {
          cb(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
    }),
  );

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging
  app.use(morgan(isDev ? 'dev' : 'combined'));

  // Global rate limit
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Static for uploaded files
  app.use('/uploads', express.static(env.UPLOAD_DIR));

  // Routes
  app.use(env.API_PREFIX, routes);

  // 404 + error handlers (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
