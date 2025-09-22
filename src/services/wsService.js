const { WebSocketServer } = require('ws');
const url = require('url');
const logger = require('../utils/logger');
const mqttService = require('./mqttService');

class WSService {
  constructor() {
    this.wss = null;
  }

  init(server) {
    if (this.wss) return this.wss;
    this.wss = new WebSocketServer({ server, path: '/ws' });

    // Handle client connections
    this.wss.on('connection', (ws, req) => {
      const { query } = url.parse(req.url, true);
      const topicsParam = query.topics || '';
      const topics = String(topicsParam).split(',').map(t => t.trim()).filter(Boolean);

      ws.subscriptions = new Set(topics);
      logger.info(`🧩 WS client connected. Subs: ${topics.join(', ') || '(none)'}`);

      ws.on('message', (msg) => {
        try {
          const { action, topic } = JSON.parse(msg.toString());
          if (action === 'subscribe' && topic) ws.subscriptions.add(topic);
          if (action === 'unsubscribe' && topic) ws.subscriptions.delete(topic);
        } catch (_) {}
      });

      ws.on('close', () => {
        logger.info('🔌 WS client disconnected');
      });
    });

    // Bridge MQTT -> WS
    mqttService.on('message', (record) => {
      if (!this.wss) return;
      const payload = JSON.stringify({ type: 'mqtt', ...record });
      this.wss.clients.forEach((client) => {
        try {
          if (client.readyState === 1 /* OPEN */) {
            if (client.subscriptions?.size) {
              if (client.subscriptions.has(record.topic)) client.send(payload);
            } else {
              // If no subs declared, deliver all
              client.send(payload);
            }
          }
        } catch (_) {}
      });
    });

    logger.info('🛰️ WebSocket server initialized at /ws');
    return this.wss;
  }
}

module.exports = new WSService();


