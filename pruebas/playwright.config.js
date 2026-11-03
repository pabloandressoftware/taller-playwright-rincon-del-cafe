// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1, // los datos de la app viven en memoria y se comparten
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Enciende la app antes de probar y la apaga al terminar
  webServer: {
    command: 'npm start',
    cwd: '../app',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
