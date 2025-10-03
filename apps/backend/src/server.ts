import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import winston from 'winston';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import gameRoutes from './routes/games';
import tournamentRoutes from './routes/tournaments';
import adminRoutes from './routes/admin';
import healthRoutes from './routes/health';

// Import socket handlers
import { setupSocketHandlers } from './socket/socketHandlers';
import { setSocketServer } from './utils/socketEmitter';

// Import services
import { getRedisService } from './services/redisService';
import { gameStateManager } from './services/gameStateManager';
import { rateLimitService } from './services/rateLimitService';
import { cacheInvalidationService } from './services/cacheInvalidationService';
import { monitoringService } from './services/monitoringService';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { requestMetricsMiddleware, errorTrackingMiddleware } from './middleware/monitoring';

// Load environment variables - try multiple paths for deployment compatibility
dotenv.config(); // First try default .env locations
dotenv.config({ path: '.env' }); // Try root .env
dotenv.config({ path: path.join(__dirname, '../.env') }); // Try relative to dist

// Create Express app
const app = express();
const server = createServer(app);

// Define a comprehensive list of allowed origins for both development and production.
// These arrays include the local development URLs, the hosted frontends on Render, and
// the special origins used by Capacitor and local dev servers on mobile devices. Without
// explicitly listing these, the browser or mobile webview will block responses due to
// missing CORS headers, causing network requests to fail with status 0.
const allowedOriginsDev: string[] = [
  'http://localhost:3000',
  'http://192.168.1.114:3000',
  'https://playbg-frontend-dev.onrender.com',
  'https://playbg-backend-dev.onrender.com',
  // Allow internal mobile origins for Capacitor/Android dev builds
  'capacitor://localhost',
  'capacitor://localhost:3000', // Additional Capacitor origin
  'http://localhost',
  'https://localhost',
  // Android WebView origins
  'file://', // For local file access in Android WebView
  'http://10.0.2.2:3000', // Android emulator localhost
  process.env.FRONTEND_URL || 'http://localhost:3000'
];

const allowedOriginsProd: string[] = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://playbg-frontend-dev.onrender.com',
  'https://playbg-frontend-prod.onrender.com',
  'https://playbg-backend-dev.onrender.com',
  'https://playbg-backend-prod.onrender.com',
  'capacitor://localhost',
  'capacitor://localhost:3000',
  'http://localhost',
  'https://localhost',
  // Production mobile origins
  'file://',
  'http://10.0.2.2:3000'
];

// Setup Socket.IO with proper timeout and connection settings
const io = new SocketIOServer(server, {
  cors: {
    // Use combined origins to handle environment detection issues
    origin: [...new Set([...allowedOriginsDev, ...allowedOriginsProd])],
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Connection settings to prevent premature disconnections
  // Must handle browser tab backgrounding - browsers throttle timers/network in background tabs
  pingTimeout: 90000, // 90 seconds - if no pong in 90s, consider connection dead (allows for browser throttling)
  pingInterval: 30000, // 30 seconds - server sends ping every 30s (must be < pingTimeout)
  upgradeTimeout: 60000, // 60 seconds - increased time to wait for transport upgrade
  maxHttpBufferSize: 1e6, // 1MB - max message size
  transports: ['websocket', 'polling'], // Allow both transports
  allowUpgrades: true, // Allow transport upgrades
  perMessageDeflate: false, // Disable compression for better performance
  httpCompression: true, // Enable HTTP compression
  connectTimeout: 60000, // 60 seconds - connection timeout (increased)
  // Allow EIO v3 for better compatibility
  allowEIO3: true
});

// Setup logging - production-friendly configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'playbg-backend' },
  transports: [
    // In production, log to console instead of files for better cloud deployment support
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
});

// Additional console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware - Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: process.env.NODE_ENV === 'development'
        ? [
          "'self'",
          'http://localhost:3000',
          'http://192.168.1.114:3000',
          'https://playbg-frontend-dev.onrender.com',
          'https://playbg-backend-dev.onrender.com',
          'https://playbg-backend-prod.onrender.com',
          'capacitor://localhost',
          'http://localhost',
          'https://localhost'
        ]
        : [
          "'self'",
          process.env.FRONTEND_URL || 'http://localhost:3000',
          'https://playbg-frontend-dev.onrender.com',
          'https://playbg-frontend-prod.onrender.com',
          'https://playbg-backend-dev.onrender.com',
          'https://playbg-backend-prod.onrender.com',
          'capacitor://localhost',
          'http://localhost',
          'https://localhost'
        ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS configuration - Enhanced for cold start reliability
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Combine both dev and prod origins to be more permissive in cloud deployments
    // This fixes issues where NODE_ENV might not be set correctly on Render
    const allowedOrigins = [...new Set([...allowedOriginsDev, ...allowedOriginsProd])];

    // Don't log during health checks to reduce noise
    if (!origin?.includes('health')) {
      logger.info(`CORS check for origin: ${origin}, environment: ${process.env.NODE_ENV}`);
    }

    if (allowedOrigins.includes(origin)) {
      if (!origin?.includes('health')) {
        logger.info(`CORS allowing origin: ${origin}`);
      }
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      // Allow during cold start to prevent service disruption
      if (process.uptime() < 30) {
        logger.warn(`Allowing origin during cold start: ${origin}`);
        callback(null, true);
      } else {
        callback(null, false);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-HTTP-Method-Override',
    'X-Forwarded-For',
    'X-Real-IP'
  ],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400 // Cache preflight for 24 hours
}));

