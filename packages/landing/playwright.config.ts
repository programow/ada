import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    use: { baseURL: 'http://localhost:3000' },
    webServer: {
        command: 'bunx serve out -p 3000',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
    },
});
