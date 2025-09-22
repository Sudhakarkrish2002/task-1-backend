/**
 * Topic ID Generator
 * Generates unique 15-digit topic IDs for dashboards
 * Optimized for performance and uniqueness
 */

const crypto = require('crypto');

// Store used IDs in memory to prevent duplicates within the same session
const usedIds = new Set();

/**
 * Generates a cryptographically secure random number
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random number between min and max
 */
function secureRandom(min, max) {
  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValidValue = Math.floor(256 ** bytesNeeded / range) * range - 1;
  
  let randomValue;
  do {
    const randomBytes = crypto.randomBytes(bytesNeeded);
    randomValue = 0;
    for (let i = 0; i < bytesNeeded; i++) {
      randomValue = (randomValue << 8) + randomBytes[i];
    }
  } while (randomValue > maxValidValue);
  
  return min + (randomValue % range);
}

/**
 * Generates a unique 15-digit topic ID
 * Uses timestamp + random digits for optimal uniqueness
 * @returns {string} 15-digit unique topic ID
 */
function generateTopicId() {
  let topicId;
  let attempts = 0;
  const maxAttempts = 1000; // Prevent infinite loops
  
  do {
    // Get current timestamp (13 digits)
    const timestamp = Date.now().toString();
    
    // Generate 2 additional random digits to make it 15 digits total
    const randomDigits = secureRandom(10, 99).toString();
    
    // Combine timestamp + random digits = 15 digits
    topicId = timestamp + randomDigits;
    
    attempts++;
    
    // If we've tried too many times, add more randomness
    if (attempts > 100) {
      const extraRandom = secureRandom(1000, 9999).toString();
      topicId = timestamp.slice(0, 11) + extraRandom; // Take 11 from timestamp + 4 random = 15
    }
    
  } while (usedIds.has(topicId) && attempts < maxAttempts);
  
  // If we still have a collision after max attempts, use crypto fallback
  if (usedIds.has(topicId)) {
    const randomBytes = crypto.randomBytes(8);
    const randomHex = randomBytes.toString('hex');
    // Convert hex to digits and take first 15
    topicId = randomHex.replace(/[a-f]/g, (char) => {
      return (parseInt(char, 16) + 1).toString();
    }).substring(0, 15);
  }
  
  // Ensure it's exactly 15 digits
  if (topicId.length > 15) {
    topicId = topicId.substring(0, 15);
  } else if (topicId.length < 15) {
    topicId = topicId.padStart(15, '0');
  }
  
  // Add to used IDs set
  usedIds.add(topicId);
  
  // Clean up old IDs periodically to prevent memory bloat
  if (usedIds.size > 10000) {
    const idsArray = Array.from(usedIds);
    const cutoff = idsArray.length - 5000; // Keep only recent 5000
    usedIds.clear();
    idsArray.slice(cutoff).forEach(id => usedIds.add(id));
  }
  
  return topicId;
}

/**
 * Validates if a topic ID is properly formatted (15 digits)
 * @param {string} topicId - Topic ID to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateTopicId(topicId) {
  return /^\d{15}$/.test(topicId);
}

/**
 * Gets statistics about generated topic IDs
 * @returns {Object} Statistics object
 */
function getTopicIdStats() {
  return {
    totalGenerated: usedIds.size,
    memoryUsage: usedIds.size * 15, // Approximate bytes
    isHealthy: usedIds.size < 10000
  };
}

module.exports = {
  generateTopicId,
  validateTopicId,
  getTopicIdStats
};
