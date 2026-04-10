import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.jsx',
            ],
            refresh: true,
            buildDirectory: 'build',
        }),
        react({
            include: 'resources/js/**/*.jsx',
        }),
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor': ['react', 'react-dom', '@inertiajs/react'],
                },
            },
        },
        cssCodeSplit: true,
    },
    server: {
        host: '0.0.0.0',
        hmr: false
        // {
        //     host: '2.3.4.13',
        //     port: 5175,
        //     protocol: 'ws',
        //     clientPort: 5175,
        // },
        // watch: {
        //     usePolling: true,
        // },
    },
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
});