import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from './logger.js';

// Criar registry
export const register = new Registry();

// Métricas HTTP
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Métricas de WebSocket
export const websocketConnections = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const websocketMessages = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['type', 'direction'], // direction: sent/received
  registers: [register],
});

// Métricas de WhatsApp
export const whatsappConnections = new Gauge({
  name: 'whatsapp_connections_active',
  help: 'Number of active WhatsApp connections',
  registers: [register],
});

export const whatsappMessages = new Counter({
  name: 'whatsapp_messages_total',
  help: 'Total number of WhatsApp messages',
  labelNames: ['connection_id', 'direction', 'type'], // direction: sent/received
  registers: [register],
});

// Métricas de Database
export const databaseQueries = new Counter({
  name: 'database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'model'],
  registers: [register],
});

export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// Métricas de Cache
export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['key_prefix'],
  registers: [register],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['key_prefix'],
  registers: [register],
});

// Métricas de Jobs
export const jobsProcessed = new Counter({
  name: 'jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['queue', 'status'], // status: completed/failed
  registers: [register],
});

export const jobDuration = new Histogram({
  name: 'job_duration_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['queue'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [register],
});

export const jobsActive = new Gauge({
  name: 'jobs_active',
  help: 'Number of jobs currently being processed',
  labelNames: ['queue'],
  registers: [register],
});

// Métricas de Sistema
export const systemMemory = new Gauge({
  name: 'system_memory_usage_bytes',
  help: 'System memory usage in bytes',
  labelNames: ['type'], // type: rss, heapTotal, heapUsed, external
  registers: [register],
});

export const systemCpu = new Gauge({
  name: 'system_cpu_usage_percent',
  help: 'System CPU usage percentage',
  registers: [register],
});

// Coletar métricas de sistema periodicamente
export function startSystemMetricsCollection(): void {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    systemMemory.set({ type: 'rss' }, memUsage.rss);
    systemMemory.set({ type: 'heapTotal' }, memUsage.heapTotal);
    systemMemory.set({ type: 'heapUsed' }, memUsage.heapUsed);
    systemMemory.set({ type: 'external' }, memUsage.external);
    
    const cpuUsage = process.cpuUsage();
    const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    systemCpu.set(totalUsage);
  }, 10000); // A cada 10 segundos
  
  logger.info('✅ System metrics collection started');
}

// Middleware para coletar métricas HTTP
export function metricsMiddleware(request: any, reply: any, done: () => void): void {
  const start = Date.now();
  
  reply.addHook('onSend', () => {
    const duration = (Date.now() - start) / 1000;
    const route = request.routeOptions?.url || request.url;
    const method = request.method;
    const statusCode = reply.statusCode;
    
    httpRequestDuration.observe(
      { method, route, status_code: statusCode },
      duration
    );
    
    httpRequestTotal.inc({
      method,
      route,
      status_code: statusCode,
    });
  });
  
  done();
}

logger.info('✅ Metrics configured');
