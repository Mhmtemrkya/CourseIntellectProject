/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: './playwright-tests',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    headless: true,
  },
};

export default config;
