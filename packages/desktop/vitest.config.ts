import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'happy-dom',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            exclude: [
                'node_modules/',
                'dist/',
                'src-tauri/',
                'tests/fixtures/',
                '**/*.config.*',
                '**/main.tsx',
            ],
        },
    },
    resolve: { alias: { '@': '/src' } },
});
