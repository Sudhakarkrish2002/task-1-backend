const express = require('express');
const { getConnectionStatus } = require('../config/database');
const { verifyEmailConfig } = require('../config/email');
const logger = require('../utils/logger');

const router = express.Router();

// Basic health check
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Dashboard Backend is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    const dbStatus = getConnectionStatus();
    const emailStatus = await verifyEmailConfig();
    
    const health = {
      success: true,
      message: 'Detailed health check completed',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus.connected ? 'healthy' : 'unhealthy',
          type: dbStatus.type,
          connected: dbStatus.connected
        },
        email: {
          status: emailStatus ? 'healthy' : 'unhealthy',
          configured: emailStatus
        },
        server: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        }
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV || 'development'
      }
    };

    // Determine overall health
    const allHealthy = health.services.database.status === 'healthy' && 
                      health.services.email.status === 'healthy' && 
                      health.services.server.status === 'healthy';

    res.status(allHealthy ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;























