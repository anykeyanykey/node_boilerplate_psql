/**
 * PM2 ecosystem config.
 *
 * Used both on the host and inside the Docker image, so the same file drives
 * `npm run pm2:start` and `pm2-runtime` in the container.
 *
 * CommonJS on purpose: the package is `"type": "module"`.
 */
/**
 * Set when running under pm2-runtime inside a container: logs then go to
 * stdout/stderr so `docker logs` and any log collector keep working.
 * PM2 otherwise writes to ./logs/out.log and ./logs/error.log.
 */
const logToStdout = process.env['LOG_TO_STDOUT'] === 'true';

module.exports = {
  apps: [
    {
      name: 'node_boilerplate_psql',
      script: 'dist/index.js',
      cwd: __dirname,

      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      restart_delay: 2000,
      max_memory_restart: '300M',

      // Graceful shutdown: must outlive SHUTDOWN_TIMEOUT_MS in src/config.ts
      kill_timeout: 15_000,
      listen_timeout: 15_000,
      wait_ready: false,

      time: true,
      merge_logs: true,
      out_file: logToStdout ? '/dev/stdout' : 'logs/out.log',
      error_file: logToStdout ? '/dev/stderr' : 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
      env_development: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
        exec_mode: 'fork',
      },
    },
  ],
};
