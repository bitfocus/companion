import { defineConfig } from '@playwright/test'

// This is a sample config for what users might be running locally
export default defineConfig({
	testDir: './tests',

	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* We must run tests sequentially, as they rely on common app state. */
	workers: 1,
	fullyParallel: false,

	/* Maximum time one test can run for. */
	timeout: 90 * 1000,
	expect: {
		/**
		 * Maximum time expect() should wait for the condition to be met.
		 * For example in `await expect(locator).toHaveText();`
		 */
		timeout: 5000,
	},
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: 'html',
	/* Configure projects for major browsers */
	projects: [
		{
			name: 'chrome',
			use: {
				browserName: 'chromium',
				channel: 'chrome',
			},
		},
	],
})
