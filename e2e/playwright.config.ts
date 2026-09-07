import { defineConfig, devices } from '@playwright/test'

// Optional override for environments with a pre-provisioned chromium that doesn't match the
// installed playwright version (e.g. sandboxes). CI installs the matching browser instead.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH

export default defineConfig({
	testDir: './tests',
	outputDir: './test-results',
	globalSetup: './support/global-setup.ts',
	timeout: 60_000,
	expect: { timeout: 10_000 },
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
	use: {
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				// The buttons page switches to a single-column layout below 1200px
				viewport: { width: 1440, height: 900 },
				launchOptions: executablePath ? { executablePath } : {},
			},
		},
	],
})
