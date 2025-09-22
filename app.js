const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./src/routes/auth');
const healthRoutes = require('./src/routes/health');
const dashboardRoutes = require('./src/routes/dashboard');
const mqttRoutes = require('./src/routes/mqtt');
const mqttService = require('./src/services/mqttService');

// Import middleware
const errorHandler = require('./src/middleware/errorHandler');
const notFound = require('./src/middleware/notFound');
const logger = require('./src/utils/logger');

// Import config
const { verifyEmailConfig } = require('./src/config/email');
const wsService = require('./src/services/wsService');

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 900 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Static files
app.use('/uploads', express.static('public/uploads'));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/mqtt', mqttRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Dashboard Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      health: '/api/health',
      documentation: '/api/docs'
    }
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    message: 'API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/request-reset': 'Request password reset',
        'POST /api/auth/reset-password': 'Reset password with token',
        'GET /api/auth/validate-reset-token': 'Validate reset token',
        'GET /api/auth/health': 'Auth service health check'
      },
      health: {
        'GET /api/health': 'General health check',
        'GET /api/health/detailed': 'Detailed system health'
      }
    },
    examples: {
      requestReset: {
        method: 'POST',
        url: '/api/auth/request-reset',
        body: { email: 'user@example.com' }
      },
      resetPassword: {
        method: 'POST',
        url: '/api/auth/reset-password',
        body: {
          token: 'reset_token_here',
          email: 'user@example.com',
          newPassword: 'new_password_here'
        }
      }
    }
  });
});

// 404 handler
app.use(notFound);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Verify email configuration
    logger.info('Verifying email configuration...');
    const emailReady = await verifyEmailConfig();
    if (!emailReady) {
      logger.warn('Email service not configured. Password reset emails will not work.');
      logger.warn('Please configure your email settings in the .env file.');
    } else {
      logger.info('Email service is ready.');
    }

    // Init WebSocket server on same HTTP server
    wsService.init(server);

    server.listen(PORT, () => {
      logger.info(`🚀 IoT Dashboard Backend Server running on port ${PORT}`);
      logger.info(`📧 Email service: ${emailReady ? 'Ready' : 'Not configured'}`);
      logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`\n📋 Available endpoints:`);
      logger.info(`   GET  / - API information`);
      logger.info(`   GET  /api/docs - API documentation`);
      logger.info(`   POST /api/auth/request-reset - Request password reset`);
      logger.info(`   POST /api/auth/reset-password - Reset password with token`);                                                                              
      logger.info(`   GET  /api/auth/validate-reset-token - Validate reset token`);                                                                             
      logger.info(`   POST /api/dashboard/save - Save dashboard`);
      logger.info(`   PUT  /api/dashboard/update/:id - Update dashboard`);
      logger.info(`   POST /api/dashboard/publish - Publish dashboard`);
      logger.info(`   GET  /api/dashboard/shared/:id - Get shared dashboard`);
      logger.info(`   GET  /api/dashboard/user/:userId - Get user dashboards`);
      logger.info(`   DELETE /api/dashboard/:id - Delete dashboard`);
      logger.info(`   GET  /api/health - Health check`);
      logger.info(`   GET  /api/mqtt/health - MQTT health`);
      logger.info(`   GET  /api/mqtt/topics - MQTT known topics`);
      logger.info(`   GET  /api/mqtt/latest?topic=... - Latest message for topic`);
      logger.info(`   POST /api/mqtt/publish - Publish message to topic`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  logger.error('Error stack:', error.stack);
  logger.error('Error message:', error.message);
  logger.error('Error name:', error.name);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;

