module.exports = {
    apps: [{
        name: 'diabetes-tracking',
        script: 'server/server.js',
        cwd: '/var/www/html/diabetes-tracking',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '256M',
        error_file: 'logs/err.log',
        out_file: 'logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }]
};
