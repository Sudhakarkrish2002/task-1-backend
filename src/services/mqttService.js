const mqtt = require('mqtt');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class BackendMQTTService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isConnected = false;
    this.latestByTopic = new Map();
    this.subscriptions = new Set();
  }

  getConfigFromEnv() {
    return {
      host: process.env.MQTT_HOST || 'localhost',
      port: Number(process.env.MQTT_PORT) || 1883,
      protocol: process.env.MQTT_PROTOCOL || 'mqtt',
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      clientId: process.env.MQTT_CLIENT_ID || `iot-backend-${Math.random().toString(16).slice(2, 10)}`,
      subscribeTopics: (process.env.MQTT_SUBSCRIBE_TOPICS || '#').split(',').map(t => t.trim()).filter(Boolean),
      qos: Number(process.env.MQTT_QOS) || 0,
    };
  }

  connect() {
    if (this.client) return;

    const cfg = this.getConfigFromEnv();
    const brokerUrl = `${cfg.protocol}://${cfg.host}:${cfg.port}`;

    logger.info(`🔗 Connecting to MQTT broker at ${brokerUrl}`);

    this.client = mqtt.connect(brokerUrl, {
      clientId: cfg.clientId,
      username: cfg.username,
      password: cfg.password,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30_000,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('✅ MQTT connected');
      // Subscribe to configured topics
      cfg.subscribeTopics.forEach(topic => this.subscribe(topic, { qos: cfg.qos }));
    });

    this.client.on('reconnect', () => {
      logger.info('🔄 MQTT reconnecting...');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('⚠️ MQTT connection closed');
    });

    this.client.on('error', (err) => {
      logger.error('❌ MQTT error:', err.message);
    });

    this.client.on('message', (topic, payload) => {
      const messageString = payload.toString();
      let data = null;
      try {
        data = JSON.parse(messageString);
      } catch (_) {
        data = messageString;
      }
      const record = {
        topic,
        data,
        raw: messageString,
        receivedAt: new Date().toISOString(),
      };
      this.latestByTopic.set(topic, record);
      // Emit event for WS bridge
      this.emit('message', record);
    });
  }

  subscribe(topic, options = {}) {
    if (!this.client) this.connect();
    if (!this.isConnected) {
      // Defer actual subscribe until connected
      this.client.once('connect', () => this.subscribe(topic, options));
      return;
    }
    this.client.subscribe(topic, options, (err, granted) => {
      if (err) {
        logger.error(`❌ Failed to subscribe to ${topic}:`, err.message);
        return;
      }
      this.subscriptions.add(topic);
      logger.info(`📡 Subscribed to ${topic}${granted && granted[0] ? ` (qos=${granted[0].qos})` : ''}`);
    });
  }

  unsubscribe(topic) {
    if (!this.client || !this.isConnected) return;
    this.client.unsubscribe(topic, (err) => {
      if (err) {
        logger.error(`❌ Failed to unsubscribe from ${topic}:`, err.message);
        return;
      }
      this.subscriptions.delete(topic);
      logger.info(`📴 Unsubscribed from ${topic}`);
    });
  }

  publish(topic, message, options = {}) {
    if (!this.client) this.connect();
    const payload = typeof message === 'object' ? JSON.stringify(message) : String(message);
    this.client.publish(topic, payload, options, (err) => {
      if (err) logger.error('❌ MQTT publish error:', err.message);
    });
  }

  getLatest(topic) {
    return this.latestByTopic.get(topic) || null;
  }

  getTopics() {
    return Array.from(this.latestByTopic.keys());
  }

  getHealth() {
    return {
      connected: this.isConnected,
      clientId: this.client?.options?.clientId,
      subscriptions: Array.from(this.subscriptions),
      knownTopics: this.latestByTopic.size,
    };
  }

  shutdown() {
    if (this.client) {
      try { this.client.end(true); } catch (_) {}
      this.client = null;
    }
    this.isConnected = false;
    logger.info('🔌 MQTT client shut down');
  }
}

// Singleton
const backendMqttService = new BackendMQTTService();

module.exports = backendMqttService;


