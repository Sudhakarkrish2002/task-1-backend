const express = require('express');
const Joi = require('joi');
const { getStorage } = require('../config/database');
const logger = require('../utils/logger');
const { generateTopicId, validateTopicId, getTopicIdStats } = require('../utils/topicIdGenerator');

const router = express.Router();

// Get in-memory storage
const storage = getStorage();

// Validation schemas
const saveDashboardSchema = Joi.object({
  id: Joi.string().optional(),
  name: Joi.string().required().messages({
    'any.required': 'Dashboard name is required'
  }),
  widgets: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      type: Joi.string().required(),
      title: Joi.string().optional(),
      x: Joi.number().required(),
      y: Joi.number().required(),
      w: Joi.number().required(),
      h: Joi.number().required(),
      data: Joi.object().optional(),
      config: Joi.object().optional()
    })
  ).required(),
  layout: Joi.object().optional(),
  deviceCount: Joi.number().optional(),
  stats: Joi.object().optional()
});

const publishDashboardSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  widgets: Joi.array().required(),
  layout: Joi.object().optional(),
  // Accept "layouts" from frontend and normalize later
  layouts: Joi.object().optional(),
  deviceCount: Joi.number().optional(),
  stats: Joi.object().optional(),
  isPublished: Joi.boolean().optional(),
  shareableLink: Joi.string().optional(),
  sharePassword: Joi.string().optional(),
  shareableId: Joi.string().optional()
});

// Save dashboard
router.post('/save', async (req, res) => {
  try {
    logger.info('Dashboard save request received:', { 
      userId: req.user?.id || 'anonymous',
      dashboardName: req.body.name,
      widgetCount: req.body.widgets?.length || 0
    });

    // Validate request body
    const { error, value } = saveDashboardSchema.validate(req.body);
    if (error) {
      logger.warn('Validation error:', error.details[0].message);
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const dashboardData = value;
    const userId = req.user?.id || 'anonymous';
    
    // Generate unique 15-digit topic ID if not provided
    if (!dashboardData.id) {
      dashboardData.id = generateTopicId();
      logger.info('Generated new topic ID:', { topicId: dashboardData.id });
    } else {
      // Validate existing ID format
      if (!validateTopicId(dashboardData.id)) {
        logger.warn('Invalid topic ID format provided, generating new one:', { providedId: dashboardData.id });
        dashboardData.id = generateTopicId();
        logger.info('Generated replacement topic ID:', { topicId: dashboardData.id });
      }
    }

    // Add metadata
    const dashboard = {
      ...dashboardData,
      userId: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublished: false
    };

    // Store dashboard
    storage.dashboards.set(dashboard.id, dashboard);

    logger.info('Dashboard saved successfully:', { 
      dashboardId: dashboard.id,
      userId: userId,
      widgetCount: dashboard.widgets.length
    });

    res.json({
      success: true,
      message: 'Dashboard saved successfully',
      dashboard: {
        id: dashboard.id,
        name: dashboard.name,
        widgetCount: dashboard.widgets.length,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt
      }
    });

  } catch (error) {
    logger.error('Dashboard save error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while saving the dashboard'
    });
  }
});

// Update dashboard
router.put('/update/:id', async (req, res) => {
  try {
    const dashboardId = req.params.id;
    const userId = req.user?.id || 'anonymous';

    logger.info('Dashboard update request received:', { 
      dashboardId,
      userId,
      dashboardName: req.body.name,
      widgetCount: req.body.widgets?.length || 0
    });

    // Validate request body
    const { error, value } = saveDashboardSchema.validate(req.body);
    if (error) {
      logger.warn('Validation error:', error.details[0].message);
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    // Check if dashboard exists
    const existingDashboard = storage.dashboards.get(dashboardId);
    if (!existingDashboard) {
      logger.warn('Dashboard not found for update:', { dashboardId, userId });
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    // Check ownership (in production, implement proper authorization)
    if (existingDashboard.userId !== userId) {
      logger.warn('Unauthorized dashboard update attempt:', { dashboardId, userId, ownerId: existingDashboard.userId });
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to update this dashboard'
      });
    }

    // Update dashboard
    const updatedDashboard = {
      ...existingDashboard,
      ...value,
      id: dashboardId, // Ensure ID doesn't change
      userId: userId,
      updatedAt: new Date().toISOString()
    };

    storage.dashboards.set(dashboardId, updatedDashboard);

    logger.info('Dashboard updated successfully:', { 
      dashboardId,
      userId,
      widgetCount: updatedDashboard.widgets.length
    });

    res.json({
      success: true,
      message: 'Dashboard updated successfully',
      dashboard: {
        id: updatedDashboard.id,
        name: updatedDashboard.name,
        widgetCount: updatedDashboard.widgets.length,
        createdAt: updatedDashboard.createdAt,
        updatedAt: updatedDashboard.updatedAt
      }
    });

  } catch (error) {
    logger.error('Dashboard update error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while updating the dashboard'
    });
  }
});