// Explicit OPTIONS handler for preflight requests during cold starts
app.options('*', (req, res) => {
  const origin = req.get('Origin');
  const allowedOrigins = [...new Set([...allowedOriginsDev, ...allowedOriginsProd])];

  // Set CORS headers explicitly
  if (!origin || allowedOrigins.includes(origin) || process.uptime() < 30) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-HTTP-Method-Override, X-Forwarded-For, X-Real-IP');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
  }

  res.status(204).send();
});



app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add monitoring middleware
app.use(requestMetricsMiddleware);

// Request logging (excluding frequent health checks)
app.use((req, res, next) => {
  // Don't log health checks to reduce noise (they happen every 5s from load balancers)
  if (!req.path.startsWith('/health')) {
    logger.info(`${req.method} ${req.path} - ${req.ip}`);
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    }
  });
});

// Rate limit stats endpoint (for monitoring)
app.get('/api/admin/rate-limit-stats/:userId/:action?', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin (you would implement proper admin check)
    const { userId, action } = req.params;

    if (action) {
      const stats = await rateLimitService.getStats(userId, action);
      res.json({
        success: true,
        data: stats
      });
    } else {
      // Return general info for monitoring
      res.json({
        success: true,
        message: 'Rate limiting active',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Rate limit stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limit stats'
    });
  }
});

// API Routes with rate limiting
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, rateLimitService.createExpressMiddleware('api:general'), userRoutes);
app.use('/api/games', authMiddleware, rateLimitService.createExpressMiddleware('api:general'), gameRoutes);
app.use('/api/tournaments', authMiddleware, rateLimitService.createExpressMiddleware('api:general'), tournamentRoutes);
app.use('/api/admin', authMiddleware, rateLimitService.createExpressMiddleware('api:general'), adminRoutes);
app.use('/health', healthRoutes);

// Setup Socket.IO handlers
setSocketServer(io);
setupSocketHandlers(io);

// Error handling middleware
app.use(errorTrackingMiddleware);
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/playbg';
    await mongoose.connect(mongoURI);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Redis connection - optional for deployment flexibility
const connectRedis = async () => {
  try {
    // Skip Redis if REDIS_URL is not provided
    if (!process.env.REDIS_URL) {
      logger.warn('REDIS_URL not configured - running without Redis cache');
      return;
    }

    await getRedisService().connect();
    logger.info('Redis connected successfully');

    // Setup Redis Pub/Sub to broadcast events across instances
    setupRedisPubSub(io);

  } catch (error) {
    logger.error('Redis connection error:', error);
    logger.warn('Continuing without Redis - some features may be limited');
    // Don't exit on Redis failure - app can work without it but with limited functionality
  }
};

// Setup Redis Pub/Sub listener
const setupRedisPubSub = (io: SocketIOServer) => {
  const redisService = getRedisService();
  const eventEmitter = redisService.getEventEmitter();

  eventEmitter.on('game-event', ({ channel, event, data }) => {
    const gameId = channel.split(':')[2];
    if (gameId) {
      const room = `game:${gameId}`;
      io.to(room).emit(`game:${event}`, data);
      logger.info(`Broadcasted Redis event '${event}' to room '${room}'`);
    }
  });

  redisService.subscribeToGameEvents().catch(err => {
    logger.error('Failed to subscribe to Redis game events:', err);
  });
};

// Cleanup task for inactive games and rate limits (runs every 30 minutes)
const setupCleanupTasks = () => {
  setInterval(async () => {
    try {
      await gameStateManager.cleanupInactiveGames(60); // Clean games inactive for 60+ minutes

      // Only attempt Redis cleanup if Redis is available
      if (process.env.REDIS_URL) {
        try {
          await getRedisService().cleanupExpiredSessions();
        } catch (redisError) {
          logger.warn('Redis cleanup failed:', redisError);
        }
      }

      await rateLimitService.cleanup(); // Clean expired rate limit data
    } catch (error) {
      logger.error('Cleanup task error:', error);
    }
  }, 30 * 60 * 1000); // 30 minutes
};

// Start server
const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    // Connect to databases
    await connectDB();
    await connectRedis();

    // Setup cleanup tasks
    setupCleanupTasks();

    // Initialize cache warming
    await cacheInvalidationService.schedulePeriodicWarming();

    // Warm initial caches
    setTimeout(() => {
      cacheInvalidationService.warmAllCaches().catch(error => {
        logger.error('Initial cache warming failed:', error);
      });
    }, 15000); // Wait 15 seconds after startup for proper initialization

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Active games: ${gameStateManager.getActiveGamesCount()}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    logger.info('Shutting down gracefully...');

    // Close server
    server.close();

    // Disconnect from databases
    await mongoose.connection.close();
    await getRedisService().disconnect();

    logger.info('Process terminated');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

startServer();

export { app, io, logger };
