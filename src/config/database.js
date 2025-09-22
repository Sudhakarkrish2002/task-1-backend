/**
 * In-memory database configuration
 * In production, this would be replaced with a real database like MongoDB, PostgreSQL, etc.
 */

// In-memory storage maps
const storage = {
  // User authentication and password reset tokens
  resetTokens: new Map(),
  
  // Dashboard storage
  dashboards: new Map(),
  
  // Shared dashboard storage
  sharedDashboards: new Map(),
  
  // User sessions (for future use)
  sessions: new Map(),
  
  // Device data (for future use)
  devices: new Map()
};

/**
 * Get the storage instance
 * @returns {Object} Storage object with all maps
 */
const getStorage = () => {
  return storage;
};

/**
 * Clear all storage (useful for testing)
 */
const clearStorage = () => {
  storage.resetTokens.clear();
  storage.dashboards.clear();
  storage.sharedDashboards.clear();
  storage.sessions.clear();
  storage.devices.clear();
};

/**
 * Get storage statistics
 * @returns {Object} Storage statistics
 */
const getStorageStats = () => {
  return {
    resetTokens: storage.resetTokens.size,
    dashboards: storage.dashboards.size,
    sharedDashboards: storage.sharedDashboards.size,
    sessions: storage.sessions.size,
    devices: storage.devices.size,
    total: storage.resetTokens.size + storage.dashboards.size + storage.sharedDashboards.size + storage.sessions.size + storage.devices.size
  };
};

module.exports = {
  getStorage,
  clearStorage,
  getStorageStats,
  /**
   * Returns a simple connection status for health checks
   * Since we use in-memory storage here, we report as connected
   */
  getConnectionStatus: () => ({
    connected: true,
    type: 'in-memory'
  })
};