// Publish dashboard
router.post('/publish', async (req, res) => {
  try {
    logger.info('Dashboard publish request received:', { 
      userId: req.user?.id || 'anonymous',
      dashboardId: req.body.id,
      dashboardName: req.body.name
    });

    // Validate request body
  const { error, value } = publishDashboardSchema.validate(req.body);
    if (error) {
      logger.warn('Validation error:', error.details[0].message);
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

  // Normalize layouts -> layout for backend consistency
  const dashboardData = {
    ...value,
    layout: value.layout || value.layouts || {},
  };
    const userId = req.user?.id || 'anonymous';

    // Check if dashboard exists
    const existingDashboard = storage.dashboards.get(dashboardData.id);
    if (!existingDashboard) {
      logger.warn('Dashboard not found for publishing:', { dashboardId: dashboardData.id, userId });
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    // Check ownership
    if (existingDashboard.userId !== userId) {
      logger.warn('Unauthorized dashboard publish attempt:', { dashboardId: dashboardData.id, userId, ownerId: existingDashboard.userId });
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to publish this dashboard'
      });
    }

    // Generate shareable link and password
    const shareableId = `shared-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const shareableLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared/${shareableId}`;
    const sharePassword = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Update dashboard with publish data
    const publishedDashboard = {
      ...existingDashboard,
      ...dashboardData,
      isPublished: true,
      publishedAt: new Date().toISOString(),
      shareableLink: shareableLink,
      sharePassword: sharePassword,
      shareableId: shareableId,
      updatedAt: new Date().toISOString()
    };

    // Store published dashboard
    storage.dashboards.set(dashboardData.id, publishedDashboard);

    // Store shared dashboard data for public access
    const sharedDashboardData = {
      panelId: shareableId,
      widgets: publishedDashboard.widgets || [],
      layouts: publishedDashboard.layout || {}, // Keep as layout for backend consistency
      title: publishedDashboard.name || 'Shared Dashboard',
      stats: publishedDashboard.stats || { totalWidgets: (publishedDashboard.widgets || []).length, gridUtilization: 0 },
      sharePassword: sharePassword,
      publishedAt: publishedDashboard.publishedAt,
      isShared: true,
      originalDashboardId: dashboardData.id
    };

    storage.sharedDashboards.set(shareableId, sharedDashboardData);

    logger.info('Dashboard published successfully:', { 
      dashboardId: dashboardData.id,
      shareableId: shareableId,
      userId: userId,
      widgetCount: publishedDashboard.widgets.length
    });

    res.json({
      success: true,
      message: 'Dashboard published successfully',
      dashboard: {
        id: publishedDashboard.id,
        name: publishedDashboard.name,
        isPublished: true,
        publishedAt: publishedDashboard.publishedAt,
        shareableLink: shareableLink,
        sharePassword: sharePassword,
        shareableId: shareableId
      }
    });

  } catch (error) {
    logger.error('Dashboard publish error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while publishing the dashboard'
    });
  }
});

// Get shared dashboard
router.get('/shared/:shareableId', async (req, res) => {
  try {
    const shareableId = req.params.shareableId;
    const { password } = req.query;

    logger.info('Shared dashboard access request:', { shareableId });

    // Get shared dashboard data
    const sharedDashboard = storage.sharedDashboards.get(shareableId);
    if (!sharedDashboard) {
      logger.warn('Shared dashboard not found:', { shareableId });
      return res.status(404).json({
        success: false,
        error: 'Shared dashboard not found'
      });
    }

    // Check password if provided
    if (password && password !== sharedDashboard.sharePassword) {
      logger.warn('Invalid password for shared dashboard:', { shareableId });
      return res.status(401).json({
        success: false,
        error: 'Invalid access password'
      });
    }

    logger.info('Shared dashboard accessed successfully:', { shareableId });

    res.json({
      success: true,
      dashboard: sharedDashboard
    });

  } catch (error) {
    logger.error('Shared dashboard access error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while accessing the shared dashboard'
    });
  }
});

