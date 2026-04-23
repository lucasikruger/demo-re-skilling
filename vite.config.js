import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const devHost = env.VITE_DEV_HOST || 'localhost';

    return {
        plugins: [
            laravel({
                input: ['resources/css/app.css', 'resources/js/app.jsx'],
                refresh: true,
            }),
            react(),
            tailwindcss(),
        ],
        server: {
            host: '0.0.0.0',
            port: 5173,
            strictPort: true,
            origin: `http://${devHost}:5173`,
            cors: {
                origin: '*',
            },
            hmr: {
                host: devHost,
                protocol: 'ws',
                port: 5173,
            },
            watch: {
                ignored: ['**/storage/framework/views/**'],
            },
        },
    };
});
