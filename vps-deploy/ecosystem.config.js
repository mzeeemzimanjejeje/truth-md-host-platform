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
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
