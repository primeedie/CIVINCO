import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:14174',
    headless: true,
    launchOptions: { executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
    viewport: { width: 1440, height: 1100 },
    colorScheme: 'light',
  },
  webServer: {
    command: 'node server/index.mjs --production',
    url: 'http://127.0.0.1:14174',
    env: { PORT: '14174', CIVINCO_DATA_DIR: `test-results/browser-data-${Date.now()}`, GEMINI_API_KEY: '' },
    reuseExistingServer: false,
    timeout: 20000,
  },
});
