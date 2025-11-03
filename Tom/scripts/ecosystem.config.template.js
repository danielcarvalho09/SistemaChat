/**
 * PM2 Ecosystem Configuration
 * 
 * Copie este arquivo para /var/www/autochat/ecosystem.config.js
 * e ajuste os caminhos se necessário
 */

module.exports = {
  apps: [
    {
      name: 'autochat-backend',
      cwd: '/var/www/autochat/backend',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/www/autochat/logs/backend-error.log',
      out_file: '/var/www/autochat/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Restart após 1 hora de uptime (prevenir memory leaks)
      max_restart_delay: 5000,
      // Intervalo entre restarts
      restart_delay: 4000,
      // Enviar SIGINT antes de SIGKILL (graceful shutdown)
      kill_timeout: 5000,
    },
    {
      name: 'autochat-frontend',
      cwd: '/var/www/autochat/frontend',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 5173,
      },
      error_file: '/var/www/autochat/logs/frontend-error.log',
      out_file: '/var/www/autochat/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_restart_delay: 5000,
      restart_delay: 4000,
      kill_timeout: 5000,
    },
  ],
};

