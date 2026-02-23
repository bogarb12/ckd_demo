module.exports = {
    apps: [{
        name: 'diabetes-tracking',
        script: 'server/server.js',
        cwd: '/var/www/html/diabetes-tracking',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '256M',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        }
    }]
};
