module.exports = {
  apps: [
    {
      name: 'truth-host-platform',
      script: 'index.js',
      cwd: '/var/www/truth-host',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      // Reads variables from the .env file in the project root.
      // Make sure /var/www/truth-host/.env is configured before starting.
      env_file: '/var/www/truth-host/.env',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
