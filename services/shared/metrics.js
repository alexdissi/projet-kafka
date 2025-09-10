import client from 'prom-client';

// Configuration du registre par défaut
const register = client.register;

// Métriques communes
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'service', 'status_code'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'service', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

// Métriques Kafka
const kafkaMessagesProduced = new client.Counter({
  name: 'kafka_messages_produced_total',
  help: 'Total number of messages produced to Kafka',
  labelNames: ['topic', 'service'],
  registers: [register]
});

const kafkaMessagesConsumed = new client.Counter({
  name: 'kafka_messages_consumed_total',
  help: 'Total number of messages consumed from Kafka',
  labelNames: ['topic', 'service'],
  registers: [register]
});

const kafkaMessageProcessingDuration = new client.Histogram({
  name: 'kafka_message_processing_duration_seconds',
  help: 'Time spent processing Kafka messages',
  labelNames: ['topic', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const kafkaConsumerLag = new client.Gauge({
  name: 'kafka_consumer_lag',
  help: 'Consumer lag per partition',
  labelNames: ['topic', 'partition', 'service'],
  registers: [register]
});

// Métriques métier pour le banking
const ordersTotal = new client.Counter({
  name: 'orders_total',
  help: 'Total number of orders created',
  labelNames: ['service'],
  registers: [register]
});

const paymentsTotal = new client.Counter({
  name: 'payments_total',
  help: 'Total number of payment transactions',
  labelNames: ['status', 'service'], // status: authorized, rejected
  registers: [register]
});

const orderAmount = new client.Histogram({
  name: 'order_amount_euros',
  help: 'Amount of orders in euros',
  labelNames: ['service'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register]
});

// Métriques système
const processUptime = new client.Gauge({
  name: 'process_uptime_seconds',
  help: 'Process uptime in seconds',
  registers: [register]
});

const memoryUsage = new client.Gauge({
  name: 'process_memory_usage_bytes',
  help: 'Process memory usage in bytes',
  labelNames: ['type'], // type: rss, heapTotal, heapUsed, external
  registers: [register]
});

// Fonction pour collecter les métriques système
function collectSystemMetrics() {
  const startTime = Date.now();
  
  setInterval(() => {
    // Uptime
    processUptime.set((Date.now() - startTime) / 1000);
    
    // Memory usage
    const memUsage = process.memoryUsage();
    memoryUsage.set({ type: 'rss' }, memUsage.rss);
    memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
    memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
    memoryUsage.set({ type: 'external' }, memUsage.external);
  }, 5000); // Toutes les 5 secondes
}

// Middleware Hono pour métriques HTTP
export function createMetricsMiddleware(serviceName) {
  return async (c, next) => {
    const startTime = Date.now();
    const method = c.req.method;
    const route = c.req.path;

    // Traitement de la requête
    await next();

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const statusCode = c.res.status.toString();

    // Enregistrer les métriques
    httpRequestsTotal.inc({ method, route, service: serviceName, status_code: statusCode });
    httpRequestDuration.observe({ method, route, service: serviceName, status_code: statusCode }, duration);
  };
}

// Helper pour mesurer la durée du processing Kafka
export function createKafkaTimer(topic, service) {
  const endTimer = kafkaMessageProcessingDuration.startTimer({ topic, service });
  return endTimer;
}

// Exporter toutes les métriques et utilitaires
export {
  register,
  client,
  httpRequestsTotal,
  httpRequestDuration,
  kafkaMessagesProduced,
  kafkaMessagesConsumed,
  kafkaMessageProcessingDuration,
  kafkaConsumerLag,
  ordersTotal,
  paymentsTotal,
  orderAmount,
  processUptime,
  memoryUsage,
  collectSystemMetrics
};

// Route pour exposer les métriques
export function createMetricsRoute(app, serviceName) {
  app.get('/metrics', async (c) => {
    const metrics = await register.metrics();
    c.res.headers.set('Content-Type', register.contentType);
    return c.text(metrics);
  });
  
  // Démarrer la collecte des métriques système
  collectSystemMetrics();
  
  console.log(`📊 Prometheus metrics enabled for ${serviceName} at /metrics`);
}