// Get user dashboards
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const requestingUserId = req.user?.id || 'anonymous';

    logger.info('User dashboards request:', { userId, requestingUserId });

    // Check authorization (in production, implement proper authorization)
    if (userId !== requestingUserId) {
      logger.warn('Unauthorized dashboard list request:', { userId, requestingUserId });
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to access these dashboards'
      });
    }

    // Get user's dashboards
    const userDashboards = Array.from(storage.dashboards.values())
      .filter(dashboard => dashboard.userId === userId)
      .map(dashboard => ({
        id: dashboard.id,
        name: dashboard.name,
        widgetCount: dashboard.widgets.length,
        isPublished: dashboard.isPublished,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt,
        publishedAt: dashboard.publishedAt
      }));

    logger.info('User dashboards retrieved successfully:', { userId, count: userDashboards.length });

    res.json({
      success: true,
      dashboards: userDashboards
    });

  } catch (error) {
    logger.error('User dashboards error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while retrieving dashboards'
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  const topicIdStats = getTopicIdStats();
  res.json({
    success: true,
    message: 'Dashboard service is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    totalDashboards: storage.dashboards.size,
    totalSharedDashboards: storage.sharedDashboards.size,
    topicIdGenerator: topicIdStats
  });
});

// Generate topic ID endpoint (for testing)
router.get('/generate-topic-id', (req, res) => {
  try {
    const topicId = generateTopicId();
    const stats = getTopicIdStats();
    
    logger.info('Topic ID generated via API:', { topicId });
    
    res.json({
      success: true,
      topicId: topicId,
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating topic ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate topic ID'
    });
  }
});

// Get dashboard by ID
router.get('/:id', async (req, res) => {
  try {
    const dashboardId = req.params.id;
    const userId = req.user?.id || 'anonymous';

    logger.info('Dashboard get request:', { dashboardId, userId });

    // Get dashboard
    const dashboard = storage.dashboards.get(dashboardId);
    if (!dashboard) {
      logger.warn('Dashboard not found:', { dashboardId, userId });
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    // Check ownership (in production, implement proper authorization)
    if (dashboard.userId !== userId) {
      logger.warn('Unauthorized dashboard access attempt:', { dashboardId, userId, ownerId: dashboard.userId });
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to access this dashboard'
      });
    }

    logger.info('Dashboard retrieved successfully:', { dashboardId, userId });

    res.json({
      success: true,
      dashboard: {
        id: dashboard.id,
        name: dashboard.name,
        widgets: dashboard.widgets,
        layout: dashboard.layout,
        deviceCount: dashboard.deviceCount,
        stats: dashboard.stats,
        isPublished: dashboard.isPublished,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt,
        publishedAt: dashboard.publishedAt
      }
    });

  } catch (error) {
    logger.error('Dashboard get error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while retrieving the dashboard'
    });
  }
});

// Delete dashboard
router.delete('/:id', async (req, res) => {
  try {
    const dashboardId = req.params.id;
    const userId = req.user?.id || 'anonymous';

    logger.info('Dashboard delete request:', { dashboardId, userId });

    // Check if dashboard exists
    const existingDashboard = storage.dashboards.get(dashboardId);
    if (!existingDashboard) {
      logger.warn('Dashboard not found for deletion:', { dashboardId, userId });
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    // Check ownership
    if (existingDashboard.userId !== userId) {
      logger.warn('Unauthorized dashboard deletion attempt:', { dashboardId, userId, ownerId: existingDashboard.userId });
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to delete this dashboard'
      });
    }

    // Delete dashboard
    storage.dashboards.delete(dashboardId);

    // If it was published, also delete shared data
    if (existingDashboard.isPublished && existingDashboard.shareableId) {
      storage.sharedDashboards.delete(existingDashboard.shareableId);
    }

    logger.info('Dashboard deleted successfully:', { dashboardId, userId });

    res.json({
      success: true,
      message: 'Dashboard deleted successfully'
    });

  } catch (error) {
    logger.error('Dashboard delete error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while deleting the dashboard'
    });
  }
});

module.exports = router;

