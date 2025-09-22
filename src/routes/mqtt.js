const express = require('express');
const mqttService = require('../services/mqttService');
const logger = require('../utils/logger');

const router = express.Router();

// Ensure connection on first use
router.use((req, res, next) => {
  mqttService.connect();
  next();
});

router.get('/health', (req, res) => {
  res.json({ success: true, mqtt: mqttService.getHealth() });
});

router.get('/topics', (req, res) => {
  res.json({ success: true, topics: mqttService.getTopics() });
});

router.get('/latest', (req, res) => {
  const { topic } = req.query;
  if (!topic) {
    return res.status(400).json({ success: false, error: 'Query param "topic" is required' });
  }
  const data = mqttService.getLatest(topic);
  if (!data) {
    return res.status(404).json({ success: false, error: 'No data for topic' });
  }
  res.json({ success: true, data });
});

router.post('/publish', (req, res) => {
  const { topic, message, options } = req.body || {};
  if (!topic) return res.status(400).json({ success: false, error: 'topic is required' });
  mqttService.publish(topic, message ?? '', options || {});
  logger.info(`📤 MQTT publish via API to ${topic}`);
  res.json({ success: true });
});

module.exports = router;


